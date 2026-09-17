import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function addMonths(date: Date, months: number) { const next = new Date(date); next.setMonth(next.getMonth() + months); return next; }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const before = await prisma.serviceTask.findUnique({ where: { id }, include: { customer: true } });
  if (!before) return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
  const completed = body.status === "COMPLETED";
  const completedAt = completed ? (before.completedAt || new Date()) : body.completedAt ? new Date(body.completedAt) : undefined;
  const nextDue = body.nextServiceDueDate ? new Date(body.nextServiceDueDate) : (completed && (before.type === "FILTER_REPLACEMENT" || before.type === "INSTALLATION") ? addMonths(completedAt || new Date(), body.cycleMonths === 12 ? 12 : 6) : undefined);
  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.serviceTask.update({ where: { id }, data: {
      ...(body.status ? { status: body.status } : {}), ...(body.technicianId !== undefined ? { technicianId: body.technicianId || null } : {}),
      ...(body.manualTechnicianName !== undefined ? { manualTechnicianName: body.manualTechnicianName || null } : {}),
      ...(body.scheduledStart !== undefined ? { scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null } : {}),
      ...(body.scheduledEnd !== undefined ? { scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null } : {}),
      ...(body.executionNotes !== undefined ? { executionNotes: body.executionNotes || null } : {}),
      ...(body.partsReplaced !== undefined ? { partsReplaced: body.partsReplaced } : {}),
      ...(nextDue ? { nextServiceDueDate: nextDue } : {}), ...(completedAt ? { completedAt } : {}),
    }, include: { customer: true, technician: { select: { id: true, name: true, phone: true } } } });
    if (completed) {
      await tx.activity.create({ data: { customerId: before.customerId, userId: (session.user as any).id, type: "SYSTEM", subject: `${updated.title} הושלם`, description: [updated.executionNotes, Array.isArray(updated.partsReplaced) && updated.partsReplaced.length ? `חלקים שהוחלפו: ${JSON.stringify(updated.partsReplaced)}` : null, updated.nextServiceDueDate ? `טיפול הבא: ${updated.nextServiceDueDate.toLocaleDateString("he-IL")}` : null].filter(Boolean).join("\n") } });
      if (updated.nextServiceDueDate && updated.type === "FILTER_REPLACEMENT") await tx.installedSystem.updateMany({ where: { customerId: before.customerId }, data: { nextFilterChangeDate: updated.nextServiceDueDate } });
    }
    return updated;
  });
  return NextResponse.json({ task });
}

