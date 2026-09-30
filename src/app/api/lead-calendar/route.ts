import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "leads", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await req.json();
  const event = await prisma.leadCalendarEvent.create({ data: { leadId: body.leadId, title: body.title || "יצירת קשר עם ליד", type: "LEAD_SALES", startAtUtc: new Date(body.startAt), endAtUtc: body.endAt ? new Date(body.endAt) : null, timezone: body.timezone || "Asia/Jerusalem", notes: body.notes || null, assignedToId: (session.user as any).id } });
  return NextResponse.json({ event }, { status: 201 });
}

