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
  if (!body.customerId || !body.type) return NextResponse.json({ error: "לקוח וסוג קריאה הם חובה" }, { status: 400 });
  const count = await prisma.serviceCall.count();
  const call = await prisma.serviceCall.create({ data: { callNumber: `SR-${1001 + count}`, customerId: body.customerId, installedSystemId: body.installedSystemId || null, type: body.type, status: body.scheduledAt ? "SCHEDULED" : "OPEN", fault: body.fault || null, treatmentNotes: body.notes || null, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null } });
  if (body.scheduledAt) await prisma.appointment.create({ data: { customerId: body.customerId, installedSystemId: body.installedSystemId || null, type: body.type === "FILTER_CHANGE" ? "FILTER_REPLACEMENT" : "TECHNICIAN_SERVICE", title: `${call.callNumber} — ${body.fault || body.type}`, startAtUtc: new Date(body.scheduledAt), endAtUtc: body.endAt ? new Date(body.endAt) : null, timezone: "Asia/Jerusalem", status: "SCHEDULED", notes: body.notes || null } });
  await prisma.auditLog.create({ data: { userId: (session.user as any).id, action: "CREATE", entity: "ServiceCall", entityId: call.id, after: call as any } });
  return NextResponse.json({ call }, { status: 201 });
}

