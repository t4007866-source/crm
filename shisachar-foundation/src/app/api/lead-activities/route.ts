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
  const item = await prisma.leadActivity.create({ data: { leadId: body.leadId, type: body.type || "NOTE", subject: body.subject, body: body.body, outcome: body.outcome || null, channel: body.channel || null, nextContactAt: body.nextContactAt ? new Date(body.nextContactAt) : null, createdById: (session.user as any).id } });
  return NextResponse.json({ item }, { status: 201 });
}

