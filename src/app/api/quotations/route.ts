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
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round((subtotal + tax) * 100) / 100,
  };
}

// GET /api/quotations — רשימת הצעות מחיר
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "quotes", "view"))
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as QuoteStatus | null;
  const q = searchParams.get("q")?.trim();
  const customerId = searchParams.get("customerId");

  const quotations = await prisma.quote.findMany({
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
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { id: "asc" } },
      itemHistory: { orderBy: { createdAt: "desc" }, take: 50 },
      snapshots: { orderBy: { version: "desc" } },
      versions: {
        select: { id: true, version: true, status: true, total: true, createdAt: true },
        orderBy: { version: "desc" },
      },
      _count: { select: { items: true, versions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ quotations });
}

// POST /api/quotations — יצירת הצעת מחיר עם פריטים, גרסה 1 ותמונת מצב
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "quotes", "create"))
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = await req.json();
  if (!body.customerId || !body.title)
    return NextResponse.json({ error: "לקוח וכותרת הצעת מחיר הם חובה" }, { status: 400 });

  const items = Array.isArray(body.items)
    ? body.items.filter((i: any) => i && i.description)
    : [];
  if (items.length === 0)
    return NextResponse.json({ error: "חובה לפחות פריט אחד" }, { status: 400 });

  const totals = computeTotals(items);
  const userId = (session.user as any).id as string | undefined;

  const year = new Date().getFullYear();
  const count = await prisma.quote.count();
  const number = `Q-${year}-${String(count + 1).padStart(4, "0")}`;

  const quote = await prisma.quote.create({
    data: {
      number,
      customerId: body.customerId,
      title: body.title,
      status: "DRAFT",
      subtotal: totals.subtotal,
      tax: body.taxIncluded ? 0 : totals.tax,
      total: body.taxIncluded ? totals.subtotal : totals.total,
      currency: body.currency || "ILS",
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      notes: body.notes || null,
      createdById: userId || null,
      items: {
        create: items.map((i: any) => ({
          description: String(i.description),
          quantity: Number(i.quantity || 1),
          unitPrice: Number(i.unitPrice || 0),
          total: Math.round(Number(i.quantity || 1) * Number(i.unitPrice || 0) * 100) / 100,
        })),
      },
      itemHistory: {
        create: items.map((i: any) => ({
          action: "CREATED",
          description: String(i.description),
          quantity: Number(i.quantity || 1),
          unitPrice: Number(i.unitPrice || 0),
          total: Math.round(Number(i.quantity || 1) * Number(i.unitPrice || 0) * 100) / 100,
          changedById: userId || null,
        })),
      },
      versions: {
        create: {
          version: 1,
          status: "DRAFT",
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          notes: body.notes || null,
          payload: { items, title: body.title } as any,
          createdById: userId || null,
        },
      },
      snapshots: {
        create: {
          version: 1,
          payload: { title: body.title, items, totals } as any,
        },
      },
    },
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { id: "asc" } },
      itemHistory: { orderBy: { createdAt: "desc" } },
      snapshots: { orderBy: { version: "desc" } },
      versions: { orderBy: { version: "desc" } },
    },
  });

  return NextResponse.json({ quote }, { status: 201 });
}


