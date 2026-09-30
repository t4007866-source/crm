import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { StockMovementType } from "@prisma/client";

export const dynamic = "force-dynamic";
async function guard(action = "view") { const s = await getServerSession(authOptions); if (!s) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) }; if (!can((s.user as any).role, "inventory", action)) return { error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) }; return { session: s }; }
export async function GET() { const g = await guard(); if (g.error) return g.error; const movements = await prisma.stockMovement.findMany({ include: { product: true, warehouse: true }, orderBy: { createdAt: "desc" }, take: 500 }); return NextResponse.json({ movements }); }
export async function POST(req: NextRequest) {
  const g = await guard("edit"); if (g.error) return g.error;
  const b = await req.json(); const type = String(b.type || "ADJUSTMENT") as StockMovementType; const quantity = Number(b.quantity || 0);
  if (!b.productId || !b.warehouseId || !Number.isInteger(quantity) || quantity === 0 || !Object.values(StockMovementType).includes(type)) return NextResponse.json({ error: "מוצר, מחסן, כמות וסוג תנועה תקינים הם חובה" }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { productId_warehouseId: { productId: b.productId, warehouseId: b.warehouseId } } });
      if (!item) throw new Error("INVENTORY_NOT_FOUND");
      const delta = ["RECEIPT", "RETURN", "RELEASE"].includes(type) ? Math.abs(quantity) : ["CONSUMPTION", "DAMAGE", "RESERVATION"].includes(type) ? -Math.abs(quantity) : quantity;
      const before = item.quantityOnHand; const after = before + delta;
      if (after < 0) throw new Error("NEGATIVE_STOCK");
      const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { quantityOnHand: after } });
      const movement = await tx.stockMovement.create({ data: { productId: b.productId, warehouseId: b.warehouseId, type, quantity: delta, quantityBefore: before, quantityAfter: after, unitCost: b.unitCost ? Number(b.unitCost) : null, orderId: b.orderId || null, serviceCallId: b.serviceCallId || null, technicianId: b.technicianId || null, createdById: (g.session!.user as any).id, note: b.note || null } });
      return { updated, movement };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message === "NEGATIVE_STOCK" ? "אין מספיק מלאי לתנועה זו" : e.message === "INVENTORY_NOT_FOUND" ? "לא נמצאה שורת מלאי למוצר ולמחסן" : "יצירת התנועה נכשלה" }, { status: 400 }); }
}

