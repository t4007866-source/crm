import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { QuoteStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const VAT_RATE = 0.17;

function computeTotals(items: any[]) {
  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.quantity || 1) * Number(i.unitPrice || 0),
    0
  );
  const tax = subtotal * VAT_RATE;
  return { subtotal: Math.round(subtotal * 100) / 100, tax: Math.round(tax * 100) / 100, total: Math.round((subtotal + tax) * 100) / 100 };
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
              { number: { contains: q, mode: "insensitive" as const } },
              { title: { contains: q, mode: "insensitive" as const } },
              { customer: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: { customer: true, createdBy: true, items: true },
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
    ? body.items
        .filter((i: any) => i.description || i.name)
        .map((i: any) => ({
          description: i.description || i.name,
          quantity: Number(i.quantity || 1),
          unitPrice: Number(i.unitPrice || 0),
        }))
    : [];
  const totals = computeTotals(items);

  const quote = await prisma.$transaction(async (tx) => {
    const count = await tx.quote.count();
    const created = await tx.quote.create({
      data: {
        number: `QT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        customerId: body.customerId,
        title: body.title,
        status: "DRAFT",
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        notes: body.notes || null,
        createdById: (session.user as any).id || null,
        items: {
          create: items.map((i: any) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: Math.round(i.quantity * i.unitPrice * 100) / 100,
          })),
        },
      },
      include: { items: true, customer: true },
    });
    return created;
  });

  return NextResponse.json({ quote }, { status: 201 });
}

