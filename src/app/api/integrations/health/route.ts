import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

async function auth() {
  const session = await getServerSession(authOptions);
  if (!session) return { response: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  if (!can((session.user as any).role, "integrations", "view", (session.user as any).permissions)) return { response: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) };
  return { session };
}

export async function GET(req: NextRequest) {
  const checked = await auth();
  if (checked.response) return checked.response;
  const provider = new URL(req.url).searchParams.get("provider") || undefined;
  const checks = await prisma.integrationHealthCheck.findMany({ where: provider ? { provider } : undefined, orderBy: { checkedAt: "desc" }, take: 200 });
  const grouped = Object.values(checks.reduce((acc: Record<string, any>, item) => { (acc[item.provider] ||= []).push(item); return acc; }, {}));
  return NextResponse.json({ checks, grouped });
}

export async function POST(req: NextRequest) {
  const checked = await auth();
  if (checked.response) return checked.response;
  const body = await req.json().catch(() => null);
  if (!body?.provider) return NextResponse.json({ error: "חסר ספק" }, { status: 400 });
  const started = Date.now();
  const status = body.status === "ERROR" ? "ERROR" : body.status === "WARNING" ? "WARNING" : "OK";
  const check = await prisma.integrationHealthCheck.create({ data: { provider: String(body.provider), status, responseMs: Number(body.responseMs) || Date.now() - started, message: body.message ? String(body.message) : null } });
  await prisma.integration.updateMany({ where: { key: String(body.provider) }, data: { lastCheckedAt: new Date(), lastError: status === "OK" ? null : check.message, status: status === "OK" ? "CONNECTED" : "ERROR" } });
  return NextResponse.json({ check });
}

