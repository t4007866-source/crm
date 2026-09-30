import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const user = session.user as any;
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const day = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
  const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
  const canSeeAll = ["ADMIN", "MANAGER", "DISPATCHER"].includes(user.role);
  const calls = await prisma.serviceCall.findMany({
    where: {
      status: { not: "CANCELLED" },
      scheduledAt: { gte: day, lt: nextDay },
      ...(canSeeAll ? {} : { technicianId: user.id }),
    },
    include: {
      customer: true,
      installedSystem: true,
      technician: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });
  return NextResponse.json({ calls, date: day.toISOString().slice(0, 10) });
}

