import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { QuoteStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "quotes", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, createdBy: true, items: true },
  });
  if (!quote) return NextResponse.json({ error: "הצעת מחיר לא נמצאה" }, { status: 404 });
  return NextResponse.json({ quote });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const role = (session.user as any).role;

  const { id } = await params;
  const existing = await prisma.quote.findUnique({ where: { id }, include: { items: true } });
  if (!existing) return NextResponse.json({ error: "הצעת מחיר לא נמצאה" }, { status: 404 });

  const body = await req.json();
  const data: any = {};

  // עדכון סטטוס (שליחה / קבלה / דחייה) — דורש הרשאת approve
  if (body.status) {
    const status = body.status as QuoteStatus;
    if (!Object.values(QuoteStatus).includes(status)) return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
    if (!can(role, "quotes", "approve")) return NextResponse.json({ error: "אין הרשאה לשינוי סטטוס" }, { status: 403 });
    data.status = status;
  }

  // עדכון תוכן מלא — דורש הרשאת edit
  if (body.title !== undefined || body.items !== undefined || body.validUntil !== undefined || body.notes !== undefined) {
    if (!can(role, "quotes", "edit")) return NextResponse.json({ error: "אין הרשאת עריכה" }, { status: 403 });
    if (body.title !== undefined) data.title = body.title;
    if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (body.notes !== undefined) data.notes = body.notes;

    if (Array.isArray(body.items)) {
      const items = body.items.filter((i: any) => i.description || i.name);
      const subtotal = items.reduce(
        (sum: number, i: any) => sum + Number(i.quantity || 1) * Number(i.unitPrice || 0),
        0
      );
      const tax = body.tax !== undefined ? Number(body.tax) : Math.round(subtotal * 0.17 * 100) / 100;
      data.subtotal = Math.round(subtotal * 100) / 100;
      data.tax = tax;
      data.total = Math.round((subtotal + tax) * 100) / 100;

      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      if (items.length) {
        await prisma.quoteItem.createMany({
          data: items.map((i: any) => {
            const qty = Number(i.quantity || 1);
            const price = Number(i.unitPrice || 0);
            return {
              quoteId: id,
              description: i.description || i.name,
              quantity: qty,
              unitPrice: price,
              total: Math.round(qty * price * 100) / 100,
            };
          }),
        });
      }
    } else {
      const subtotal = existing.items.reduce((sum, i) => sum + i.total, 0);
      const tax = body.tax !== undefined ? Number(body.tax) : Math.round(subtotal * 0.17 * 100) / 100;
      data.subtotal = Math.round(subtotal * 100) / 100;
      data.tax = tax;
      data.total = Math.round((subtotal + tax) * 100) / 100;
    }
  }

  const quote = await prisma.quote.update({ where: { id }, data, include: { items: true, customer: true } });
  return NextResponse.json({ quote });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "quotes", "delete")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: "הצעת מחיר לא נמצאה" }, { status: 404 });
  if (quote.convertedOrderId) return NextResponse.json({ error: "לא ניתן למחוק הצעה שהומרה להזמנה" }, { status: 400 });

  await prisma.quote.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

