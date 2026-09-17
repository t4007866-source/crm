import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { TechnicianProfileStatus, Role } from "@prisma/client";

export const dynamic = "force-dynamic";
async function guard(action = "view") { const s = await getServerSession(authOptions); if (!s) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) }; if (!can((s.user as any).role, "fieldTech", action)) return { error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) }; return { session: s }; }
export async function GET(req: NextRequest) {
  const g = await guard(); if (g.error) return g.error;
  const q = new URL(req.url).searchParams; const status = q.get("status"); const region = q.get("region");
  const technicians = await prisma.technicianProfile.findMany({ where: { ...(status && Object.values(TechnicianProfileStatus).includes(status as TechnicianProfileStatus) ? { status: status as TechnicianProfileStatus } : {}), ...(region ? { baseRegion: { contains: region, mode: "insensitive" } } : {}) }, include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true } }, skills: { where: { isActive: true } }, serviceAreas: { where: { isActive: true } }, locations: { orderBy: { recordedAt: "desc" }, take: 1 }, _count: { select: { assignments: true } } }, orderBy: { updatedAt: "desc" } });
  const today = new Date(); today.setHours(0,0,0,0); const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const ids = technicians.map(t => t.userId); const calls = await prisma.serviceCall.groupBy({ by: ["technicianId"], where: { technicianId: { in: ids }, scheduledAt: { gte: today, lt: tomorrow } }, _count: { _all: true } }); const open = await prisma.serviceCall.groupBy({ by: ["technicianId"], where: { technicianId: { in: ids }, status: { in: ["OPEN", "SCHEDULED", "IN_PROGRESS"] } }, _count: { _all: true } });
  const result = technicians.map(t => ({ ...t, callsToday: calls.find(x => x.technicianId === t.userId)?._count._all || 0, openCalls: open.find(x => x.technicianId === t.userId)?._count._all || 0, rating: null }));
  return NextResponse.json({ technicians: result });
}
export async function POST(req: NextRequest) {
  const g = await guard("create"); if (g.error) return g.error; const b = await req.json();
  if (!b.name || !b.email) return NextResponse.json({ error: "שם ואימייל הם חובה" }, { status: 400 });
  try { const user = await prisma.user.create({ data: { name: b.name, email: String(b.email).trim().toLowerCase(), phone: b.phone || null, passwordHash: await bcrypt.hash(b.password || "ChangeMe!2026", 12), role: Role.TECHNICIAN, emailVerified: new Date(), permissions: {} } }); const profile = await prisma.technicianProfile.create({ data: { userId: user.id, employeeNumber: b.employeeNumber || null, phone: b.phone || null, status: b.status || "ACTIVE", baseAddress: b.baseAddress || null, baseCity: b.baseCity || null, baseRegion: b.baseRegion || null, serviceRadiusKm: b.serviceRadiusKm ? Number(b.serviceRadiusKm) : null, teamName: b.teamName || null, employmentType: b.employmentType || null, startedAt: b.startedAt ? new Date(b.startedAt) : null, notes: b.notes || null, maxCallsPerDay: b.maxCallsPerDay ? Number(b.maxCallsPerDay) : null, emergencyAvailable: Boolean(b.emergencyAvailable) } }); return NextResponse.json({ technician: profile }, { status: 201 }); } catch (e: any) { return NextResponse.json({ error: e.code === "P2002" ? "האימייל או מספר העובד כבר קיימים" : "יצירת הטכנאי נכשלה" }, { status: 400 }); }
}


