import { LeadStage, Prisma } from "@prisma/client";
import { canSeeFinancials } from "./permissions";

type Ctx = { role: string; userId: string };
type Answer = { text: string; source: string; range: string; rows?: Array<Record<string, unknown>>; action?: { type: string; label: string; requiresApproval: true } };

function rangeLabel(from: Date, to: Date) {
  return `${from.toLocaleDateString("he-IL")}–${to.toLocaleDateString("he-IL")}`;
}
function period(text: string) {
  const now = new Date(); const from = new Date(now); from.setHours(0, 0, 0, 0);
  if (/שבוע|week/i.test(text)) from.setDate(from.getDate() - 6);
  else if (/חודש|month/i.test(text)) from.setDate(1);
  else if (/רבעון|quarter/i.test(text)) from.setMonth(Math.floor(from.getMonth() / 3) * 3, 1);
  return { from, to: now };
}
function scope(ctx: Ctx): Prisma.LeadWhereInput {
  return ctx.role === "SALES_REP" ? { assignedToId: ctx.userId } : {};
}
function customerScope(ctx: Ctx): Prisma.CustomerWhereInput {
  return ctx.role === "SALES_REP" ? { assignedToId: ctx.userId } : {};
}

export async function answerQuestion(prisma: any, question: string, ctx: Ctx): Promise<Answer> {
  const q = question.trim(); const { from, to } = period(q); const range = rangeLabel(from, to);
  const leadWhere = { AND: [scope(ctx), { createdAt: { gte: from, lte: to } }] };
  const customerWhere = { AND: [customerScope(ctx), { createdAt: { gte: from, lte: to } }] };
  if (/מסנן|פילטר/.test(q)) {
    const systems = await prisma.installedSystem.findMany({ where: { isActive: true, nextFilterChangeDate: { lte: to } }, include: { customer: true }, orderBy: { nextFilterChangeDate: "asc" }, take: 100 });
    return { text: `נמצאו ${systems.length} לקוחות שמועד החלפת המסנן שלהם הגיע.`, source: "מודול מערכות מותקנות והחלפת מסננים", range, rows: systems.map((s: any) => ({ name: s.customer.name, phone: s.customer.phone, due: s.nextFilterChangeDate })) };
  }
  if (/הזמנות.*ממתינ|ממתינ.*הזמנות/.test(q)) {
    const orders = await prisma.order.findMany({ where: { status: { in: ["PENDING_APPROVAL", "PENDING_PAYMENT", "PENDING_STOCK"] } }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 100 });
    return { text: `נמצאו ${orders.length} הזמנות שממתינות לטיפול.`, source: "מודול הזמנות", range, rows: orders.map((o: any) => ({ orderNumber: o.orderNumber, customer: o.customer.name, status: o.status, total: o.total })) };
  }
  if (/טכנאי.*עמוס|עמוס.*טכנאי/.test(q)) {
    const users = await prisma.user.findMany({ where: { role: "TECHNICIAN", isActive: true }, include: { serviceTechnicianCalls: { where: { status: { in: ["OPEN", "SCHEDULED", "IN_PROGRESS"] } } } } });
    const rows = users.map((u: any) => ({ technician: u.name, openCalls: u.serviceTechnicianCalls.length })).sort((a: any, b: any) => b.openCalls - a.openCalls);
    return { text: rows[0] ? `${rows[0].technician} הוא הטכנאי העמוס ביותר עם ${rows[0].openCalls} קריאות פעילות.` : "לא נמצאו טכנאים עם קריאות פעילות.", source: "מודול קריאות שירות", range, rows };
  }
  if (/קריאות.*איחור|באיחור/.test(q)) {
    const calls = await prisma.serviceCall.findMany({ where: { status: { in: ["OPEN", "SCHEDULED", "IN_PROGRESS"] }, scheduledAt: { lt: new Date() } }, include: { customer: true, technician: true }, orderBy: { scheduledAt: "asc" }, take: 100 });
    return { text: `נמצאו ${calls.length} קריאות שירות באיחור.`, source: "מודול קריאות שירות", range, rows: calls.map((c: any) => ({ callNumber: c.callNumber, customer: c.customer.name, technician: c.technician?.name || "לא שובץ", scheduledAt: c.scheduledAt })) };
  }
  if (/הכנסות|הכנסה/.test(q)) {
    if (!canSeeFinancials(ctx.role)) return { text: "הנתון הפיננסי זמין למנהלים ול-Admin בלבד.", source: "הרשאות מערכת", range };
    const result = await prisma.order.aggregate({ where: { createdAt: { gte: from, lte: to }, status: { not: "CANCELLED" } }, _sum: { total: true }, _count: { _all: true } });
    return { text: `ההכנסות בתקופה הן ₪${Number(result._sum.total || 0).toLocaleString("he-IL")} מתוך ${result._count._all} הזמנות.`, source: "מודול הזמנות", range };
  }
  if (/לא קיבלו מענה|ללא מענה|מענה/.test(q)) {
    const leads = await prisma.lead.findMany({ where: { AND: [scope(ctx), { noAnswerAttempt: { gt: 0 }, stage: { notIn: [LeadStage.WON, LeadStage.LOST] } }] }, orderBy: { updatedAt: "asc" }, take: 100 });
    return { text: `נמצאו ${leads.length} לידים ללא מענה מספק.`, source: "מודול לידים", range, rows: leads.map((l: any) => ({ name: l.name, phone: l.phone, attempts: l.noAnswerAttempt, stage: l.stage })) };
  }
  if (/ליד|leads/i.test(q)) {
    const count = await prisma.lead.count({ where: leadWhere });
    return { text: `נמצאו ${count} לידים חדשים בתקופה.`, source: "מודול לידים", range };
  }
  const [customers, openCalls, pendingOrders] = await Promise.all([
    prisma.customer.count({ where: customerWhere }),
    prisma.serviceCall.count({ where: { status: { in: ["OPEN", "SCHEDULED", "IN_PROGRESS"] } } }),
    prisma.order.count({ where: { status: { in: ["PENDING_APPROVAL", "PENDING_PAYMENT", "PENDING_STOCK"] } } }),
  ]);
  return { text: `מצאתי ${customers} לקוחות חדשים, ${openCalls} קריאות שירות פתוחות ו-${pendingOrders} הזמנות ממתינות. נסה לשאול על לידים, מסננים, הזמנות, טכנאים או הכנסות.`, source: "לוח בקרה ומודולי CRM", range };
}

