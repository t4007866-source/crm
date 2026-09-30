import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseEmail, profileFromMapping } from "@/lib/email-parser";
import { canUseAi } from "@/lib/ai/permissions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const user = session.user as any;
  if (!canUseAi(String(user.role || "VIEWER"), user.permissions)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const text = [body.subject, body.from, body.text || body.body].filter(Boolean).join("\n");
  if (!text.trim()) return NextResponse.json({ error: "הדבק תוכן אימייל" }, { status: 400 });
  const parsed = parseEmail({ subject: body.subject, from: body.from, body: text, profile: profileFromMapping(body.mapping) });
  return NextResponse.json({ preview: parsed, canCreateLead: Boolean(parsed.name && parsed.phone), confidence: parsed.confidence, requiresHumanApproval: true });
}

