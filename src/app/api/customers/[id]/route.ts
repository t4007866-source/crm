import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "customers", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id }, include: { contacts: true, serviceInsuranceRenewals: { orderBy: { endDate: "desc" }, take: 20 }, installedSystems: { include: { serviceCalls: { orderBy: { scheduledAt: "desc" }, take: 10 } } }, serviceCalls: { orderBy: { scheduledAt: "desc" }, take: 20 }, appointments: { orderBy: { startAtUtc: "asc" }, take: 20 }, tasks: { orderBy: { dueAt: "asc" } }, orders: { orderBy: { createdAt: "desc" }, take: 20 }, leads: { orderBy: { createdAt: "desc" }, take: 10, include: { followUps: { orderBy: { scheduledAt: "desc" }, take: 20 } } }, deals: { orderBy: { createdAt: "desc" }, take: 10 }, activities: { orderBy: { createdAt: "desc" }, take: 30 } } });
  if (!customer) return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "customers", "edit"))
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });

  const customer = await prisma.customer.update({ where: { id }, data: body });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "Customer",
      entityId: customer.id,
      before: before as any,
      after: customer as any,
    },
  });

  return NextResponse.json(customer);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "מחיקת לקוח מותרת למנהל מערכת בלבד" }, { status: 403 });
  }

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          orders: true,
          serviceCalls: true,
          appointments: true,
          installedSystems: true,
          leads: true,
          deals: true,
        },
      },
    },
  });

  if (!customer) return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });

  const blockingRelations = [
    customer._count.orders > 0 ? `הזמנות (${customer._count.orders})` : null,
    customer._count.serviceCalls > 0 ? `קריאות שירות (${customer._count.serviceCalls})` : null,
  ].filter(Boolean) as string[];

  if (blockingRelations.length > 0) {
    return NextResponse.json(
      {
        error: "לא ניתן למחוק לקוח עם רשומות עסקיות פעילות",
        details: blockingRelations,
        code: "CUSTOMER_HAS_DEPENDENCIES",
      },
      { status: 409 }
    );
  }

  const before = { ...customer, _count: customer._count };
  await prisma.$transaction(async (tx) => {
    await tx.customer.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: "DELETE",
        entity: "Customer",
        entityId: id,
        before: before as any,
        after: { deleted: true, reason: "ADMIN_DELETE" },
      },
    });
  });

  return NextResponse.json({ success: true, deletedCustomerId: id });
}








