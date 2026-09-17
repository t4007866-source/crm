import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";

// GET /api/quotations — רשימת הצעות מחיר
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const leadId = searchParams.get("leadId");

  const where: any = {};
  if (status && Object.values(QuoteStatus).includes(status as QuoteStatus)) {
    where.status = status;
  }
  if (customerId) where.customerId = customerId;
  if (leadId) where.leadId = leadId;

  const quotations = await prisma.quote.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      lead: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ quotations });
}

// POST /api/quotations — יצירת הצעה חדשה
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerId,
      leadId,
      title,
      items, // [{ productId, itemType, name, model, description, quantity, unitPrice, isOptional, recommended }]
      discountPercent = 0,
      vatPercent = 18,
      validDays = 30,
      notes,
      createdById,
    } = body;

    if (!customerId || !title || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "חסרים שדות חובה: customerId, title, items" },
        { status: 400 }
      );
    }

    // חישוב סכומים — רק פריטים לא-אופציונליים נכללים בסה"כ
    const mainItems = items.filter((i: any) => !i.isOptional);
    const subtotal = mainItems.reduce(
      (s: number, i: any) => s + Number(i.quantity || 1) * Number(i.unitPrice || 0),
      0
    );
    const totalBeforeDiscount = subtotal;
    const afterDiscount = subtotal * (1 - Number(discountPercent) / 100);
    const tax = afterDiscount * (Number(vatPercent) / 100);
    const total = afterDiscount + tax;

    // מספר הצעה: QT-YYYY-NNNN
    const year = new Date().getFullYear();
    const count = await prisma.quote.count();
    const number = `QT-${year}-${String(count + 1).padStart(4, "0")}`;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + Number(validDays));

    const quotation = await prisma.quote.create({
      data: {
        number,
        customerId,
        leadId: leadId || null,
        title,
        items: {
          create: items.map((i: any, idx: number) => ({
            productId: i.productId || null,
            itemType: i.itemType || "PRODUCT",
            name: i.name || null,
            model: i.model || null,
            description: i.description || "",
            quantity: Number(i.quantity || 1),
            unitPrice: Number(i.unitPrice || 0),
            total: Number(i.quantity || 1) * Number(i.unitPrice || 0),
            isOptional: Boolean(i.isOptional),
            recommended: Boolean(i.recommended),
            sortOrder: i.sortOrder ?? idx,
          })),
        },
        subtotal,
        discountPercent: Number(discountPercent),
        tax,
        vatPercent: Number(vatPercent),
        totalBeforeDiscount,
        total,
        validUntil,
        notes: notes || null,
        createdById: createdById || null,
      },
      include: { items: true, customer: true },
    });

    return NextResponse.json({ quotation }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "שגיאה ביצירת הצעה" },
      { status: 500 }
    );
  }
}

