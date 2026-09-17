import { NextRequest, NextResponse } from "next/server";
import { LeadSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/integration-security";

async function apiAuth(req: NextRequest, permission: string) {
  const raw = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || req.headers.get("x-api-key");
  if (!raw) return null;
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashSecret(raw) } });
  if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) return null;
  const permissions = Array.isArray(key.permissions) ? key.permissions as string[] : [];
  if (!permissions.includes(permission)) return null;
  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return key;
}

export async function GET(req: NextRequest) {
  const key = await apiAuth(req, "leads:read");
  if (!key) return NextResponse.json({ error: "API key לא תקין או ללא הרשאה" }, { status: 401 });
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 25)));
  const stage = url.searchParams.get("stage") || undefined;
  const [data, total] = await Promise.all([
    prisma.lead.findMany({ where: stage ? { stage: stage as any } : undefined, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.lead.count({ where: stage ? { stage: stage as any } : undefined }),
  ]);
  return NextResponse.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const key = await apiAuth(req, "leads:create");
  if (!key) return NextResponse.json({ error: "API key לא תקין או ללא הרשאה" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "name הוא שדה חובה" }, { status: 400 });
  const source = Object.values(LeadSource).includes(body.source) ? body.source : LeadSource.OTHER;
  const lead = await prisma.lead.create({ data: { name: String(body.name), phone: body.phone ? String(body.phone) : null, email: body.email ? String(body.email).toLowerCase() : null, company: body.company || null, city: body.city || null, source, notes: body.notes || null, interests: Array.isArray(body.interests) ? body.interests : [] } });
  return NextResponse.json({ data: lead }, { status: 201 });
}

