import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "customers", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const system = await prisma.installedSystem.update({ where: { id }, data: { systemType: body.systemType, model: body.model, serialNumber: body.serialNumber || null, filterTypes: body.filterTypes || [], installationDate: body.installationDate ? new Date(body.installationDate) : null, warrantyUntil: body.warrantyUntil ? new Date(body.warrantyUntil) : null, serviceCycleDays: body.serviceCycleDays ? Number(body.serviceCycleDays) : null, nextFilterChangeDate: body.nextFilterChangeDate ? new Date(body.nextFilterChangeDate) : null, technicianTips: body.technicianTips || null } });
  return NextResponse.json({ system });
}

