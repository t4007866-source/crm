import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "integrations", "view", (session.user as any).permissions)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  const [events, jobs] = await Promise.all([
    prisma.integrationEvent.findMany({ where: { status: { in: ["FAILED", "RETRYING", "DEAD_LETTER"] } }, include: { integration: { select: { name: true, key: true } } }, orderBy: { receivedAt: "desc" }, take: 100 }),
    prisma.integrationJob.findMany({ where: { status: { in: ["FAILED", "DEAD_LETTER"] } }, orderBy: { updatedAt: "desc" }, take: 100 }),
  ]);
  return NextResponse.json({ errors: [...events.map((e) => ({ ...e, kind: "event" })), ...jobs.map((j) => ({ ...j, kind: "job" }))] });
}

