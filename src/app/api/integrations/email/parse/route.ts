import { NextRequest, NextResponse } from "next/server";
import { parseEmail, profileFromMapping } from "@/lib/email-parser";

export const dynamic = "force-dynamic";

/**
 * בדיקת מיפוי אימייל לפני חיבור ל-Gmail/Outlook.
 * POST /api/integrations/email/parse
 * Body: { subject?, from?, body: string, mapping?: object }
 */
export async function POST(request: NextRequest) {
  try {
    const expectedKey = process.env.PUBLIC_API_KEY;
    const suppliedKey = request.headers.get("x-api-key");

    if (expectedKey && suppliedKey !== expectedKey) {
      return NextResponse.json({ error: "מפתח API לא תקין" }, { status: 401 });
    }

    const payload = (await request.json()) as {
      subject?: unknown;
      from?: unknown;
      body?: unknown;
      mapping?: unknown;
    };

    if (typeof payload.body !== "string" || !payload.body.trim()) {
      return NextResponse.json(
        { error: "חסר שדה body עם תוכן האימייל" },
        { status: 400 }
      );
    }

    const result = parseEmail({
      subject: typeof payload.subject === "string" ? payload.subject : undefined,
      from: typeof payload.from === "string" ? payload.from : undefined,
      body: payload.body,
      profile: profileFromMapping(payload.mapping),
    });

    return NextResponse.json({
      success: true,
      data: result,
      next: {
        canCreateLead: Boolean(result.name && result.phone),
        missingRequiredFields: [
          !result.name ? "name" : null,
          !result.phone ? "phone" : null,
        ].filter(Boolean),
      },
    });
  } catch (error) {
    console.error("Email parsing failed", error);
    return NextResponse.json(
      { error: "אירעה שגיאה בניתוח האימייל" },
      { status: 500 }
    );
  }
}

