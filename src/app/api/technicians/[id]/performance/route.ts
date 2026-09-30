import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "fieldTech", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await params;
  const technician = await prisma.technicianProfile.findUnique({ where: { id } });
  if (!technician) return NextResponse.json({ error: "טכנאי לא נמצא" }, { status: 404 });
  const [total, completed, late] = await Promise.all([
    prisma.serviceCall.count({ where: { technicianId: technician.userId } }),
    prisma.serviceCall.count({ where: { technicianId: technician.userId, status: "COMPLETED" } }),
    prisma.serviceCall.count({ where: { technicianId: technician.userId, status: { in: ["OPEN", "SCHEDULED", "IN_PROGRESS"] }, scheduledAt: { lt: new Date() } } }),
  ]);
  return NextResponse.json({ performance: { total, completed, late, firstVisitRate: null, avgResponseMinutes: null, avgTreatmentMinutes: null } });
}

