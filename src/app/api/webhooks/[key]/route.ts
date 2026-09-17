import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { safeCompare, signPayload } from "@/lib/integration-security";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const integration = await prisma.integration.findUnique({ where: { key }, include: { webhooks: { where: { isActive: true }, take: 1 } } });
  if (!integration || !integration.enabled) return NextResponse.json({ error: "אינטגרציה לא פעילה" }, { status: 404 });
  const raw = await req.text();
  if (!raw) return NextResponse.json({ error: "Payload ריק" }, { status: 400 });
  const webhook = integration.webhooks[0];
  const signature = req.headers.get("x-webhook-signature") || req.headers.get("x-signature");
  if (webhook?.secretHash && signature && !safeCompare(signature, signPayload(raw, webhook.secretHash))) return NextResponse.json({ error: "חתימת Webhook לא תקינה" }, { status: 401 });
  const payload = JSON.parse(raw);
  const externalEventId = req.headers.get("x-idempotency-key") || req.headers.get("x-event-id") || hash(raw);
  const existing = await prisma.externalEvent.findUnique({ where: { provider_externalEventId: { provider: key, externalEventId } } });
  if (existing) return NextResponse.json({ accepted: true, duplicate: true, eventId: existing.id });
  const event = await prisma.externalEvent.create({ data: { provider: key, externalEventId, payloadHash: hash(raw), eventType: req.headers.get("x-event-type") || "webhook.received", payload, status: "QUEUED" } });
  await prisma.integrationJob.create({ data: { provider: key, jobType: "INBOUND_WEBHOOK", payload: { externalEventId: event.id }, status: "QUEUED" } });
  const legacyEvent = await prisma.integrationEvent.create({ data: { integrationId: integration.id, webhookId: webhook?.id, eventType: event.eventType, idempotencyKey: externalEventId, requestPayload: payload, status: "QUEUED" } });
  if (webhook) await prisma.webhookEndpoint.update({ where: { id: webhook.id }, data: { lastReceivedAt: new Date() } });
  return NextResponse.json({ accepted: true, queued: true, eventId: legacyEvent.id }, { status: 202 });
}


