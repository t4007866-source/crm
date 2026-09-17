import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const defaults = [
  ["google_maps", "Google Maps", "MAPS"],
  ["google_routes", "Google Routes API", "MAPS"],
  ["whatsapp", "WhatsApp Cloud API", "MESSAGING"],
  ["google_calendar", "Google Calendar", "CALENDAR"],
  ["gmail", "Gmail", "EMAIL"],
  ["meta_leads", "Facebook / Instagram Leads", "LEADS"],
  ["make_zapier", "Make / Zapier", "AUTOMATION"],
  ["invoicing", "מערכת חשבוניות", "FINANCE"],
  ["ai", "עוזר AI", "AI"],
];

async function ensureDefaults() {
  for (const [key, name, category] of defaults) await prisma.integration.upsert({ where: { key }, update: {}, create: { key, name, category } });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "integrations", "view")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await ensureDefaults();
  const integrations = await prisma.integration.findMany({ include: { _count: { select: { events: true, webhooks: true, mappings: true } } }, orderBy: { name: "asc" } });
  return NextResponse.json({ integrations });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "integrations", "edit")) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await req.json();
  const integration = await prisma.integration.update({ where: { id: body.id }, data: { enabled: Boolean(body.enabled), status: body.enabled ? "CONFIGURED" : "DISCONNECTED", config: body.config || {}, lastError: null, lastCheckedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: (session.user as any).id, action: "UPDATE", entity: "Integration", entityId: integration.id, after: integration as any } });
  return NextResponse.json({ integration });
}

