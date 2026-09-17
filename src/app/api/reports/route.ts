import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfPeriod(period: string) {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const period = params.get("period") || "month";
  const source = params.get("source") || "";
  const status = params.get("status") || "";
  const city = params.get("city") || "";
  const from = params.get("from") ? new Date(`${params.get("from")}T00:00:00`) : startOfPeriod(period);
  const to = params.get("to") ? new Date(`${params.get("to")}T23:59:59.999`) : new Date();

  const customerWhere: any = { createdAt: { gte: from, lte: to } };
  const leadWhere: any = { createdAt: { gte: from, lte: to } };
  const orderWhere: any = { createdAt: { gte: from, lte: to } };
  const serviceWhere: any = { createdAt: { gte: from, lte: to } };
  if (source) { customerWhere.source = source; leadWhere.source = source; }
  if (status) { customerWhere.status = status; }
  if (city) { customerWhere.city = { contains: city, mode: "insensitive" }; leadWhere.city = { contains: city, mode: "insensitive" }; }

  const [
    customers, activeCustomers, leads, openLeads, wonLeads, orders, orderTotals,
    serviceCalls, completedService, overdueFilters, lowStock, sourceRows, statusRows,
    upcomingAppointments, integrationEvents
  ] = await Promise.all([
    prisma.customer.count({ where: customerWhere }),
    prisma.customer.count({ where: { ...customerWhere, status: "ACTIVE" } }),
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.count({ where: { ...leadWhere, stage: { notIn: ["WON", "LOST"] } } }),
    prisma.lead.count({ where: { ...leadWhere, stage: "WON" } }),
    prisma.order.count({ where: orderWhere }),
    prisma.order.aggregate({ where: orderWhere, _sum: { total: true }, _avg: { total: true } }),
    prisma.serviceCall.count({ where: serviceWhere }),
    prisma.serviceCall.count({ where: { ...serviceWhere, status: "COMPLETED" } }),
    prisma.installedSystem.count({ where: { nextFilterChangeDate: { lte: to }, isActive: true } }),
    prisma.inventoryItem.count({ where: { quantityOnHand: { lte: 0 } } }),
    Promise.all(["WEBSITE", "FACEBOOK", "INSTAGRAM", "REFERRAL", "WHATSAPP", "GMAIL", "OTHER"].map(async (value) => ({ source: value, count: await prisma.lead.count({ where: { ...leadWhere, source: value } }) }))),
    Promise.all(["LEAD", "PROSPECT", "ACTIVE", "CHURNED"].map(async (value) => ({ status: value, count: await prisma.customer.count({ where: { ...customerWhere, status: value } }) }))),
    prisma.appointment.count({ where: { startAtUtc: { gte: new Date(), lte: to }, status: "SCHEDULED" } }),
    prisma.integrationEvent.count({ where: { receivedAt: { gte: from, lte: to }, status: "FAILED" } }),
  ]);

  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    kpis: {
      customers, activeCustomers, leads, openLeads, wonLeads, orders,
      revenue: orderTotals._sum.total || 0,
      averageOrder: orderTotals._avg.total || 0,
      serviceCalls, completedService, overdueFilters, lowStock,
      upcomingAppointments, integrationErrors: integrationEvents,
      conversionRate: leads ? Number(((wonLeads / leads) * 100).toFixed(1)) : 0,
    },
    breakdowns: { bySource: sourceRows, byCustomerStatus: statusRows },
  });
}

