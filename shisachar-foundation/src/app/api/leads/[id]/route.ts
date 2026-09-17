import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "leads", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const before = await prisma.lead.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "ליד לא נמצא" }, { status: 404 });
  const data: any = {};
  for (const key of ["name", "company", "email", "phone", "city", "source", "stage", "confidence", "value", "notes", "currentSystem", "quoteIncludesVat", "quoteIncludesInstallation", "ordered", "optedOut"]) if (body[key] !== undefined) data[key] = key === "value" ? (body[key] === "" ? null : Number(body[key])) : body[key];
  if (body.interests !== undefined) data.interests = body.interests;
  if (body.utmData !== undefined) data.utmData = body.utmData;
  const lead = await prisma.lead.update({ where: { id }, data });
  await prisma.leadActivity.create({ data: { leadId: id, type: "SYSTEM", subject: "פרטי ליד עודכנו", body: "פרטים עודכנו בכרטיס הליד", createdById: (session.user as any).id } });
  return NextResponse.json({ lead });
}

