import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const kpis = await prisma.dashboardKpi.findMany({ where: { userId: (session.user as any).id, isActive: true }, orderBy: { position: "asc" } });
  return NextResponse.json({ kpis });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "dashboard", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await req.json();
  if (!body.title || !body.source || !body.metric) return NextResponse.json({ error: "כותרת, מקור ומדד הם חובה" }, { status: 400 });
  const count = await prisma.dashboardKpi.count({ where: { userId: (session.user as any).id } });
  const kpi = await prisma.dashboardKpi.create({ data: { userId: (session.user as any).id, title: body.title, source: body.source, metric: body.metric, period: body.period || "month", filterJson: body.filterJson || {}, target: body.target === "" || body.target == null ? null : Number(body.target), color: body.color || "#3d8bfd", position: count } });
  return NextResponse.json({ kpi }, { status: 201 });
}

