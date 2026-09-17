import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "orders", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const order = await prisma.order.update({ where: { id }, data: { status: body.status, title: body.title, total: body.total !== undefined ? Number(body.total) : undefined, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined, notes: body.notes } });
  if (body.scheduledAt !== undefined) {
    const existing = await prisma.appointment.findFirst({ where: { orderId: id } });
    if (existing) await prisma.appointment.update({ where: { id: existing.id }, data: { startAtUtc: new Date(body.scheduledAt), status: "SCHEDULED" } });
    else await prisma.appointment.create({ data: { orderId: id, customerId: order.customerId, type: "TECHNICIAN_SERVICE", title: `${order.orderNumber} — ${order.title}`, startAtUtc: new Date(body.scheduledAt), timezone: "Asia/Jerusalem", status: "SCHEDULED" } });
  }
  return NextResponse.json({ order });
}

