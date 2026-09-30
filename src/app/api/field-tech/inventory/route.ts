import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const user = session.user as { role: string };
  if (!can(user.role, "fieldTech", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const items = await prisma.inventoryItem.findMany({
    where: { product: { isActive: true } },
    orderBy: { product: { name: "asc" } },
    select: {
      id: true,
      productId: true,
      warehouseId: true,
      quantityOnHand: true,
      product: { select: { name: true, sku: true, unit: true } },
      warehouse: { select: { name: true } },
    },
  });

  return NextResponse.json({ items });
}

