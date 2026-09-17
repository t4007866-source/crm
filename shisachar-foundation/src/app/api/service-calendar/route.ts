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

  const [appointments, calls] = await Promise.all([
    prisma.appointment.findMany({
      include: { customer: true, installedSystem: true },
      orderBy: { startAtUtc: "asc" },
      take: 500,
    }),
    prisma.serviceCall.findMany({
      include: { customer: true, installedSystem: true },
      orderBy: { scheduledAt: "asc" },
      take: 500,
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
    }));

  return NextResponse.json({ events: [...appointmentEvents, ...callEvents] });
}

