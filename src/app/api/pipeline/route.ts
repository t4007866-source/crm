import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canView } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!canView((session.user as any).role, "pipeline"))
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const deals = await prisma.deal.findMany({
    where: { status: "OPEN" },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  const pipeline = STAGES.map((stage) => ({
    stage,
    deals: deals.filter((d) => d.stage === stage),
    totalValue: deals
      .filter((d) => d.stage === stage)
      .reduce((sum, d) => sum + d.value, 0),
  }));

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return NextResponse.json({ pipeline, totalDeals: deals.length, totalValue });
}

