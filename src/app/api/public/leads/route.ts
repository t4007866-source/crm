import { LeadSource } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function normalizePhone(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSource(value: unknown): LeadSource {
  const candidate = String(value ?? "OTHER").trim().toUpperCase();
  return Object.values(LeadSource).includes(candidate as LeadSource)
    ? (candidate as LeadSource)
    : LeadSource.OTHER;
}

export async function POST(request: NextRequest) {
  try {
    const expectedKey = process.env.PUBLIC_API_KEY;
    const providedKey = request.headers.get("x-api-key");

    if (expectedKey && providedKey !== expectedKey) {
      return NextResponse.json({ error: "מפתח API לא תקין" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(
      body.name ??
        body.full_name ??
        [body.firstName, body.lastName].filter(Boolean).join(" ")
    ).trim();
    const phone = normalizePhone(body.phone ?? body.phone_number ?? body.tel);
    const email = body.email ?? body.email_address ?? null;
    const source = normalizeSource(body.source);

    if (!name || !phone) {
      return NextResponse.json(
        { error: "חסרים שדות חובה: name ו-phone" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {
        ...(email ? { email: String(email) } : {}),
        ...(body.city ? { city: String(body.city) } : {}),
      },
      create: {
        name,
        phone,
        email: email ? String(email) : null,
        company: body.company ? String(body.company) : null,
        city: body.city ? String(body.city) : null,
        status: "LEAD",
        source,
        confidence: "MEDIUM",
      },
    });

    const lead = await prisma.lead.create({
      data: {
        customerId: customer.id,
        name,
        company: body.company ? String(body.company) : null,
        email: email ? String(email) : null,
        phone,
        city: body.city ? String(body.city) : null,
        source,
        stage: "NEW",
        confidence: "MEDIUM",
        interests: Array.isArray(body.interests) ? body.interests : [],
        currentSystem: body.currentSystem
          ? String(body.currentSystem)
          : null,
        utmData: body.utm ?? body.utmData ?? {},
        value:
          body.value !== undefined && body.value !== null && body.value !== ""
            ? Number(body.value)
            : null,
      },
    });

    return NextResponse.json(
      { success: true, leadId: lead.id, customerId: customer.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Public lead creation failed", error);
    return NextResponse.json(
      { error: "אירעה שגיאה בקליטת הליד" },
      { status: 500 }
    );
  }
}

