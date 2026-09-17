import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "customers", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const before = await prisma.serviceCall.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "קריאת שירות לא נמצאה" }, { status: 404 });

  const call = await prisma.$transaction(async (tx) => {
    const updated = await tx.serviceCall.update({
      where: { id },
      data: {
        ...(body.type ? { type: body.type } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.fault !== undefined ? { fault: body.fault || null, description: body.description || body.fault || null } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.treatmentNotes !== undefined ? { treatmentNotes: body.treatmentNotes || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
        ...(body.cost !== undefined ? { cost: body.cost === "" || body.cost === null ? null : Number(body.cost) } : {}),
        ...(body.technicianId !== undefined ? { technicianId: body.technicianId || null } : {}),
        ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null } : {}),
        ...(body.status === "COMPLETED" ? { completedAt: before.completedAt || new Date() } : {}),
      },
    });

    if (body.scheduledAt !== undefined || body.technicianId !== undefined || body.status !== undefined) {
      const appointment = await tx.appointment.findFirst({ where: { customerId: before.customerId, title: { startsWith: before.callNumber } } });
      const appointmentData = {
        ...(body.scheduledAt !== undefined ? { startAtUtc: body.scheduledAt ? new Date(body.scheduledAt) : new Date() } : {}),
        ...(body.technicianId !== undefined ? { technicianId: body.technicianId || null } : {}),
        ...(body.status ? { status: body.status === "CANCELLED" ? "CANCELLED" : body.status === "COMPLETED" ? "COMPLETED" : "SCHEDULED" } : {}),
      };
      if (appointment) await tx.appointment.update({ where: { id: appointment.id }, data: appointmentData });
      else if (updated.scheduledAt && updated.status !== "CANCELLED") await tx.appointment.create({ data: { customerId: updated.customerId, installedSystemId: updated.installedSystemId, technicianId: updated.technicianId, type: updated.type === "FILTER_CHANGE" ? "FILTER_REPLACEMENT" : "TECHNICIAN_SERVICE", title: `${updated.callNumber} — ${updated.fault || updated.type}`, startAtUtc: updated.scheduledAt, timezone: "Asia/Jerusalem", status: "SCHEDULED", notes: updated.notes || updated.treatmentNotes } });
    }

    await tx.auditLog.create({ data: { userId: (session.user as any).id, action: "UPDATE", entity: "ServiceCall", entityId: id, before: before as any, after: updated as any } });
    return updated;
  });

  return NextResponse.json({ call });
}

