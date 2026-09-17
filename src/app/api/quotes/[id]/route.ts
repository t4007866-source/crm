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
    include: { customer: true, lead: true, createdBy: true, items: true, convertedOrder: true },
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
    if (status === "SENT") data.sentAt = new Date();
    if (status === "ACCEPTED") data.acceptedAt = new Date();
    if (body.rejectedReason) data.rejectedReason = body.rejectedReason;
  }

  // עדכון תוכן מלא — דורש הרשאת edit
  if (body.title !== undefined || body.items !== undefined || body.discount !== undefined || body.vatRate !== undefined || body.validUntil !== undefined || body.notes !== undefined || body.internalNotes !== undefined) {
    if (!can(role, "quotes", "edit")) return NextResponse.json({ error: "אין הרשאת עריכה" }, { status: 403 });
    if (body.title !== undefined) data.title = body.title;
    if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.internalNotes !== undefined) data.internalNotes = body.internalNotes;

    const discount = body.discount !== undefined ? Number(body.discount) : existing.discount;
    const vatRate = body.vatRate !== undefined ? Number(body.vatRate) : existing.vatRate;
    data.discount = discount;
    data.vatRate = vatRate;

    if (Array.isArray(body.items)) {
      const items = body.items.filter((i: any) => i.name);
      const subtotal = items.reduce(
        (sum: number, i: any) => sum + Number(i.quantity || 1) * Number(i.unitPrice || 0) - Number(i.discount || 0),
        0
      );
      const afterDiscount = Math.max(subtotal - discount, 0);
      data.total = afterDiscount + afterDiscount * vatRate;
      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      if (items.length) {
        await prisma.quoteItem.createMany({
          data: items.map((i: any) => ({
            quoteId: id,
            name: i.name,
            productId: i.productId || null,
            sku: i.sku || null,
            kind: i.kind || "PRODUCT",
            quantity: Number(i.quantity || 1),
            unitPrice: Number(i.unitPrice || 0),
            discount: Number(i.discount || 0),
            lineTotal: Number(i.quantity || 1) * Number(i.unitPrice || 0) - Number(i.discount || 0),
          })),
        });
      }
    } else {
      const subtotal = existing.items.reduce((sum, i) => sum + i.lineTotal, 0);
      const afterDiscount = Math.max(subtotal - discount, 0);
      data.total = afterDiscount + afterDiscount * vatRate;
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

