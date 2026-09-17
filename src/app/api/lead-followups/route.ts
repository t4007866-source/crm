import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const steps = [
  { attemptNumber: 1, channel: "CALL", offsetHours: 2, templateKey: null },
  { attemptNumber: 2, channel: "CALL", offsetHours: 5, templateKey: null },
  { attemptNumber: 3, channel: "CALL", offsetHours: 26, templateKey: null },
  { attemptNumber: 4, channel: "WHATSAPP", offsetHours: 48, templateKey: "lead_followup_reply" },
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "leads", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const leadId = new URL(req.url).searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId חסר" }, { status: 400 });
  const followUps = await prisma.leadFollowUp.findMany({ where: { leadId }, orderBy: { scheduledAt: "asc" } });
  return NextResponse.json({ followUps });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "leads", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await req.json();
  const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
  if (!lead) return NextResponse.json({ error: "ליד לא נמצא" }, { status: 404 });
  if (lead.optedOut || ["WON", "LOST"].includes(lead.stage)) return NextResponse.json({ error: "הרצף נעצר עבור ליד זה" }, { status: 409 });

  const existing = await prisma.leadFollowUp.findMany({ where: { leadId: lead.id }, orderBy: { attemptNumber: "desc" }, take: 1 });
  const nextAttempt = (existing[0]?.attemptNumber || 0) + 1;
  const step = steps[Math.min(nextAttempt - 1, steps.length - 1)];
  const scheduledAt = new Date(Date.now() + (body.delayHours ?? step.offsetHours) * 60 * 60 * 1000);
  const followUp = await prisma.leadFollowUp.create({ data: { leadId: lead.id, attemptNumber: nextAttempt, channel: body.channel || step.channel as any, scheduledAt, templateKey: body.templateKey ?? step.templateKey, assignedToId: (session.user as any).id } });
  await prisma.lead.update({ where: { id: lead.id }, data: { noAnswerAttempt: Math.min(nextAttempt, 3), stage: nextAttempt <= 3 ? ("CONTACTED" as any) : ("PROPOSAL" as any) } });
  return NextResponse.json({ followUp }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "leads", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await req.json();
  const followUp = await prisma.leadFollowUp.update({ where: { id: body.id }, data: { status: body.status, result: body.result || undefined, completedAt: body.status === "COMPLETED" ? new Date() : undefined, notes: body.notes } });
  if (["ANSWERED", "CALLBACK_REQUESTED"].includes(body.result)) await prisma.lead.update({ where: { id: followUp.leadId }, data: { stage: "CONTACTED", noAnswerAttempt: 0 } });
  if (["NOT_INTERESTED", "OPTED_OUT"].includes(body.result)) await prisma.lead.update({ where: { id: followUp.leadId }, data: { optedOut: body.result === "OPTED_OUT", stage: "LOST", lostReason: body.result } });
  return NextResponse.json({ followUp });
}

