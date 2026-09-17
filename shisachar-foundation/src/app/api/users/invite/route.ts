import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!can((session.user as any).role, "users", "create"))
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const body = await req.json();
  const allowedRoles = ["MANAGER", "SALES_REP", "CUSTOMER_SERVICE", "DISPATCHER", "TECHNICIAN", "VIEWER"];

  if (!allowedRoles.includes(body.role)) {
    return NextResponse.json({ error: "תפקיד לא תקין" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return NextResponse.json({ error: "משתמש כבר קיים" }, { status: 409 });
  }

  return NextResponse.json(
    { message: "INVITE_PENDING", email: body.email, role: body.role, hint: "שליחת הזמנת מייל תתבצע בשלב האימייל" },
    { status: 201 }
  );
}

