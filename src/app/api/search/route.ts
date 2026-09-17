import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const user = session.user as any; const q = (request.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const leadScope = user.role === "SALES_REP" ? { assignedToId: user.id } : {};
  const customerScope = user.role === "SALES_REP" ? { assignedToId: user.id } : {};
  const [customers, leads, orders, calls, technicians] = await Promise.all([
    prisma.customer.findMany({ where: { AND: [customerScope, { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } }] }] }, take: 8, select: { id: true, name: true, phone: true, city: true, status: true } }),
    prisma.lead.findMany({ where: { AND: [leadScope, { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] }] }, take: 8, select: { id: true, name: true, phone: true, stage: true } }),
    prisma.order.findMany({ where: { orderNumber: { contains: q, mode: "insensitive" } }, take: 8, select: { id: true, orderNumber: true, title: true, status: true } }),
    prisma.serviceCall.findMany({ where: { callNumber: { contains: q, mode: "insensitive" } }, take: 8, select: { id: true, callNumber: true, status: true, fault: true } }),
    prisma.user.findMany({ where: { role: "TECHNICIAN", name: { contains: q, mode: "insensitive" } }, take: 8, select: { id: true, name: true, role: true } }),
  ]);
  return NextResponse.json({ results: [
    ...customers.map((x: any) => ({ type: "customer", label: x.name, detail: `${x.phone}${x.city ? ` · ${x.city}` : ""}`, href: `/customers/${x.id}` })),
    ...leads.map((x: any) => ({ type: "lead", label: x.name, detail: `${x.phone || "ללא טלפון"} · ${x.stage}`, href: `/leads/${x.id}` })),
    ...orders.map((x: any) => ({ type: "order", label: x.orderNumber, detail: `${x.title} · ${x.status}`, href: `/orders/${x.id}` })),
    ...calls.map((x: any) => ({ type: "service", label: x.callNumber, detail: `${x.status}${x.fault ? ` · ${x.fault}` : ""}`, href: `/service-calendar` })),
    ...technicians.map((x: any) => ({ type: "technician", label: x.name, detail: "טכנאי", href: `/technicians` })),
  ] });
}

