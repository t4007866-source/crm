import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const defaults = [
  { name: "ליד חדש — Speed to Lead", module: "leads", description: "יצירת משימה והתראה לנציג", trigger: { type: "record_created", entity: "Lead" }, conditions: [{ field: "phone", op: "not_empty" }], actions: [{ type: "create_task", title: "לחזור לליד תוך 15 דקות" }, { type: "notify_in_app" }], approvalPolicy: { required: false }, safetyPolicy: { cooldownHours: 0, maxRetries: 2 } },
  { name: "ליד ללא מענה", module: "leads", description: "Follow-up והסלמה לליד שלא הגיב", trigger: { type: "no_response", hours: 2 }, conditions: [{ field: "optedOut", op: "eq", value: false }], actions: [{ type: "create_followup" }, { type: "escalate", afterHours: 96 }], approvalPolicy: { required: true }, safetyPolicy: { cooldownHours: 48, maxRetries: 3 } },
  { name: "החלפת סננים מתקרבת", module: "customers", description: "תזכורת פנימית ואישור לפני WhatsApp", trigger: { type: "date_near", field: "nextFilterChangeDate", days: 30 }, conditions: [{ field: "customer.communicationOptOut", op: "eq", value: false }], actions: [{ type: "create_reminder" }, { type: "request_approval" }, { type: "send_whatsapp" }], approvalPolicy: { required: true }, safetyPolicy: { cooldownHours: 48, maxRetries: 2 } },
  { name: "קריאת שירות נפתחה", module: "service", description: "יצירת משימה והתראה לצוות", trigger: { type: "record_created", entity: "ServiceCall" }, conditions: [], actions: [{ type: "create_task" }, { type: "notify_in_app" }], approvalPolicy: { required: false }, safetyPolicy: { cooldownHours: 0, maxRetries: 2 } },
  { name: "מלאי מתחת לסף", module: "inventory", description: "התראה וטיוטת רכש — ללא שינוי מלאי", trigger: { type: "threshold", field: "quantityAvailable", op: "lte", value: "reorderPoint" }, conditions: [], actions: [{ type: "notify_in_app" }, { type: "create_purchase_order_draft" }], approvalPolicy: { required: true }, safetyPolicy: { cooldownHours: 24, maxRetries: 2 } },
];

async function sessionOrError(action: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  const user = session.user as { id?: string; role?: string };
  if (!user.id || !can(user.role || "", "automations", action)) return { error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) };
  return { session, user };
}

function cleanJson(value: any, fallback: any): any {
  return value === undefined || value === null ? fallback : value;
}

export async function GET() {
  const auth = await sessionOrError("view");
  if (auth.error) return auth.error;
  const [automations, totalRuns, successfulRuns, failedRuns, pendingApprovals] = await Promise.all([
    prisma.automation.findMany({ include: { runs: { orderBy: { startedAt: "desc" }, take: 5 } }, orderBy: { updatedAt: "desc" } }),
    prisma.automationRun.count(),
    prisma.automationRun.count({ where: { status: "COMPLETED" } }),
    prisma.automationRun.count({ where: { status: "FAILED" } }),
    prisma.approvalRequest.count({ where: { status: "PENDING" } }),
  ]);
  return NextResponse.json({ automations, templates: defaults, metrics: { totalRuns, successfulRuns, failedRuns, pendingApprovals } });
}

export async function POST(req: NextRequest) {
  const auth = await sessionOrError("create");
  if (auth.error) return auth.error;
  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "שם האוטומציה חובה" }, { status: 400 });
  const automation = await prisma.automation.create({ data: { name, description: body.description || null, module: body.module || "general", status: "DRAFT", trigger: cleanJson(body.trigger, { type: "record_created" }), conditions: cleanJson(body.conditions, []), actions: cleanJson(body.actions, []), approvalPolicy: cleanJson(body.approvalPolicy, { required: false }), safetyPolicy: cleanJson(body.safetyPolicy, { cooldownHours: 24, maxRetries: 2 }), createdById: auth.user.id as string } });
  await prisma.automationVersion.create({ data: { automationId: automation.id, version: 1, snapshot: automation as unknown as object, createdById: auth.user.id as string } });
  await prisma.auditLog.create({ data: { userId: auth.user.id as string, action: "AUTOMATION_CREATED", entity: "Automation", entityId: automation.id, after: automation as unknown as object } });
  return NextResponse.json({ automation }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await sessionOrError("edit");
  if (auth.error) return auth.error;
  const body = await req.json();
  const current = await prisma.automation.findUnique({ where: { id: body.id } });
  if (!current) return NextResponse.json({ error: "אוטומציה לא נמצאה" }, { status: 404 });
  const activating = body.enabled === true || body.status === "ACTIVE";
  if (activating && !can(auth.user.role || "", "automations", "activate")) return NextResponse.json({ error: "רק מנהל יכול להפעיל אוטומציה" }, { status: 403 });
  const version = current.version + 1;
  const automation = await prisma.automation.update({ where: { id: body.id }, data: { name: body.name ?? current.name, description: body.description ?? current.description, module: body.module ?? current.module, trigger: cleanJson(body.trigger, current.trigger), conditions: cleanJson(body.conditions, current.conditions), actions: cleanJson(body.actions, current.actions), approvalPolicy: cleanJson(body.approvalPolicy, current.approvalPolicy), safetyPolicy: cleanJson(body.safetyPolicy, current.safetyPolicy), status: body.status || current.status, enabled: body.enabled ?? current.enabled, version, updatedById: auth.user.id } });
  await prisma.automationVersion.create({ data: { automationId: automation.id, version, snapshot: automation as unknown as object, createdById: auth.user.id as string } });
  await prisma.auditLog.create({ data: { userId: auth.user.id as string, action: activating ? "AUTOMATION_ACTIVATED" : "AUTOMATION_UPDATED", entity: "Automation", entityId: automation.id, before: current as unknown as object, after: automation as unknown as object } });
  return NextResponse.json({ automation });
}




