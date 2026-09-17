import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days") || 60)));
  const until = new Date(); until.setDate(until.getDate() + days);
  const systems = await prisma.installedSystem.findMany({ where: { isActive: true, nextFilterChangeDate: { lte: until } }, include: { customer: true }, orderBy: { nextFilterChangeDate: "asc" } });
  return NextResponse.json({ replacements: systems.map((s) => ({ id: s.id, customer: s.customer, system: s, overdue: !!s.nextFilterChangeDate && s.nextFilterChangeDate < new Date() })) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const body = await req.json();
  if (!body.customerId) return NextResponse.json({ error: "לקוח הוא חובה" }, { status: 400 });
  const task = await prisma.serviceTask.create({ data: { customerId: body.customerId, type: "FILTER_REPLACEMENT", title: body.title || "החלפת סננים תקופתית", status: "OPEN", productType: body.productType || null, sourceId: body.systemId || null, sourceType: "InstalledSystem", nextServiceDueDate: body.dueDate ? new Date(body.dueDate) : null } });
  return NextResponse.json({ task }, { status: 201 });
}

