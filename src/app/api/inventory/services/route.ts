import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function guard(action: string = "view") {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  if (!can((session.user as any).role, "inventory", action)) return { error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const g = await guard(); if (g.error) return g.error;
  const services = await prisma.serviceCatalogItem.findMany({ include: { parts: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ services });
}

export async function POST(req: NextRequest) {
  const g = await guard("create"); if (g.error) return g.error;
  const b = await req.json();
  if (!b.name || !b.code) return NextResponse.json({ error: "שם וקוד שירות הם שדות חובה" }, { status: 400 });
  try {
    const service = await prisma.serviceCatalogItem.create({
      data: { code: String(b.code).trim(), name: String(b.name).trim(), description: b.description || null, basePrice: Number(b.basePrice || 0), estimatedMinutes: b.estimatedMinutes ? Number(b.estimatedMinutes) : null, laborCost: Number(b.laborCost || 0), warrantyDays: b.warrantyDays ? Number(b.warrantyDays) : null, parts: Array.isArray(b.parts) ? { create: b.parts.filter((p: any) => p.inventoryItemId).map((p: any) => ({ inventoryItemId: p.inventoryItemId, defaultQuantity: Number(p.defaultQuantity || 1) })) } : undefined },
      include: { parts: true },
    });
    return NextResponse.json({ service }, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.code === "P2002" ? "קוד השירות כבר קיים" : "שמירת השירות נכשלה" }, { status: 400 }); }
}

