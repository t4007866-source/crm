import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "orders", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const orders = await prisma.order.findMany({ include: { customer: true, items: true, appointment: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "orders", "create")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await req.json();
  if (!body.customerId || !body.title) return NextResponse.json({ error: "לקוח וכותרת הזמנה הם חובה" }, { status: 400 });
  const count = await prisma.order.count();
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({ data: { orderNumber: `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`, customerId: body.customerId, title: body.title, status: body.status || "DRAFT", total: Number(body.total || 0), scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, notes: body.notes || null, items: body.items?.length ? { create: body.items.map((i: any) => ({ name: i.name, sku: i.sku || null, quantity: Number(i.quantity || 1), unitPrice: Number(i.unitPrice || 0), discount: Number(i.discount || 0), vatRate: Number(i.vatRate || 0.17), stockStatus: i.stockStatus || "NOT_APPLICABLE" })) } : undefined } });
    if (body.scheduledAt) await tx.appointment.create({ data: { customerId: body.customerId, orderId: created.id, type: body.type === "FILTER_REPLACEMENT" ? "FILTER_REPLACEMENT" : "TECHNICIAN_SERVICE", title: `${created.orderNumber} — ${created.title}`, startAtUtc: new Date(body.scheduledAt), endAtUtc: body.endAt ? new Date(body.endAt) : null, timezone: "Asia/Jerusalem", status: "SCHEDULED", notes: body.notes || null } });
    return created;
  });
  return NextResponse.json({ order }, { status: 201 });
}

