import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, CustomerStatus, LeadSource } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const activeServiceStatuses = ["OPEN", "SCHEDULED", "IN_PROGRESS"] as const;
const statusValues = new Set(Object.values(CustomerStatus));
const sourceValues = new Set(Object.values(LeadSource));

function startOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const role = (session.user as any).role;
  if (!canViewCustomers(role)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const statusParam = searchParams.get("status") || "";
  const sourceParam = searchParams.get("source") || "";
  const city = (searchParams.get("city") || "").trim();
  const assignedToId = searchParams.get("assignedToId") || "";
  const systemType = (searchParams.get("systemType") || "").trim();
  const installationFrom = parseDate(searchParams.get("installationFrom"));
  const installationTo = parseDate(searchParams.get("installationTo"));
  const serviceFrom = parseDate(searchParams.get("serviceFrom"));
  const serviceTo = parseDate(searchParams.get("serviceTo"));
  const isNew = searchParams.get("isNew") === "true";
  const openService = searchParams.get("openService") === "true";
  const hasDebt = searchParams.get("hasDebt") === "true";
  const reminderSoon = searchParams.get("reminderSoon") === "true";

  const where: Prisma.CustomerWhereInput = {};
  if (statusValues.has(statusParam as CustomerStatus)) where.status = statusParam as CustomerStatus;
  if (sourceValues.has(sourceParam as LeadSource)) where.source = sourceParam as LeadSource;
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (assignedToId) where.assignedToId = assignedToId;
  if (isNew) where.createdAt = { gte: startOfMonth() };
  if (openService) where.serviceCalls = { some: { status: { in: [...activeServiceStatuses] } } };
  if (hasDebt) {
    // This schema version has no CustomerDebt relation; preserve the filter as a no-op until that model is added.
  }
  if (reminderSoon) {
    const until = new Date();
    until.setDate(until.getDate() + 30);
    where.installedSystems = { some: { nextFilterChangeDate: { gte: new Date(), lte: until } } };
  }
  if (systemType || installationFrom || installationTo) {
    where.installedSystems = {
      some: {
        ...(systemType ? { systemType: { contains: systemType, mode: "insensitive" } } : {}),
        ...(installationFrom || installationTo
          ? { installationDate: { ...(installationFrom ? { gte: installationFrom } : {}), ...(installationTo ? { lte: installationTo } : {}) } }
          : {}),
      },
    };
  }
  if (serviceFrom || serviceTo) {
    where.serviceCalls = {
      some: {
        scheduledAt: { ...(serviceFrom ? { gte: serviceFrom } : {}), ...(serviceTo ? { lte: serviceTo } : {}) },
      },
    };
  }
  if (search) {
    const searchOr: Prisma.CustomerWhereInput[] = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
      { installedSystems: { some: { serialNumber: { contains: search, mode: "insensitive" } } } },
      { orders: { some: { orderNumber: { contains: search, mode: "insensitive" } } } },
      { serviceCalls: { some: { callNumber: { contains: search, mode: "insensitive" } } } },
    ];
    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [...existingAnd, { OR: searchOr }];
  }

  const baseScope: Prisma.CustomerWhereInput = role === "SALES_REP" ? { assignedToId: (session.user as any).id } : {};
  const scopedWhere: Prisma.CustomerWhereInput = { AND: [baseScope, where] };
  const reminderUntil = new Date();
  reminderUntil.setDate(reminderUntil.getDate() + 30);

  const [customers, total, active, newThisMonth, upcoming, inactive, byCity, users] = await Promise.all([
    prisma.customer.findMany({
      where: scopedWhere,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        assignedTo: { select: { id: true, name: true } },
        installedSystems: { select: { id: true, systemType: true, nextFilterChangeDate: true } },
        serviceCalls: { where: { status: { in: [...activeServiceStatuses] } }, orderBy: { scheduledAt: "asc" }, take: 1, select: { id: true, callNumber: true, scheduledAt: true, status: true } },
        orders: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, orderNumber: true, total: true, createdAt: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, type: true, subject: true, createdAt: true } },
        _count: { select: { installedSystems: true, serviceCalls: true, orders: true, tasks: true } },
      },
    }),
    prisma.customer.count({ where: scopedWhere }),
    prisma.customer.count({ where: { ...scopedWhere, status: "ACTIVE" } }),
    prisma.customer.count({ where: { ...scopedWhere, createdAt: { gte: startOfMonth() } } }),
    prisma.customer.count({ where: { ...scopedWhere, installedSystems: { some: { nextFilterChangeDate: { gte: new Date(), lte: reminderUntil } } } } }),
    prisma.customer.count({ where: { ...scopedWhere, activities: { none: {} } } }),
    prisma.customer.groupBy({ by: ["city"], where: scopedWhere, _count: { _all: true }, orderBy: { _count: { city: "desc" } }, take: 5 }),
    can(role, "customers", "edit") ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    customers,
    meta: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    kpis: { active, newThisMonth, upcoming, inactive, byCity },
    options: { users },
  });
}

function canViewCustomers(role: string) {
  return can(role, "customers", "view");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const role = (session.user as any).role;
  if (!can(role, "customers", "create")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = await req.json();
  const phone = String(body.phone || "").replace(/\s+/g, "").trim();
  if (!body.name || !phone) return NextResponse.json({ error: "שם וטלפון הם שדות חובה" }, { status: 400 });
  const duplicate = await prisma.customer.findUnique({ where: { phone } });
  if (duplicate) return NextResponse.json({ error: "כבר קיים לקוח עם מספר הטלפון הזה", duplicate }, { status: 409 });

  const customer = await prisma.customer.create({
    data: {
      name: body.name,
      company: body.company || null,
      email: body.email || null,
      phone,
      address: body.address || null,
      city: body.city || null,
      lat: body.lat ? Number(body.lat) : null,
      lng: body.lng ? Number(body.lng) : null,
      status: body.status || "LEAD",
      source: body.source || null,
      confidence: body.confidence || null,
      notes: body.notes || null,
      preferredLanguage: body.preferredLanguage || "he",
      communicationOptOut: Boolean(body.communicationOptOut),
      whatsappConsent: Boolean(body.whatsappConsent),
      whatsappPhone: body.whatsappPhone || phone,
      customData: body.customData || {},
      createdById: (session.user as any).id,
    },
  });
  await prisma.auditLog.create({ data: { userId: (session.user as any).id, action: "CREATE", entity: "Customer", entityId: customer.id, after: customer as any } });
  return NextResponse.json(customer, { status: 201 });
}


