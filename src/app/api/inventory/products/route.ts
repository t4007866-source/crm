import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "inventory", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const products = await prisma.product.findMany({ include: { category: true, inventoryItems: { include: { warehouse: true } } }, orderBy: { name: "asc" } });
  return NextResponse.json({ products });
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "inventory", "create")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const b = await req.json();
  if (!b.name || !b.sku) return NextResponse.json({ error: "שם ומק״ט הם שדות חובה" }, { status: 400 });
  try {
    const product = await prisma.product.create({ data: { name: String(b.name).trim(), sku: String(b.sku).trim(), barcode: b.barcode ? String(b.barcode).trim() : null, imageUrl: b.imageUrl || null, description: b.description || null, kind: b.kind || "PRODUCT", unit: b.unit || "יחידה", costPrice: Number(b.costPrice || 0), salePrice: Number(b.salePrice || 0), vatRate: Number(b.vatRate ?? 0.17), trackStock: b.trackStock !== false, reorderPoint: Number(b.reorderPoint || 0), reorderQuantity: Number(b.reorderQuantity || 0), isConsumable: b.isConsumable !== false, isActive: b.isActive !== false } });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.code === "P2002" ? "מק״ט או ברקוד כבר קיימים" : "יצירת המוצר נכשלה" }, { status: 400 });
  }
}


