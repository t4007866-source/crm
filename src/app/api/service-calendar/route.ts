import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "serviceCalendar", "view")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const [appointments, calls, tasks] = await Promise.all([
    prisma.appointment.findMany({
      include: { customer: true, installedSystem: true, technician: { select: { id: true, name: true, phone: true } } },
      orderBy: { startAtUtc: "asc" },
      take: 500,
    }),
    prisma.serviceCall.findMany({
      include: { customer: true, installedSystem: true, technician: { select: { id: true, name: true, phone: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 500,
    }),
    prisma.serviceTask.findMany({
      where: { scheduledStart: { not: null } },
      include: { customer: true, technician: { select: { id: true, name: true, phone: true } } },
      orderBy: { scheduledStart: "asc" },
      take: 1000,
    }),
  ]);

  const appointmentEvents = appointments.map((item) => ({
    id: `appointment-${item.id}`,
    sourceId: item.id,
    kind: item.type,
    title: item.title,
    start: item.startAtUtc,
    end: item.endAtUtc,
    status: item.status,
    customer: item.customer,
    system: item.installedSystem,
    technician: item.technician,
    technicianId: item.technicianId,
  }));

  const callEvents = calls
    .filter((item) => item.scheduledAt)
    .map((item) => ({
      id: `call-${item.id}`,
      sourceId: item.id,
      kind: item.type,
      title: `${item.callNumber} — ${item.fault || "קריאת שירות"}`,
      start: item.scheduledAt,
      end: null,
      status: item.status,
      customer: item.customer,
      system: item.installedSystem,
      technician: item.technician,
      technicianId: item.technicianId,
    }));

  const taskEvents = tasks.map((item) => ({
    id: `task-${item.id}`,
    sourceId: item.id,
    kind: item.type === "INSTALLATION" ? "INSTALLATION" : item.type === "FILTER_REPLACEMENT" ? "FILTER_REPLACEMENT" : "TECHNICIAN_SERVICE",
    title: item.title,
    start: item.scheduledStart,
    end: item.scheduledEnd,
    status: item.status,
    customer: item.customer,
    system: null,
    technician: item.technician,
    technicianId: item.technicianId,
    region: item.region,
  }));

  return NextResponse.json({ events: [...appointmentEvents, ...callEvents, ...taskEvents] });
}





