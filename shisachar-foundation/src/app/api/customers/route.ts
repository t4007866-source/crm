import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canView, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const role = (session.user as any).role;
  if (!canView(role, "customers"))
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" as const } },
          { company: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ customers });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const role = (session.user as any).role;
  if (!can(role, "customers", "create"))
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = await req.json();
  const customer = await prisma.customer.create({
    data: {
      name: body.name,
      company: body.company || null,
      email: body.email || null,
      phone: body.phone,
      address: body.address || null,
      city: body.city || null,
      lat: body.lat ? Number(body.lat) : null,
      lng: body.lng ? Number(body.lng) : null,
      taxId: body.taxId || null,
      status: body.status || "LEAD",
      source: body.source || null,
      confidence: body.confidence || null,
      notes: body.notes || null,
      preferredLanguage: body.preferredLanguage || "he",
      communicationOptOut: Boolean(body.communicationOptOut),
      whatsappConsent: Boolean(body.whatsappConsent),
      whatsappPhone: body.whatsappPhone || body.phone,
      customData: body.customData || {},
      createdById: (session.user as any).id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "Customer",
      entityId: customer.id,
      after: customer as any,
    },
  });

  return NextResponse.json(customer, { status: 201 });
}


