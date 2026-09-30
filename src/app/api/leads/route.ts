import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, canView } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!canView((session.user as any).role, "leads")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      contactAttempts: { orderBy: { attemptedAt: "desc" }, take: 10, select: { id: true, attemptedAt: true, result: true, channel: true } },
      followUps: { where: { status: "PENDING" }, orderBy: { scheduledAt: "asc" }, take: 1, select: { id: true, scheduledAt: true, channel: true, status: true } },
      customer: { select: { id: true, name: true, status: true } },
    },
  });

  const phoneCounts = new Map<string, number>();
  for (const lead of leads) {
    const phone = String(lead.phone || "").replace(/\D/g, "").slice(-9);
    if (phone) phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
  }

  const enriched = leads.map((lead) => ({
    ...lead,
    possibleDuplicate: Boolean(lead.phone && (phoneCounts.get(String(lead.phone).replace(/\D/g, "").slice(-9)) || 0) > 1),
    contactAttemptsCount: lead.contactAttempts.length,
    nextFollowUp: lead.followUps[0] || null,
  }));

  return NextResponse.json({ leads: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "leads", "create")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await req.json();
  if (!body.name || !body.phone) return NextResponse.json({ error: "שם וטלפון הם שדות חובה" }, { status: 400 });
  const normalized = String(body.phone).replace(/\D/g, "");
  const duplicate = await prisma.lead.findFirst({ where: { phone: { contains: normalized.slice(-9) }, stage: { not: "LOST" } } });
  if (duplicate) return NextResponse.json({ error: "כבר קיים ליד פעיל עם מספר הטלפון הזה", duplicateId: duplicate.id }, { status: 409 });
  const lead = await prisma.lead.create({ data: { name: body.name, phone: body.phone, email: body.email || null, company: body.company || null, city: body.city || null, source: body.source || "OTHER", stage: body.stage || "NEW", confidence: body.confidence || "MEDIUM", score: body.score == null ? null : Number(body.score), value: body.value ? Number(body.value) : null, notes: body.notes || null, interests: body.interests || [], currentSystem: body.currentSystem || null, utmData: body.utmData || {}, quoteIncludesVat: body.quoteIncludesVat !== false, quoteIncludesInstallation: Boolean(body.quoteIncludesInstallation), assignedToId: body.assignedToId || (session.user as any).id } });
  await prisma.leadActivity.create({ data: { leadId: lead.id, type: "SYSTEM", subject: "ליד נוצר ידנית", body: "הליד נקלט על ידי משתמש במערכת", createdById: (session.user as any).id } });
  return NextResponse.json({ lead }, { status: 201 });
}

