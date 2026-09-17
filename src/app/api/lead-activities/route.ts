import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const actor = session.user as any;
  if (!can(actor.role, "leads", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = await req.json();
  const leadId = String(body.leadId || "");
  const subject = String(body.subject || "").trim();
  const noteBody = String(body.body || "").trim();
  if (!leadId || !subject || !noteBody) return NextResponse.json({ error: "נושא ותוכן ההערה הם שדות חובה" }, { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "ליד לא נמצא" }, { status: 404 });

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.leadActivity.create({
      data: {
        leadId,
        type: body.type || "NOTE",
        subject,
        body: noteBody,
        outcome: body.outcome || null,
        channel: body.channel || null,
        nextContactAt: body.nextContactAt ? new Date(body.nextContactAt) : null,
        createdById: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "CREATE_NOTE",
        entity: "LeadActivity",
        entityId: created.id,
        after: { leadId, subject, type: created.type },
      },
    });
    return created;
  });

  return NextResponse.json({ item }, { status: 201 });
}

