import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "inventory", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const items = await prisma.inventoryItem.findMany({ include: { product: true, warehouse: true }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ items });
}

