import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isKnownPermissionKey, ACCESS_SCOPES } from "@/lib/access-control";

export const dynamic = "force-dynamic";

async function getAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  if ((session.user as any).role !== "ADMIN") return { error: NextResponse.json({ error: "רק אדמין יכול לנהל הרשאות זמניות" }, { status: 403 }) };
  return { session, userId: (session.user as any).id as string };
}

export async function GET() {
  const auth = await getAdmin();
  if (auth.error) return auth.error;
  const permissions = await prisma.temporaryPermission.findMany({ include: { user: { select: { id: true, name: true, email: true } }, grantedBy: { select: { id: true, name: true } } }, orderBy: { endsAt: "asc" } });
  return NextResponse.json({ permissions });
}

export async function POST(req: NextRequest) {
  const auth = await getAdmin();
  if (auth.error) return auth.error;
  const body = await req.json();
  if (!body.userId || typeof body.permissionKey !== "string" || !isKnownPermissionKey(body.permissionKey)) return NextResponse.json({ error: "משתמש או הרשאה לא תקינים" }, { status: 400 });
  if (typeof body.reason !== "string" || !body.reason.trim()) return NextResponse.json({ error: "יש להזין סיבה להרשאה זמנית" }, { status: 400 });
  const endsAt = new Date(body.endsAt);
  if (Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) return NextResponse.json({ error: "תאריך סיום לא תקין" }, { status: 400 });
  const permission = await prisma.temporaryPermission.create({ data: { userId: body.userId, permissionKey: body.permissionKey, scope: ACCESS_SCOPES.includes(body.scope) ? body.scope : "ALL", startsAt: body.startsAt ? new Date(body.startsAt) : new Date(), endsAt, grantedById: auth.userId!, reason: body.reason.trim(), conditions: body.conditions || undefined } });
  await prisma.auditLog.create({ data: { userId: auth.userId!, action: "GRANT_TEMPORARY_PERMISSION", entity: "User", entityId: body.userId, after: { permissionKey: body.permissionKey, endsAt, reason: body.reason.trim() } } });
  return NextResponse.json({ permission }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAdmin();
  if (auth.error) return auth.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר מזהה הרשאה" }, { status: 400 });
  const existing = await prisma.temporaryPermission.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "הרשאה לא נמצאה" }, { status: 404 });
  await prisma.temporaryPermission.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: auth.userId!, action: "REVOKE_TEMPORARY_PERMISSION", entity: "User", entityId: existing.userId, before: { permissionKey: existing.permissionKey, endsAt: existing.endsAt } } });
  return NextResponse.json({ success: true });
}

