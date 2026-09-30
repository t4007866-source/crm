import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function guard() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { response: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  if (!can(user.role || "", "automations", "view")) return { response: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await guard();
  if (auth.response) return auth.response;
  const runs = await prisma.automationRun.findMany({ include: { automation: { select: { name: true } } }, orderBy: { startedAt: "desc" }, take: 50 });
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const body = await req.json();
  const automation = await prisma.automation.findUnique({ where: { id: body.automationId } });
  if (!automation) return NextResponse.json({ error: "אוטומציה לא נמצאה" }, { status: 404 });
  const entityType = body.entityType ? String(body.entityType) : null;
  const entityId = body.entityId ? String(body.entityId) : null;
  const idempotencyKey = String(body.idempotencyKey || `test:${automation.id}:${entityType || "sample"}:${entityId || "sample"}`);
  const existing = await prisma.automationRun.findUnique({ where: { idempotencyKey } });
  if (existing) return NextResponse.json({ run: existing, duplicate: true });
  const isTest = body.mode !== "execute";
  const result = Array.isArray(automation.actions) ? (automation.actions as unknown[]).map((action) => ({ action, status: "PREVIEW_ONLY", executed: false })) : [];
  const run = await prisma.automationRun.create({ data: { automationId: automation.id, entityType, entityId, idempotencyKey, status: isTest ? "TEST_PREVIEW" : "PENDING_APPROVAL", triggerData: body.triggerData || { source: "manual" }, actionsResult: result as any, attempts: 0, finishedAt: isTest ? new Date() : null } });
  await prisma.auditLog.create({ data: { userId: auth.user.id as string, action: isTest ? "AUTOMATION_PREVIEW" : "AUTOMATION_RUN_REQUESTED", entity: "AutomationRun", entityId: run.id, after: run as unknown as object } });
  return NextResponse.json({ run, preview: isTest }, { status: 201 });
}



