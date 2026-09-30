import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "orders", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const appointments = await prisma.appointment.findMany({ where: { orderId: { not: null } }, include: { customer: true, order: true }, orderBy: { startAtUtc: "asc" }, take: 200 });
  return NextResponse.json({ appointments });
}

