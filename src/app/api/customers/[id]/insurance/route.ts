import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const role = (session.user as any).role;
  if (!can(role, "customers", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  if (!body.startDate || !body.endDate || body.amount === undefined || !body.frequency) {
    return NextResponse.json({ error: "חסרים נתוני חידוש: תאריך התחלה, תאריך סיום, סכום ותדירות" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!customer) return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });

  const renewal = await prisma.serviceInsuranceRenewal.create({
    data: {
      customerId: id,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      amount: Number(body.amount),
      frequency: body.frequency,
      paidAt: body.paidAt ? new Date(body.paidAt) : null,
      paymentReference: body.paymentReference || null,
      notes: body.notes || null,
      createdById: (session.user as any).id,
    },
  });

  const updated = await prisma.customer.update({
    where: { id },
    data: {
      serviceInsuranceEnabled: true,
      serviceInsuranceStartDate: new Date(body.startDate),
      serviceInsuranceEndDate: new Date(body.endDate),
      serviceInsuranceMonthlyPrice: Number(body.amount),
      serviceInsuranceFrequency: body.frequency,
      serviceInsuranceStatus: "ACTIVE",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "ServiceInsuranceRenewal",
      entityId: renewal.id,
      after: { renewal, customerId: id } as any,
    },
  });

  return NextResponse.json({ renewal, customer: updated }, { status: 201 });
}

