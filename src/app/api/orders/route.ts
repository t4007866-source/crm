import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "orders", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as OrderStatus | null;
  const q = searchParams.get("q")?.trim();
  const orders = await prisma.order.findMany({
    where: {
      ...(status && Object.values(OrderStatus).includes(status) ? { status } : {}),
      ...(q ? { OR: [{ orderNumber: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    include: { customer: true, lead: true, assignedTo: true, technician: true, items: true, appointment: true, statusHistory: { orderBy: { createdAt: "desc" }, take: 10 }, payments: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "orders", "create")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = await req.json();
  if (!body.customerId || !body.title) return NextResponse.json({ error: "לקוח וכותרת הזמנה הם חובה" }, { status: 400 });

  const requestedStatus = (body.status || "DRAFT") as OrderStatus;
  if (!Object.values(OrderStatus).includes(requestedStatus)) return NextResponse.json({ error: "סטטוס הזמנה לא תקין" }, { status: 400 });
  const items = Array.isArray(body.items) ? body.items : [];
  const total = Number(body.total || items.reduce((sum: number, i: any) => sum + (Number(i.quantity || 1) * Number(i.unitPrice || 0) - Number(i.discount || 0)), 0));

  const order = await prisma.$transaction(async (tx) => {
    const count = await tx.order.count();
    const created = await tx.order.create({
      data: {
        orderNumber: `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        customerId: body.customerId,
        leadId: body.leadId || null,
        title: body.title,
        status: requestedStatus,
        total,
        discount: Number(body.discount || 0),
        paymentStatus: body.paymentStatus || "PENDING",
        paymentMethod: body.paymentMethod || null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        notes: body.notes || null,
        source: body.source || null,
        assignedToId: body.assignedToId || null,
        technicianId: body.technicianId || null,
        deliveryAddress: body.deliveryAddress || null,
        installationAddress: body.installationAddress || null,
        internalNotes: body.internalNotes || null,
        customerNotes: body.customerNotes || null,
        items: items.length ? { create: items.map((i: any) => ({ name: i.name, productId: i.productId || null, sku: i.sku || null, quantity: Number(i.quantity || 1), unitPrice: Number(i.unitPrice || 0), discount: Number(i.discount || 0), vatRate: Number(i.vatRate ?? 0.17), stockStatus: i.stockStatus || "NOT_APPLICABLE", requiresInstallation: Boolean(i.requiresInstallation), requiresTechnician: Boolean(i.requiresTechnician), warehouseId: i.warehouseId || null, lineTotal: Number(i.lineTotal ?? (Number(i.quantity || 1) * Number(i.unitPrice || 0) - Number(i.discount || 0))) })) } : undefined,
      },
    });
    await tx.orderStatusHistory.create({ data: { orderId: created.id, toStatus: requestedStatus, reason: "יצירת הזמנה" } });
    if (body.scheduledAt) await tx.appointment.create({ data: { customerId: body.customerId, orderId: created.id, type: body.type === "FILTER_REPLACEMENT" ? "FILTER_REPLACEMENT" : "TECHNICIAN_SERVICE", title: `${created.orderNumber} — ${created.title}`, startAtUtc: new Date(body.scheduledAt), endAtUtc: body.endAt ? new Date(body.endAt) : null, timezone: "Asia/Jerusalem", status: "SCHEDULED", technicianId: body.technicianId || null, notes: body.notes || null } });
    return tx.order.findUnique({ where: { id: created.id }, include: { customer: true, items: true, statusHistory: true } });
  });
  return NextResponse.json({ order }, { status: 201 });
}

