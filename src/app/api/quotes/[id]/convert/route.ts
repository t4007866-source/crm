import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// המרת הצעת מחיר להזמנה — יוצרת Order + OrderItem ומסמן את ההצעה כ-Accepted
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "quotes", "approve") || !can((session.user as any).role, "orders", "create")) {
    return NextResponse.json({ error: "אין הרשאה להמיר הצעה להזמנה" }, { status: 403 });
  }

  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id }, include: { items: true } });
  if (!quote) return NextResponse.json({ error: "הצעת מחיר לא נמצאה" }, { status: 404 });
  if (quote.convertedOrderId) return NextResponse.json({ error: "הצעה זו כבר הומרה להזמנה" }, { status: 400 });
  if (!quote.items.length) return NextResponse.json({ error: "אין סעיפים בהצעה" }, { status: 400 });

  const order = await prisma.$transaction(async (tx) => {
    const count = await tx.order.count();
    const created = await tx.order.create({
      data: {
        orderNumber: `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        customerId: quote.customerId,
        title: quote.title,
        status: "CONFIRMED",
        total: quote.total,
        discount: Math.max(0, quote.subtotal - quote.total),
        paymentStatus: "PENDING",
        notes: quote.notes,
        source: quote.number,
        items: {
          create: quote.items.map((i) => ({
            name: i.description,
            quantity: Math.round(i.quantity) || 1,
            unitPrice: i.unitPrice,
            vatRate: 0.17,
            lineTotal: i.total,
          })),
        },
      },
    });

    await tx.quote.update({
      where: { id: quote.id },
      data: { status: "ACCEPTED", convertedOrderId: created.id },
    });

    return created;
  });

  return NextResponse.json({ order }, { status: 201 });
}

