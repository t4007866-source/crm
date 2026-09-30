import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { hashSecret } from "@/lib/integration-security";

async function admin() {
  const session = await getServerSession(authOptions);
  if (!session) return { response: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  if (!can((session.user as any).role, "integrations", "edit", (session.user as any).permissions)) return { response: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const auth = await admin();
  if (auth.response) return auth.response;
  const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, lastFour: true, permissions: true, ipAllowlist: true, lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true } });
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const auth = await admin();
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "חסר שם למפתח" }, { status: 400 });
  const raw = `sk_live_${randomBytes(24).toString("base64url")}`;
  const key = await prisma.apiKey.create({ data: { name: String(body.name), keyHash: hashSecret(raw), lastFour: raw.slice(-4), permissions: Array.isArray(body.permissions) ? body.permissions : ["leads:read"], ipAllowlist: Array.isArray(body.ipAllowlist) ? body.ipAllowlist : [], expiresAt: body.expiresAt ? new Date(body.expiresAt) : null, createdById: (auth.session!.user as any).id } });
  await prisma.auditLog.create({ data: { userId: (auth.session!.user as any).id, action: "CREATE", entity: "ApiKey", entityId: key.id, after: { name: key.name, lastFour: key.lastFour, permissions: key.permissions } as any } });
  return NextResponse.json({ key: { id: key.id, name: key.name, lastFour: key.lastFour, permissions: key.permissions }, secret: raw, warning: "הסוד מוצג פעם אחת בלבד. שמור אותו בכספת מאובטחת." }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await admin();
  if (auth.response) return auth.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר מזהה" }, { status: 400 });
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ success: true });
}

