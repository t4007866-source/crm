import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "serviceMap", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const customers = await prisma.customer.findMany({
    where: { lat: { not: null }, lng: { not: null } },
    select: { id: true, name: true, company: true, phone: true, address: true, city: true, lat: true, lng: true, status: true, serviceCalls: { where: { status: { in: ["OPEN", "SCHEDULED", "IN_PROGRESS"] } }, select: { id: true, callNumber: true, type: true, status: true, scheduledAt: true }, take: 3 } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ customers });
}

