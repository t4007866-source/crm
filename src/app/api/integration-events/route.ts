import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "integrations", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const events = await prisma.integrationEvent.findMany({ include: { integration: { select: { name: true, key: true } } }, orderBy: { receivedAt: "desc" }, take: 100 });
  return NextResponse.json({ events });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "integrations", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await req.json();
  const event = await prisma.integrationEvent.update({ where: { id }, data: { status: "RETRYING", retryCount: { increment: 1 } } });
  return NextResponse.json({ event });
}

