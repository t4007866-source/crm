import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { role?: string } | undefined;
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (actor?.role !== "ADMIN") return NextResponse.json({ error: "רק מנהל מערכת יכול לצפות ביומן הביקורת" }, { status: 403 });

  const logs = await prisma.auditLog.findMany({
    where: { entity: "User" },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ logs });
}

