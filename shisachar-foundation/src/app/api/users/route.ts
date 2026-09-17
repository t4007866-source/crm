import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canView } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const role = (session.user as any).role;
  const allowedModules = canView(role, "users") ? ["customers", "leads", "pipeline", "activity", "audit", "users", "settings"] : [];

  const users = (await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, isBlocked: true, emailVerified: true, lastLoginAt: true },
    orderBy: { createdAt: "asc" },
  }));

  return NextResponse.json({ allowedModules, users });
}

