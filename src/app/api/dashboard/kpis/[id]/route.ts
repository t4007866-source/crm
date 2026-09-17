import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "dashboard", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await params;
  await prisma.dashboardKpi.updateMany({ where: { id, userId: (session.user as any).id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}

