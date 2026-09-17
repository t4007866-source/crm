import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { OrderStatus } from "@prisma/client";
import { canMoveOrder } from "@/lib/order-workflow";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "orders", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { customer: true, lead: true, assignedTo: true, technician: true, items: { include: { product: true } }, appointment: true, statusHistory: { orderBy: { createdAt: "desc" } }, payments: { orderBy: { createdAt: "desc" } }, attachments: { orderBy: { createdAt: "desc" } }, shipments: true, approvals: true, returns: true } });
  if (!order) return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const role = (session.user as any).role;
  if (!can(role, "orders", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });

  const nextStatus = body.status as OrderStatus | undefined;
  if (nextStatus && (!Object.values(OrderStatus).includes(nextStatus) || !canMoveOrder(existing.status, nextStatus))) {
    return NextResponse.json({ error: `מעבר לא חוקי: ${existing.status} → ${nextStatus}` }, { status: 400 });
  }
  if (nextStatus && ["APPROVED", "CONFIRMED", "PAID"].includes(nextStatus) && !can(role, "orders", "approve")) {
    return NextResponse.json({ error: "רק מנהל או משתמש עם הרשאת אישור יכול לאשר הזמנה" }, { status: 403 });
  }

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({ where: { id }, data: { status: nextStatus, title: body.title, total: body.total !== undefined ? Number(body.total) : undefined, discount: body.discount !== undefined ? Number(body.discount) : undefined, paymentStatus: body.paymentStatus, paymentMethod: body.paymentMethod, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : body.scheduledAt === null ? null : undefined, deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : body.deliveryDate === null ? null : undefined, notes: body.notes, source: body.source, assignedToId: body.assignedToId, technicianId: body.technicianId, deliveryAddress: body.deliveryAddress, installationAddress: body.installationAddress, internalNotes: body.internalNotes, customerNotes: body.customerNotes, approvedAt: nextStatus && ["APPROVED", "CONFIRMED"].includes(nextStatus) ? new Date() : undefined } });
    if (nextStatus && nextStatus !== existing.status) await tx.orderStatusHistory.create({ data: { orderId: id, fromStatus: existing.status, toStatus: nextStatus, changedById: (session.user as any).id || null, reason: body.reason || null } });
    if (body.scheduledAt !== undefined) {
      const current = await tx.appointment.findFirst({ where: { orderId: id } });
      if (body.scheduledAt === null) { if (current) await tx.appointment.delete({ where: { id: current.id } }); }
      else if (current) await tx.appointment.update({ where: { id: current.id }, data: { startAtUtc: new Date(body.scheduledAt), status: "SCHEDULED", technicianId: body.technicianId || undefined } });
      else await tx.appointment.create({ data: { orderId: id, customerId: updated.customerId, type: "TECHNICIAN_SERVICE", title: `${updated.orderNumber} — ${updated.title}`, startAtUtc: new Date(body.scheduledAt), timezone: "Asia/Jerusalem", status: "SCHEDULED", technicianId: body.technicianId || null } });
    }
    return tx.order.findUnique({ where: { id }, include: { customer: true, lead: true, assignedTo: true, technician: true, items: true, appointment: true, statusHistory: { orderBy: { createdAt: "desc" } } } });
  });
  return NextResponse.json({ order });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const role = (session.user as any).role;
  if (!can(role, "orders", "delete")) return NextResponse.json({ error: "אין הרשאה למחיקת הזמנות" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.order.findUnique({ where: { id }, select: { id: true, orderNumber: true } });
  if (!existing) return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // Appointment is optional but its relation is not configured with cascade delete.
    await tx.appointment.deleteMany({ where: { orderId: id } });
    await tx.orderStatusHistory.deleteMany({ where: { orderId: id } });
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await tx.payment.deleteMany({ where: { orderId: id } });
    await tx.orderAttachment.deleteMany({ where: { orderId: id } });
    await tx.orderShipment.deleteMany({ where: { orderId: id } });
    await tx.orderApproval.deleteMany({ where: { orderId: id } });
    await tx.returnRequest.deleteMany({ where: { orderId: id } });
    await tx.order.delete({ where: { id } });
  });

  return NextResponse.json({ success: true, orderId: id, orderNumber: existing.orderNumber });
}


