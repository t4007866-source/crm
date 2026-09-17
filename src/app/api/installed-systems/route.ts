import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "customers", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await req.json();
  if (!body.customerId || !body.systemType || !body.model) return NextResponse.json({ error: "לקוח, סוג מערכת ודגם הם חובה" }, { status: 400 });
  const system = await prisma.installedSystem.create({ data: { customerId: body.customerId, systemType: body.systemType, model: body.model, serialNumber: body.serialNumber || null, filterTypes: body.filterTypes || [], installationDate: body.installationDate ? new Date(body.installationDate) : null, warrantyUntil: body.warrantyUntil ? new Date(body.warrantyUntil) : null, manufacturerWarrantyStart: body.manufacturerWarrantyStart ? new Date(body.manufacturerWarrantyStart) : null, manufacturerWarrantyUntil: body.manufacturerWarrantyUntil ? new Date(body.manufacturerWarrantyUntil) : null, manufacturerWarrantyStatus: body.manufacturerWarrantyStatus || "NONE", manufacturerWarrantyReminderDays: body.manufacturerWarrantyReminderDays ? Number(body.manufacturerWarrantyReminderDays) : 30, nextFilterChangeDate: body.nextFilterChangeDate ? new Date(body.nextFilterChangeDate) : null, technicianTips: body.technicianTips || null } });
  return NextResponse.json({ system }, { status: 201 });
}



