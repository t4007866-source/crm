import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); const type = searchParams.get("type"); const technicianId = searchParams.get("technicianId"); const region = searchParams.get("region");
  const tasks = await prisma.serviceTask.findMany({ where: { ...(status && status !== "ALL" ? { status: status as any } : {}), ...(type && type !== "ALL" ? { type: type as any } : {}), ...(technicianId === "UNASSIGNED" ? { technicianId: null, manualTechnicianName: null } : technicianId ? { technicianId } : {}), ...(region && region !== "ALL" ? { region } : {}) }, include: { customer: true, technician: { select: { id: true, name: true, phone: true } } }, orderBy: [{ scheduledStart: "asc" }, { createdAt: "asc" }], take: 1000 });
  const technicians = await prisma.user.findMany({ where: { isActive: true, role: "TECHNICIAN" }, select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ tasks, technicians });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions); if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const body = await req.json(); if (!body.customerId || !body.type || !body.title) return NextResponse.json({ error: "לקוח, סוג וכותרת הם שדות חובה" }, { status: 400 });
  const task = await prisma.serviceTask.create({ data: { customerId: body.customerId, type: body.type, status: body.scheduledStart ? "SCHEDULED" : "OPEN", title: body.title, productType: body.productType || null, region: body.region || null, technicianId: body.technicianId || null, manualTechnicianName: body.manualTechnicianName || null, scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null, scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null, executionNotes: body.executionNotes || null, partsReplaced: body.partsReplaced || [], nextServiceDueDate: body.nextServiceDueDate ? new Date(body.nextServiceDueDate) : null, sourceId: body.sourceId || null, sourceType: body.sourceType || null, addressSnapshot: body.addressSnapshot || null }, include: { customer: true, technician: { select: { id: true, name: true, phone: true } } } });
  return NextResponse.json({ task }, { status: 201 });
}

