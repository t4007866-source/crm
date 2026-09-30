import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "MANAGER"];

async function adminSession() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  return session && ADMIN_ROLES.includes(role) ? session : null;
}

async function gmailIntegration() {
  return prisma.integration.upsert({
    where: { key: "gmail" },
    update: {},
    create: { key: "gmail", name: "Gmail", category: "EMAIL", status: "CONFIGURED", enabled: true },
  });
}

export async function GET() {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const integration = await gmailIntegration();
  const profiles = await prisma.emailMappingProfile.findMany({
    where: { integrationId: integration.id },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ profiles });
}

export async function POST(request: NextRequest) {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.matchValue !== "string" || !body.name.trim() || !body.matchValue.trim()) {
    return NextResponse.json({ error: "נדרשים שם פרופיל וערך התאמה" }, { status: 400 });
  }
  const matchType = body.matchType === "SENDER" ? "SENDER" : "DOMAIN";
  const matchValue = body.matchValue.trim().toLowerCase().replace(/^@/, "");
  const integration = await gmailIntegration();
  const profile = await prisma.emailMappingProfile.upsert({
    where: { integrationId_matchType_matchValue: { integrationId: integration.id, matchType, matchValue } },
    update: { name: body.name.trim(), mapping: body.mapping || {}, enabled: body.enabled !== false, priority: Number(body.priority) || 0 },
    create: { integrationId: integration.id, name: body.name.trim(), matchType, matchValue, mapping: body.mapping || {}, enabled: body.enabled !== false, priority: Number(body.priority) || 0, createdById: (session.user as any)?.id },
  });
  await prisma.auditLog.create({ data: { userId: (session.user as any).id, action: "CREATE_OR_UPDATE", entity: "EmailMappingProfile", entityId: profile.id, after: profile as any } });
  return NextResponse.json({ profile }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "חסר מזהה פרופיל" }, { status: 400 });
  const before = await prisma.emailMappingProfile.findUnique({ where: { id: body.id } });
  if (!before) return NextResponse.json({ error: "הפרופיל לא נמצא" }, { status: 404 });
  const profile = await prisma.emailMappingProfile.update({ where: { id: body.id }, data: { ...(body.name !== undefined && { name: String(body.name).trim() }), ...(body.mapping !== undefined && { mapping: body.mapping }), ...(body.enabled !== undefined && { enabled: Boolean(body.enabled) }), ...(body.priority !== undefined && { priority: Number(body.priority) || 0 }) } });
  await prisma.auditLog.create({ data: { userId: (session.user as any).id, action: "UPDATE", entity: "EmailMappingProfile", entityId: profile.id, before: before as any, after: profile as any } });
  return NextResponse.json({ profile });
}

export async function DELETE(request: NextRequest) {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר מזהה פרופיל" }, { status: 400 });
  const before = await prisma.emailMappingProfile.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "הפרופיל לא נמצא" }, { status: 404 });
  await prisma.emailMappingProfile.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: (session.user as any).id, action: "DELETE", entity: "EmailMappingProfile", entityId: id, before: before as any } });
  return NextResponse.json({ success: true });
}

