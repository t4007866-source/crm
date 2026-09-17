import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { LeadSource, LeadStage, Confidence, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const sessionUser = (session: any) => session?.user as { id: string; role: string };
const jsonSafe = (value: unknown) => JSON.parse(JSON.stringify(value));
const normalizePhone = (value: unknown) => String(value ?? "").replace(/\D/g, "").replace(/^972/, "0");

function enumValue<T extends Record<string, string>>(values: T, value: unknown, fallback: T[keyof T]): T[keyof T] {
  return typeof value === "string" && Object.values(values).includes(value as T[keyof T])
    ? (value as T[keyof T])
    : fallback;
}

export async function GET(_req: NextRequest, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can(sessionUser(session).role, "leads", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      customer: true,
      followUps: { orderBy: { scheduledAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" } },
      contactAttempts: { orderBy: { attemptedAt: "desc" } },
      calendarEvents: { orderBy: { startAtUtc: "desc" } },
    },
  });
  if (!lead) return NextResponse.json({ error: "ליד לא נמצא" }, { status: 404 });

  const creatorIds = [...new Set(lead.activities.map((activity) => activity.createdById).filter(Boolean))] as string[];
  const users = creatorIds.length
    ? await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  const activities = lead.activities.map((activity) => ({ ...activity, createdBy: activity.createdById ? userMap.get(activity.createdById) ?? null : null }));

  let convertedCustomer = null;
  if (lead.convertedCustomerId) {
    convertedCustomer = await prisma.customer.findUnique({ where: { id: lead.convertedCustomerId } });
  }

  return NextResponse.json({ ...lead, activities, convertedCustomer });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const actor = sessionUser(session);
  if (!can(actor.role, "leads", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const before = await prisma.lead.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "ליד לא נמצא" }, { status: 404 });

  const data: Prisma.LeadUpdateInput = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "שם הליד הוא שדה חובה" }, { status: 400 });
    data.name = name;
  }
  for (const key of ["company", "email", "city", "notes", "currentSystem"] as const) {
    if (body[key] !== undefined) data[key] = body[key] === "" ? null : String(body[key]).trim();
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (!phone) return NextResponse.json({ error: "טלפון הוא שדה חובה למניעת כפילויות" }, { status: 400 });
    const normalized = normalizePhone(phone);
    const duplicate = await prisma.lead.findFirst({
      where: { id: { not: id }, stage: { not: LeadStage.LOST }, phone: { not: null } },
      select: { id: true, name: true, phone: true },
    });
    if (duplicate && normalizePhone(duplicate.phone) === normalized) {
      return NextResponse.json({ error: "כבר קיים ליד פעיל עם מספר הטלפון הזה", duplicateId: duplicate.id }, { status: 409 });
    }
    data.phone = phone;
  }
  if (body.source !== undefined) data.source = enumValue(LeadSource, body.source, before.source);
  if (body.stage !== undefined) data.stage = enumValue(LeadStage, body.stage, before.stage);
  if (body.confidence !== undefined) data.confidence = enumValue(Confidence, body.confidence, before.confidence);
  if (body.value !== undefined) data.value = body.value === "" || body.value === null ? null : Number(body.value);
  if (body.score !== undefined) data.score = body.score === "" || body.score === null ? null : Number(body.score);
  for (const key of ["quoteIncludesVat", "quoteIncludesInstallation", "ordered", "optedOut"] as const) {
    if (body[key] !== undefined) data[key] = Boolean(body[key]);
  }
  if (body.interests !== undefined) data.interests = Array.isArray(body.interests) ? body.interests : [];
  if (body.utmData !== undefined) data.utmData = body.utmData ?? {};

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({ where: { id }, data });
    await tx.leadActivity.create({
      data: {
        leadId: id,
        type: "SYSTEM",
        subject: "פרטי ליד עודכנו",
        body: "פרטים עודכנו בכרטיס הליד",
        createdById: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "UPDATE",
        entity: "Lead",
        entityId: id,
        before: jsonSafe(before),
        after: jsonSafe(updated),
      },
    });
    return updated;
  });

  return NextResponse.json({ lead: after });
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const actor = sessionUser(session);
  if (!can(actor.role, "leads", "delete")) return NextResponse.json({ error: "אין הרשאה למחוק לידים" }, { status: 403 });

  const { id } = await params;
  const before = await prisma.lead.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "ליד לא נמצא" }, { status: 404 });
  if (before.convertedCustomerId || before.stage === LeadStage.WON) {
    return NextResponse.json({ error: "לא ניתן למחוק ליד שהומר ללקוח" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "DELETE",
        entity: "Lead",
        entityId: id,
        before: jsonSafe(before),
        after: Prisma.JsonNull,
      },
    });
  });

  return NextResponse.json({ success: true, deletedId: id });
}

