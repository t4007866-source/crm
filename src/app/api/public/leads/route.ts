import { NextRequest, NextResponse } from "next/server";
import { LeadSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/public/leads
 * קליטת ליד חיצוני דרך API מאובטח במפתח x-api-key.
 * תואם לסכמת שי סחר Foundation v3 (Lead.name חובה, LeadSource enum, Customer.phone unique).
 */
export async function POST(req: NextRequest) {
  // ── אימות מפתח API ──────────────────────────────
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.PUBLIC_API_KEY;
  if (!expectedKey || !apiKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { error: "API key לא תקין" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON לא תקין" }, { status: 400 });
  }

  // ── חילוץ שדות עם תמיכה בשמות חלופיים ───────────
  const name =
    (body.name as string) ||
    (body.full_name as string) ||
    ([body.firstName, body.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "");
  const phone = (body.phone as string) || (body.phone_number as string) || (body.tel as string);
  const email = (body.email as string) || (body.email_address as string) || null;
  const city = (body.city as string) || (body.city_name as string) || null;
  const company = (body.company as string) || null;
  const rawSource = (body.source as string) || "OTHER";

  // ── ולידציה: שדות חובה ─────────────────────────
  if (!name || !phone) {
    return NextResponse.json(
      { error: "חסרים שדות חובה: name, phone" },
      { status: 400 }
    );
  }

  // ── נרמול מקור הליד ל-enum LeadSource ───────────
  const normalizedSource = String(rawSource).trim().toUpperCase();
  const leadSource: LeadSource = (Object.values(LeadSource) as string[]).includes(
    normalizedSource
  )
    ? (normalizedSource as LeadSource)
    : LeadSource.OTHER;

  // ── בדיקת כפילות לקוח לפי טלפון (unique) ────────
  let customer = await prisma.customer.findUnique({ where: { phone } });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name,
        phone, // חובה + unique בסכמה
        email,
        city,
        status: "LEAD",
        source: leadSource,
        confidence: "MEDIUM",
      },
    });
  }

  // ── יצירת הליד — name חובה בסכמה ────────────────
  const lead = await prisma.lead.create({
    data: {
      customerId: customer.id,
      name, // ← שדה חובה (Lead.name String)
      company,
      email,
      phone,
      city,
      source: leadSource,
      stage: "NEW",
      confidence: "MEDIUM",
      interests: Array.isArray(body.interests) ? body.interests : [],
      currentSystem: (body.currentSystem as string) || null,
      utmData: (body.utm as Prisma.InputJsonValue) ?? {
        utm_source: (body.utm_source as string) || null,
        utm_campaign: (body.utm_campaign as string) || null,
        utm_adset: (body.utm_adset as string) || null,
        utm_content: (body.utm_content as string) || null,
      },
      value: body.value != null ? Number(body.value) : null,
    },
  });

  return NextResponse.json(
    { success: true, leadId: lead.id, customerId: customer.id },
    { status: 201 }
  );
}



