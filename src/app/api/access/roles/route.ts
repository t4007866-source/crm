import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isKnownPermissionKey, PERMISSION_CATALOG, ACCESS_SCOPES } from "@/lib/access-control";

export const dynamic = "force-dynamic";

async function adminSession() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  if ((session.user as any).role !== "ADMIN") return { error: NextResponse.json({ error: "רק אדמין יכול לנהל תפקידים" }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const auth = await adminSession();
  if (auth.error) return auth.error;
  const [roles, users, definitions] = await Promise.all([
    prisma.customRole.findMany({ include: { permissions: { include: { permission: true } }, assignments: { select: { userId: true, expiresAt: true } } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" } }),
    prisma.permissionDefinition.findMany({ orderBy: { key: "asc" } }),
  ]);
  return NextResponse.json({ roles, users, definitions, catalog: PERMISSION_CATALOG, scopes: ACCESS_SCOPES });
}

export async function POST(req: NextRequest) {
  const auth = await adminSession();
  if (auth.error) return auth.error;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "שם התפקיד חובה" }, { status: 400 });
  const permissions = Array.isArray(body.permissions) ? body.permissions : [];
  const invalid = permissions.filter((p: any) => !p || !isKnownPermissionKey(p.key) || !Array.isArray(p.actions));
  if (invalid.length) return NextResponse.json({ error: "הרשאה לא מוכרת או מבנה הרשאה לא תקין" }, { status: 400 });
  const userId = (auth.session!.user as any).id as string;
  const role = await prisma.customRole.create({
    data: {
      name,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      createdById: userId,
      permissions: {
        create: permissions.map((p: any) => ({
          permission: { connectOrCreate: { where: { key: p.key }, create: { key: p.key, description: p.description || null, category: p.key.split(".")[0], isSensitive: p.key.endsWith("view_sensitive") } } },
          actions: p.actions,
          scope: ACCESS_SCOPES.includes(p.scope) ? p.scope : "ALL",
          conditions: p.conditions || undefined,
          fieldRules: p.fieldRules || undefined,
        })),
      },
    },
    include: { permissions: { include: { permission: true } } },
  });
  await prisma.auditLog.create({ data: { userId, action: "CREATE_CUSTOM_ROLE", entity: "CustomRole", entityId: role.id, after: { name: role.name } } });
  return NextResponse.json({ role }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await adminSession();
  if (auth.error) return auth.error;
  const body = await req.json();
  const userId = (auth.session!.user as any).id as string;
  if (body.operation === "assign") {
    if (!body.userId || !body.customRoleId) return NextResponse.json({ error: "חסרים משתמש או תפקיד" }, { status: 400 });
    const assignment = await prisma.userRoleAssignment.upsert({ where: { userId_customRoleId: { userId: body.userId, customRoleId: body.customRoleId } }, update: { assignedById: userId, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }, create: { userId: body.userId, customRoleId: body.customRoleId, assignedById: userId, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } });
    await prisma.auditLog.create({ data: { userId, action: "ASSIGN_CUSTOM_ROLE", entity: "User", entityId: body.userId, after: { customRoleId: body.customRoleId, expiresAt: assignment.expiresAt } } });
    return NextResponse.json({ assignment });
  }
  if (!body.customRoleId || !Array.isArray(body.permissions)) return NextResponse.json({ error: "חסרים תפקיד או הרשאות" }, { status: 400 });
  const role = await prisma.customRole.findUnique({ where: { id: body.customRoleId } });
  if (!role) return NextResponse.json({ error: "תפקיד לא נמצא" }, { status: 404 });
  const invalid = body.permissions.filter((p: any) => !p || !isKnownPermissionKey(p.key) || !Array.isArray(p.actions));
  if (invalid.length) return NextResponse.json({ error: "הרשאה לא מוכרת או מבנה הרשאה לא תקין" }, { status: 400 });
  await prisma.customRolePermission.deleteMany({ where: { customRoleId: role.id } });
  const updated = await prisma.customRole.update({ where: { id: role.id }, data: { description: body.description ?? undefined, permissions: { create: body.permissions.map((p: any) => ({ permission: { connectOrCreate: { where: { key: p.key }, create: { key: p.key, category: p.key.split(".")[0], isSensitive: p.key.endsWith("view_sensitive") } } }, actions: p.actions, scope: ACCESS_SCOPES.includes(p.scope) ? p.scope : "ALL", conditions: p.conditions || undefined, fieldRules: p.fieldRules || undefined })) } }, include: { permissions: { include: { permission: true } } } });
  await prisma.auditLog.create({ data: { userId, action: "UPDATE_CUSTOM_ROLE", entity: "CustomRole", entityId: role.id, after: { permissionCount: body.permissions.length } } });
  return NextResponse.json({ role: updated });
}

export async function DELETE(req: NextRequest) {
  const auth = await adminSession();
  if (auth.error) return auth.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר מזהה תפקיד" }, { status: 400 });
  const role = await prisma.customRole.findUnique({ where: { id }, select: { name: true, isSystem: true } });
  if (!role) return NextResponse.json({ error: "תפקיד לא נמצא" }, { status: 404 });
  if (role.isSystem) return NextResponse.json({ error: "לא ניתן למחוק תפקיד מערכת" }, { status: 409 });
  await prisma.customRole.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: (auth.session!.user as any).id, action: "DELETE_CUSTOM_ROLE", entity: "CustomRole", entityId: id, before: role } });
  return NextResponse.json({ success: true });
}

