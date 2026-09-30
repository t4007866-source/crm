import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { answerQuestion } from "@/lib/ai/assistant";
import { canUseAi } from "@/lib/ai/permissions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const ctx = { role: String((session.user as any).role || "VIEWER"), userId: String((session.user as any).id || "") };
  if (!canUseAi(ctx.role, (session.user as any).permissions)) return NextResponse.json({ error: "אין הרשאה לעוזר AI" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question : "";
  if (!question.trim()) return NextResponse.json({ error: "נא להזין שאלה" }, { status: 400 });
  if (process.env.AI_ASSISTANT_ENABLED === "false") return NextResponse.json({ error: "עוזר AI מושבת כרגע" }, { status: 503 });
  const answer = await answerQuestion(prisma, question, ctx);
  await prisma.auditLog.create({ data: { userId: ctx.userId, action: "AI_QUERY", entity: "AI_ASSISTANT", after: { question, source: answer.source } } });
  return NextResponse.json({ answer });
}


