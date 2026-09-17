import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { QuoteStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function computeTotals(items: any[], discount: number, vatRate: number) {
  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.quantity || 1) * Number(i.unitPrice || 0) - Number(i.discount || 0),
    0
  );
  const afterDiscount = Math.max(subtotal - Number(discount || 0), 0);
  const vat = afterDiscount * Number(vatRate ?? 0.17);
  return { subtotal, total: afterDiscount + vat };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "quotes", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as QuoteStatus | null;
  const q = searchParams.get("q")?.trim();
  const customerId = searchParams.get("customerId");

  const quotes = await prisma.quote.findMany({
    where: {
      ...(status && Object.values(QuoteStatus).includes(status) ? { status } : {}),
      ...(customerId ? { customerId } : {}),
      ...(q
        ? {
            OR: [
              { quoteNumber: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              { customer: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { customer: true, lead: true, createdBy: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ quotes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "quotes", "create")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = await req.json();
  if (!body.customerId || !body.title) return NextResponse.json({ error: "לקוח וכותרת הצעת מחיר הם חובה" }, { status: 400 });

  const items = Array.isArray(body.items)
    ? body.items.filter((i: any) => i.name)
    : [];
  const discount = Number(body.discount || 0);
  const vatRate = body.vatRate !== undefined ? Number(body.vatRate) : 0.17;
  const { total } = computeTotals(items, discount, vatRate);

  const quote = await prisma.$transaction(async (tx) => {
    const count = await tx.quote.count();
    const created = await tx.quote.create({
      data: {
        quoteNumber: `QT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        customerId: body.customerId,
        leadId: body.leadId || null,
        title: body.title,
        status: "DRAFT",
        total,
        discount,
        vatRate,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        notes: body.notes || null,
        internalNotes: body.internalNotes || null,
        createdById: (session.user as any).id || null,
        items: {
          create: items.map((i: any) => ({
            name: i.name,
            productId: i.productId || null,
            sku: i.sku || null,
            kind: i.kind || "PRODUCT",
            quantity: Number(i.quantity || 1),
            unitPrice: Number(i.unitPrice || 0),
            discount: Number(i.discount || 0),
            lineTotal: Number(i.quantity || 1) * Number(i.unitPrice || 0) - Number(i.discount || 0),
          })),
        },
      },
      include: { items: true, customer: true },
    });
    return created;
  });

  return NextResponse.json({ quote }, { status: 201 });
}

