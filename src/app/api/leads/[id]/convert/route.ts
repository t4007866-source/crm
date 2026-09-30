import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "leads", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "ליד לא נמצא" }, { status: 404 });
  if (lead.convertedCustomerId || lead.stage === "WON") return NextResponse.json({ error: "הליד כבר הומר ללקוח" }, { status: 409 });
  if (!lead.phone) return NextResponse.json({ error: "לא ניתן להמיר ליד ללא מספר טלפון" }, { status: 400 });

  const phone = lead.phone;
  const existing = await prisma.customer.findUnique({ where: { phone } });
  if (existing) {
    await prisma.lead.update({ where: { id }, data: { stage: "WON", ordered: true, convertedCustomerId: existing.id, convertedAt: new Date() } });
    await prisma.leadFollowUp.updateMany({ where: { leadId: id, status: { in: ["PENDING", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
    await prisma.leadActivity.create({ data: { leadId: id, type: "SYSTEM", subject: "ליד קושר ללקוח קיים", body: `הליד קושר ללקוח ${existing.name} במקום ליצור כפילות`, createdById: (session.user as any).id } });
    return NextResponse.json({ customer: existing, existing: true });
  }

  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone,
        city: lead.city,
        status: "ACTIVE",
        source: lead.source,
        confidence: lead.confidence,
        notes: lead.notes,
        createdById: (session.user as any).id,
      },
    });

    if (lead.value && lead.value > 0) {
      await tx.deal.create({
        data: {
          title: `עסקה מהמרת ליד — ${lead.name}`,
          customerId: created.id,
          value: lead.value,
          status: "OPEN",
          stage: "WON",
          probability: 100,
          assignedToId: lead.assignedToId || (session.user as any).id,
          closedAt: new Date(),
          notes: "נוצרה אוטומטית בתהליך המרת ליד ללקוח",
        },
      });
    }

    await tx.lead.update({
      where: { id },
      data: { stage: "WON", ordered: true, convertedCustomerId: created.id, convertedAt: new Date() },
    });

    await tx.leadFollowUp.updateMany({ where: { leadId: id, status: { in: ["PENDING", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
    await tx.leadActivity.create({ data: { leadId: id, type: "SYSTEM", subject: "ליד הומר ללקוח", body: `נוצר לקוח חדש: ${created.name}. רצף ה-Follow-up נעצר.`, createdById: (session.user as any).id } });
    return created;
  });

  return NextResponse.json({ customer, existing: false }, { status: 201 });
}




