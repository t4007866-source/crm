import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { LeadSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseEmail, sourceFromEmail, type EmailInput } from "@/lib/email-parser";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function asEmailInput(body: any): EmailInput {
  return {
    from: body.from || body.sender || body.headers?.from,
    replyTo: body.replyTo || body.reply_to || body.headers?.["reply-to"],
    subject: body.subject || body.headers?.subject,
    text: body.text || body.textBody || body.body || body.body_text,
    html: body.html || body.htmlBody || body.body_html,
    date: body.date || body.headers?.date,
    headers: body.headers,
  };
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.EMAIL_INGEST_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "EMAIL_INGEST_SECRET לא מוגדר בשרת" }, { status: 503 });
  }
  if (req.headers.get("x-email-ingest-secret") !== expectedSecret) {
    return NextResponse.json({ error: "מפתח קליטת אימייל לא תקין" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Payload אימייל לא תקין" }, { status: 400 });

  const input = asEmailInput(body);
  if (!input.text && !input.html && !input.subject) {
    return NextResponse.json({ error: "חסר תוכן אימייל" }, { status: 400 });
  }

  const sender = String(input.from || "").toLowerCase().match(/<([^>]+)>/)?.[1] || String(input.from || "").trim();
  const domain = sender.split("@")[1] || "";
  const profileIntegration = await prisma.integration.findUnique({ where: { key: "gmail" }, include: { emailProfiles: true } });
  const profile = profileIntegration?.emailProfiles
    .filter((item) => item.enabled && (item.matchType === "SENDER" ? item.matchValue === sender : item.matchValue === domain))
    .sort((a, b) => b.priority - a.priority)[0];
  const parsed = parseEmail({ ...input, profile: profile?.mapping as any });
  const source = sourceFromEmail(input.from) as LeadSource;
  const idempotencyKey = body.messageId || body.message_id || req.headers.get("x-message-id") || hash(JSON.stringify({ input, body }));

  const integration = await prisma.integration.upsert({
    where: { key: "gmail" },
    update: { enabled: true, status: "CONNECTED", lastCheckedAt: new Date(), lastError: null },
    create: { key: "gmail", name: "Gmail", category: "EMAIL", enabled: true, status: "CONNECTED" },
  });

  const duplicate = await prisma.integrationEvent.findFirst({
    where: { integrationId: integration.id, idempotencyKey },
  });
  if (duplicate) {
    return NextResponse.json({ accepted: true, duplicate: true, eventId: duplicate.id });
  }

  const event = await prisma.integrationEvent.create({
    data: {
      integrationId: integration.id,
      eventType: "email.received",
      idempotencyKey,
      requestPayload: body,
      status: "PROCESSING",
    },
  });

  try {
    let customer = parsed.phone
      ? await prisma.customer.findUnique({ where: { phone: parsed.phone } })
      : null;

    if (!customer && parsed.phone) {
      customer = await prisma.customer.create({
        data: {
          name: parsed.name,
          company: parsed.company,
          email: parsed.email,
          phone: parsed.phone,
          city: parsed.city,
          status: "LEAD",
          source,
          confidence: parsed.confidence,
          notes: parsed.notes,
        },
      });
    }

    const lead = await prisma.lead.create({
      data: {
        customerId: customer?.id,
        name: parsed.name,
        company: parsed.company,
        email: parsed.email,
        phone: parsed.phone,
        city: parsed.city,
        source,
        stage: "NEW",
        confidence: parsed.confidence,
        interests: parsed.interests,
        currentSystem: parsed.currentSystem,
        notes: parsed.notes,
      },
    });

    await prisma.integrationEvent.update({
      where: { id: event.id },
      data: { status: "SUCCESS", processedAt: new Date(), responsePayload: { leadId: lead.id, customerId: customer?.id || null } },
    });

    return NextResponse.json({ accepted: true, leadId: lead.id, customerId: customer?.id || null, parsed }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    await prisma.integrationEvent.update({ where: { id: event.id }, data: { status: "FAILED", errorMessage: message, processedAt: new Date() } });
    return NextResponse.json({ error: "עיבוד האימייל נכשל", eventId: event.id }, { status: 500 });
  }
}


