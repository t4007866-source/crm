import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function daysUntil(value: Date | null) {
  if (!value) return null;
  return Math.ceil((value.getTime() - Date.now()) / 86_400_000);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "serviceCalendar", "view")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const [systems, insuredCustomers, openCalls] = await Promise.all([
    prisma.installedSystem.findMany({
      include: {
        customer: true,
        serviceCalls: { orderBy: { openedAt: "desc" }, take: 5 },
      },
      orderBy: [{ warrantyUntil: "asc" }, { nextFilterChangeDate: "asc" }],
      take: 1000,
    }),
    prisma.customer.findMany({
      where: { serviceInsuranceEnabled: true },
      select: {
        id: true,
        name: true,
        phone: true,
        city: true,
        serviceInsuranceEnabled: true,
        serviceInsurancePlan: true,
        serviceInsuranceStartDate: true,
        serviceInsuranceEndDate: true,
        serviceInsuranceMonthlyPrice: true,
        serviceInsuranceNotes: true,
      },
      orderBy: { serviceInsuranceEndDate: "asc" },
      take: 1000,
    }),
    prisma.serviceCall.count({ where: { status: { in: ["OPEN", "SCHEDULED", "IN_PROGRESS"] } } }),
  ]);

  const warrantyItems = systems.map((system) => {
    const warrantyDays = daysUntil(system.warrantyUntil);
    const manufacturerDays = daysUntil(system.manufacturerWarrantyUntil);
    const filterDays = daysUntil(system.nextFilterChangeDate);
    const activeWarranty = warrantyDays !== null && warrantyDays >= 0;
    const activeManufacturerWarranty = manufacturerDays !== null && manufacturerDays >= 0;
    const warrantyStatus = activeWarranty || activeManufacturerWarranty
      ? "ACTIVE"
      : warrantyDays !== null || manufacturerDays !== null
        ? "EXPIRED"
        : "MISSING";
    const serviceStatus = filterDays === null ? "NOT_SET" : filterDays < 0 ? "OVERDUE" : filterDays <= 30 ? "DUE_SOON" : "PLANNED";

    return {
      id: system.id,
      customer: system.customer,
      systemType: system.systemType,
      model: system.model,
      serialNumber: system.serialNumber,
      installationDate: system.installationDate,
      warrantyUntil: system.warrantyUntil,
      manufacturerWarrantyUntil: system.manufacturerWarrantyUntil,
      nextFilterChangeDate: system.nextFilterChangeDate,
      serviceCycleDays: system.serviceCycleDays,
      technicianTips: system.technicianTips,
      warrantyDays,
      manufacturerDays,
      filterDays,
      warrantyStatus,
      serviceStatus,
      recentCalls: system.serviceCalls,
    };
  });

  const insuranceItems = insuredCustomers.map((customer) => {
    const days = daysUntil(customer.serviceInsuranceEndDate);
    return {
      ...customer,
      daysUntilEnd: days,
      status: days === null ? "NO_END_DATE" : days < 0 ? "EXPIRED" : days <= 30 ? "RENEW_SOON" : "ACTIVE",
    };
  });

  return NextResponse.json({
    warrantyItems,
    insuranceItems,
    openCalls,
    summary: {
      totalSystems: warrantyItems.length,
      activeWarranties: warrantyItems.filter((item) => item.warrantyStatus === "ACTIVE").length,
      expiredWarranties: warrantyItems.filter((item) => item.warrantyStatus === "EXPIRED").length,
      missingWarranty: warrantyItems.filter((item) => item.warrantyStatus === "MISSING").length,
      filterDueSoon: warrantyItems.filter((item) => item.serviceStatus === "DUE_SOON").length,
      filterOverdue: warrantyItems.filter((item) => item.serviceStatus === "OVERDUE").length,
      insuredCustomers: insuranceItems.length,
      insuranceRenewals: insuranceItems.filter((item) => item.status === "RENEW_SOON").length,
      openCalls,
    },
  });
}

