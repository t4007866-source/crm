import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseAi, canSeeFinancials } from "@/lib/ai/permissions";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const user = session.user as any; const role = String(user.role || "VIEWER");
  if (!canUseAi(role, user.permissions)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id }, include: { orders: { orderBy: { createdAt: "desc" }, take: 10 }, serviceCalls: { orderBy: { openedAt: "desc" }, take: 10 }, installedSystems: { orderBy: { createdAt: "desc" } }, activities: { orderBy: { createdAt: "desc" }, take: 10 } } });
  if (!customer) return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
  if (role === "SALES_REP" && customer.assignedToId !== user.id) return NextResponse.json({ error: "אין הרשאה ללקוח זה" }, { status: 403 });
  const due = customer.installedSystems.filter((s: any) => s.nextFilterChangeDate && new Date(s.nextFilterChangeDate) <= new Date(Date.now() + 30 * 86400000));
  const openCalls = customer.serviceCalls.filter((c: any) => ["OPEN", "SCHEDULED", "IN_PROGRESS"].includes(c.status));
  const next = due.length ? "לתאם החלפת מסנן בתוך 30 יום" : openCalls.length ? "לטפל בקריאת השירות הפתוחה" : "לבצע מעקב יזום מול הלקוח";
  const financial = canSeeFinancials(role) ? ` סך הזמנות: ₪${customer.orders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0).toLocaleString("he-IL")}.` : "";
  const text = `${customer.name} הוא לקוח עם ${customer.orders.length} הזמנות, ${customer.serviceCalls.length} קריאות שירות ו-${customer.installedSystems.length} מערכות מותקנות.${financial} ${due.length ? `מועד החלפת מסנן קרוב או שעבר עבור ${due.length} מערכות.` : "אין כרגע החלפת מסנן דחופה."} ${openCalls.length ? `קיימות ${openCalls.length} קריאות שירות פתוחות.` : "אין קריאות שירות פתוחות."} המלצה: ${next}.`;
  await prisma.auditLog.create({ data: { userId: user.id, action: "AI_CUSTOMER_SUMMARY", entity: "Customer", entityId: id, after: { customerId: id } } });
  return NextResponse.json({ summary: { text, source: "כרטיס לקוח: הזמנות, שירות, מערכות ופעילויות", range: "נתונים עדכניים", nextAction: next, stats: { orders: customer.orders.length, serviceCalls: customer.serviceCalls.length, installedSystems: customer.installedSystems.length, dueFilters: due.length, openCalls: openCalls.length }, orders: canSeeFinancials(role) ? customer.orders : customer.orders.map((o: any) => ({ orderNumber: o.orderNumber, status: o.status, createdAt: o.createdAt })), serviceCalls: customer.serviceCalls, systems: customer.installedSystems } });
}

