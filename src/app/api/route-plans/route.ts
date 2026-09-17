import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  if (!can((session.user as any).role, "serviceMap", "edit")) {
    return { error: NextResponse.json({ error: "אין הרשאה לתכנון מסלולים" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "serviceMap", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const routePlans = await prisma.routePlan.findMany({
    include: { technician: { select: { id: true, name: true } }, stops: { orderBy: { sequence: "asc" } } },
    orderBy: [{ serviceDate: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ routePlans });
}

export async function POST(req: NextRequest) {
  const access = await guard();
  if (access.error) return access.error;
  const body = await req.json();
  if (!body.name || !body.serviceDate || !Array.isArray(body.stops)) {
    return NextResponse.json({ error: "שם, תאריך ותחנות הם שדות חובה" }, { status: 400 });
  }
  const plan = await prisma.routePlan.create({
    data: {
      name: body.name,
      serviceDate: new Date(body.serviceDate),
      technicianId: body.technicianId || null,
      status: body.status || "DRAFT",
      notes: body.notes || null,
      stops: {
        create: body.stops.map((stop: any, index: number) => ({
          sequence: index + 1,
          itemType: String(stop.itemType),
          itemId: String(stop.id),
          title: String(stop.title),
          customerId: stop.customerId || null,
          address: stop.address || null,
          city: stop.city || null,
          lat: Number(stop.lat),
          lng: Number(stop.lng),
          scheduledAt: stop.scheduledAt ? new Date(stop.scheduledAt) : null,
          durationMin: Number(stop.durationMin || 60),
          notes: stop.notes || null,
        })),
      },
    },
    include: { technician: { select: { id: true, name: true } }, stops: { orderBy: { sequence: "asc" } } },
  });
  return NextResponse.json({ plan }, { status: 201 });
}

