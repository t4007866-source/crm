import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { role?: string } | undefined;
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (actor?.role !== "ADMIN") return NextResponse.json({ error: "רק מנהל מערכת יכול לצפות בפרופילי משתמשים" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, role: true,
      isActive: true, isBlocked: true, emailVerified: true,
      inviteExpiresAt: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      permissions: true,
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      assignedTasks: { orderBy: { createdAt: "desc" }, take: 25 },
      technicianAppointments: { orderBy: { startAtUtc: "desc" }, take: 25 },
    },
  });

  if (!user) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  return NextResponse.json({ user });
}


