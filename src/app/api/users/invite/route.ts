import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIONS, can, MODULES, ROLE_PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "MANAGER", "SALES_REP", "CUSTOMER_SERVICE", "DISPATCHER", "TECHNICIAN", "VIEWER"] as const;

type PermissionMap = Record<string, string[]>;

function sanitizePermissions(value: unknown): PermissionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const result: PermissionMap = {};
  for (const module of MODULES) {
    const actions = input[module];
    if (!Array.isArray(actions)) continue;
    result[module] = actions.filter((action): action is string => typeof action === "string" && (ACTIONS as readonly string[]).includes(action));
  }
  return result;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as any;
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (actor?.role !== "ADMIN" || !can(actor.role, "users", "create")) return NextResponse.json({ error: "רק אדמין יכול ליצור משתמשים" }, { status: 403 });

  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim() || null;
  const role = String(body.role || "VIEWER");
  const password = String(body.password || "");
  const confirmPassword = String(body.confirmPassword || "");

  if (!email || !name || !password || !confirmPassword) return NextResponse.json({ error: "שם, אימייל, סיסמה ואישור סיסמה הם שדות חובה" }, { status: 400 });
  if (!ROLES.includes(role as typeof ROLES[number])) return NextResponse.json({ error: "תפקיד לא תקין" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 8 תווים" }, { status: 400 });
  if (password !== confirmPassword) return NextResponse.json({ error: "הסיסמאות אינן זהות" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "משתמש עם האימייל הזה כבר קיים" }, { status: 409 });

  const customPermissions = sanitizePermissions(body.permissions);
  const permissions = Object.keys(customPermissions).length > 0 ? customPermissions : ROLE_PERMISSIONS[role];
  const user = await prisma.user.create({
    data: {
      email,
      name,
      phone,
      role: role as any,
      passwordHash: await hash(password, 12),
      isActive: true,
      isBlocked: false,
      emailVerified: new Date(),
      permissions: permissions as any,
    },
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, isBlocked: true, emailVerified: true, permissions: true },
  });

  await prisma.auditLog.create({ data: { userId: actor.id, action: "CREATE_USER", entity: "User", entityId: user.id, after: user as any } });
  return NextResponse.json({ message: "המשתמש נוצר בהצלחה", user }, { status: 201 });
}

