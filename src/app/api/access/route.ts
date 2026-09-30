import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIONS, MODULES, ROLE_PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function isAdmin(session: any) { return session?.user && session.user.role === "ADMIN"; }

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "רק אדמין יכול לנהל הרשאות" }, { status: 403 });
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true, isBlocked: true, permissions: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ modules: MODULES, actions: ACTIONS, roles: ROLE_PERMISSIONS, users });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "רק אדמין יכול לשנות הרשאות" }, { status: 403 });
  const body = await req.json();
  const before = await prisma.user.findUnique({ where: { id: body.userId } });
  if (!before) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  const permissions = body.permissions && typeof body.permissions === "object" ? body.permissions : {};
  const user = await prisma.user.update({ where: { id: body.userId }, data: { permissions }, select: { id: true, name: true, email: true, permissions: true } });
  await prisma.auditLog.create({ data: { userId: (session.user as any).id, action: "UPDATE_PERMISSIONS", entity: "User", entityId: user.id, before: before as any, after: user as any } });
  return NextResponse.json({ user });
}

