import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { encryptConfig, maskSecret } from "@/lib/integration-security";

async function sessionWith(action: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { response: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  if (!can((session.user as any).role, "integrations", action, (session.user as any).permissions)) return { response: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) };
  return { session };
}

function publicConnection(item: any) {
  return { ...item, encryptedConfig: undefined, secrets: undefined, secretPreview: "••••••••••••" };
}

export async function GET() {
  const auth = await sessionWith("view");
  if (auth.response) return auth.response;
  const connections = await prisma.integrationConnection.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ connections: connections.map(publicConnection) });
}

export async function POST(req: NextRequest) {
  const auth = await sessionWith("edit");
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body?.provider || !body?.name || !body?.config || typeof body.config !== "object") return NextResponse.json({ error: "נדרשים ספק, שם והגדרות" }, { status: 400 });
  const connection = await prisma.integrationConnection.create({ data: { provider: String(body.provider), name: String(body.name), mode: body.mode === "PRODUCTION" ? "PRODUCTION" : "SANDBOX", encryptedConfig: encryptConfig(body.config), status: "CONNECTED", createdById: (auth.session!.user as any).id, lastHealthCheckAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: (auth.session!.user as any).id, action: "CREATE", entity: "IntegrationConnection", entityId: connection.id, after: { provider: connection.provider, name: connection.name, mode: connection.mode, status: connection.status } as any } });
  return NextResponse.json({ connection: publicConnection(connection) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await sessionWith("edit");
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "חסר מזהה חיבור" }, { status: 400 });
  const before = await prisma.integrationConnection.findUnique({ where: { id: body.id } });
  if (!before) return NextResponse.json({ error: "החיבור לא נמצא" }, { status: 404 });
  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.mode !== undefined) data.mode = body.mode === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";
  if (body.status !== undefined) data.status = ["CONNECTED", "PAUSED", "DISCONNECTED"].includes(body.status) ? body.status : before.status;
  if (body.config !== undefined) data.encryptedConfig = encryptConfig(body.config);
  const connection = await prisma.integrationConnection.update({ where: { id: body.id }, data });
  await prisma.auditLog.create({ data: { userId: (auth.session!.user as any).id, action: "UPDATE", entity: "IntegrationConnection", entityId: connection.id, before: { provider: before.provider, name: before.name, status: before.status, mode: before.mode } as any, after: { provider: connection.provider, name: connection.name, status: connection.status, mode: connection.mode } as any } });
  return NextResponse.json({ connection: publicConnection(connection) });
}

export async function DELETE(req: NextRequest) {
  const auth = await sessionWith("delete");
  if (auth.response) return auth.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר מזהה חיבור" }, { status: 400 });
  await prisma.integrationConnection.update({ where: { id }, data: { status: "DISCONNECTED", encryptedConfig: encryptConfig({}) } });
  await prisma.auditLog.create({ data: { userId: (auth.session!.user as any).id, action: "DISCONNECT", entity: "IntegrationConnection", entityId: id, after: { status: "DISCONNECTED" } as any } });
  return NextResponse.json({ success: true });
}

