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

const fullInclude = {
  customer: true,
  createdBy: { select: { id: true, name: true } },
  items: { orderBy: { id: "asc" as const } },
  itemHistory: {
    orderBy: { createdAt: "desc" as const },
    include: { changedBy: { select: { id: true, name: true } } },
  },
  snapshots: { orderBy: { version: "desc" as const } },
  versions: {
    select: { id: true, version: true, status: true, total: true, createdAt: true },
    orderBy: { version: "desc" as const },
  },
};

// GET /api/quotations/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "quotes", "view"))
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id }, include: fullInclude });
  if (!quote) return NextResponse.json({ error: "הצעת מחיר לא נמצאה" }, { status: 404 });

  return NextResponse.json({ quote });
}

// PATCH /api/quotations/[id] — עדכון פריטים עם היסטוריה, גרסה חדשה ותמונת מצב
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "quotes", "edit"))
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const userId = (session.user as any).id as string | undefined;

  const existing = await prisma.quote.findUnique({  where: { id },  include: { items: true },});
  if (!existing) return NextResponse.json({ error: "הצעת מחיר לא נמצאה" }, { status: 404 });

  if (
    body.status &&
    !Object.values(QuoteStatus).includes(body.status)
  )
    return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });

  const data: any = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.validUntil !== undefined)
    data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
  if (body.currency !== undefined) data.currency = body.currency;

  // עדכון פריטים — מחיקה ויצירה מחדש + תיעוד היסטוריה
  let totals = {
    subtotal: existing.subtotal,
    tax: existing.tax,
    total: existing.total,
  };

  if (Array.isArray(body.items)) {
    const items = body.items.filter((i: any) => i && i.description);
    if (items.length === 0)
      return NextResponse.json({ error: "חובה לפחות פריט אחד" }, { status: 400 });

    totals = computeTotals(items);

    const oldByDesc = new Map(existing.items.map((i) => [i.description, i]));
    const newDescs = new Set(items.map((i: any) => String(i.description)));

    const historyRows: any[] = [];
    for (const i of items) {
      const desc = String(i.description);
      const prev = oldByDesc.get(desc);
      const qty = Number(i.quantity || 1);
      const price = Number(i.unitPrice || 0);
      if (!prev) {
        historyRows.push({
          action: "CREATED",
          description: desc,
          quantity: qty,
          unitPrice: price,
          total: Math.round(qty * price * 100) / 100,
          changedById: userId || null,
        });
      } else if (
        Number(prev.quantity) !== qty ||
        Number(prev.unitPrice) !== price
      ) {
        historyRows.push({
          action: "UPDATED",
          description: desc,
          quantity: qty,
          unitPrice: price,
          total: Math.round(qty * price * 100) / 100,
          changedById: userId || null,
        });
      }
    }
    for (const prev of existing.items) {
      if (!newDescs.has(prev.description)) {
        historyRows.push({
          action: "REMOVED",
          description: prev.description,
          quantity: prev.quantity,
          unitPrice: prev.unitPrice,
          total: prev.total,
          changedById: userId || null,
        });
      }
    }

    data.items = {
      deleteMany: {},
      create: items.map((i: any) => ({
        description: String(i.description),
        quantity: Number(i.quantity || 1),
        unitPrice: Number(i.unitPrice || 0),
        total: Math.round(Number(i.quantity || 1) * Number(i.unitPrice || 0) * 100) / 100,
      })),
    };
    if (historyRows.length > 0) data.itemHistory = { create: historyRows };

    // גרסה חדשה
    const nextVersion =
      existing.versions.reduce((m, v) => Math.max(m, v.version), 0) + 1;
    data.versions = {
      create: {
        version: nextVersion,
        status: (body.status as QuoteStatus) || existing.status,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: body.taxIncluded ? totals.subtotal : totals.total,
        notes: body.notes ?? existing.notes,
        payload: { items, title: body.title ?? existing.title } as any,
        createdById: userId || null,
      },
    };
    data.snapshots = {
      create: {
        version: nextVersion,
        payload: {
          title: body.title ?? existing.title,
          items,
          totals,
        } as any,
      },
    };
  }

  if (body.status !== undefined) data.status = body.status;
  if (body.items || body.taxIncluded !== undefined) {
    data.subtotal = totals.subtotal;
    data.tax = body.taxIncluded ? 0 : totals.tax;
    data.total = body.taxIncluded ? totals.subtotal : totals.total;
  }

  const quote = await prisma.quote.update({
    where: { id },
    data,
    include: fullInclude,
  });

  return NextResponse.json({ quote });
}

// DELETE /api/quotations/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "quotes", "delete"))
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.quote.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "הצעת מחיר לא נמצאה" }, { status: 404 });

  await prisma.quote.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

