import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIONS, MODULES, ROLE_PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "MANAGER", "SALES_REP", "CUSTOMER_SERVICE", "DISPATCHER", "TECHNICIAN", "VIEWER"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];
type PermissionMap = Record<string, string[]>;

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  isBlocked: true,
  emailVerified: true,
  inviteExpiresAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  permissions: true,
} as const;

function actorFrom(session: any) {
  return session?.user as { id?: string; role?: string } | undefined;
}

function isAdmin(actor: { role?: string } | undefined) {
  return actor?.role === "ADMIN";
}

function sanitizePermissions(value: unknown): PermissionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const result: PermissionMap = {};
  for (const module of MODULES) {
    const actions = input[module];
    if (Array.isArray(actions)) {
      result[module] = actions.filter(
        (action): action is string =>
          typeof action === "string" && (ACTIONS as readonly string[]).includes(action),
      );
    }
  }
  return result;
}

function safeAuditUser(user: any) {
  if (!user) return user;
  const { passwordHash, inviteToken, emailVerifyToken, ...safe } = user;
  return safe;
}

function normalizeRole(value: unknown): AllowedRole | null {
  const role = String(value || "");
  return (ALLOWED_ROLES as readonly string[]).includes(role) ? (role as AllowedRole) : null;
}

async function writeAudit(actorId: string, action: string, entityId: string, before: any, after: any) {
  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action,
      entity: "User",
      entityId,
      before: safeAuditUser(before) as any,
      after: safeAuditUser(after) as any,
    },
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const actor = actorFrom(session);
  if (!isAdmin(actor)) {
    return NextResponse.json({ error: "רק מנהל מערכת יכול לצפות במשתמשים" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    users,
    canManage: isAdmin(actor),
    role: actor?.role,
    modules: MODULES,
    actions: ACTIONS,
    roles: ROLE_PERMISSIONS,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const actor = actorFrom(session);
  if (!isAdmin(actor) || !actor?.id) {
    return NextResponse.json({ error: "רק מנהל מערכת יכול לערוך משתמשים" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "חסר מזהה משתמש" }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  if (body.isActive === false && target.isActive && target.role === "ADMIN") {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, isBlocked: false } });
    if (activeAdmins <= 1) return NextResponse.json({ error: "אי אפשר להשבית את מנהל המערכת האחרון" }, { status: 400 });
  }
  if (body.isBlocked === true && !target.isBlocked && target.role === "ADMIN") {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, isBlocked: false } });
    if (activeAdmins <= 1) return NextResponse.json({ error: "אי אפשר לחסום את מנהל המערכת האחרון" }, { status: 400 });
  }

  const data: any = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "שם המשתמש לא יכול להיות ריק" }, { status: 400 });
    data.name = name;
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!email || !email.includes("@")) return NextResponse.json({ error: "כתובת אימייל לא תקינה" }, { status: 400 });
    const existing = await prisma.user.findFirst({ where: { email, NOT: { id } } });
    if (existing) return NextResponse.json({ error: "אימייל זה כבר משויך למשתמש אחר" }, { status: 409 });
    data.email = email;
  }
  if (body.phone !== undefined) data.phone = String(body.phone || "").trim() || null;
  if (body.role !== undefined) {
    const role = normalizeRole(body.role);
    if (!role) return NextResponse.json({ error: "תפקיד לא תקין" }, { status: 400 });
    if (target.role === "ADMIN" && role !== "ADMIN") {
      const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, isBlocked: false } });
      if (activeAdmins <= 1) return NextResponse.json({ error: "אי אפשר להוריד את מנהל המערכת האחרון מתפקידו" }, { status: 400 });
    }
    data.role = role;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.isBlocked !== undefined) data.isBlocked = Boolean(body.isBlocked);
  if (body.approve === true) data.emailVerified = new Date();
  if (body.permissions !== undefined) data.permissions = sanitizePermissions(body.permissions) as any;

  if (!Object.keys(data).length) return NextResponse.json({ error: "לא נשלחו שינויים" }, { status: 400 });

  const user = await prisma.user.update({ where: { id }, data, select: userSelect });
  const action = body.approve === true ? "APPROVE_USER" : body.permissions !== undefined ? "UPDATE_USER_PERMISSIONS" : "UPDATE_USER";
  await writeAudit(actor.id, action, user.id, target, user);
  return NextResponse.json({ user });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const actor = actorFrom(session);
  if (!isAdmin(actor) || !actor?.id) return NextResponse.json({ error: "רק מנהל מערכת יכול לאפס סיסמאות" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  const id = String(body.id || "");

  // יצירת משתמש חדש עם סיסמה זמנית המוצגת לאדמין פעם אחת
  if (!id) {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim() || null;
    const role = normalizeRole(body.role || "VIEWER");
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

    if (!name) return NextResponse.json({ error: "שם המשתמש הוא שדה חובה" }, { status: 400 });
    if (!email || !email.includes("@")) return NextResponse.json({ error: "כתובת אימייל לא תקינה" }, { status: 400 });
    if (!role) return NextResponse.json({ error: "תפקיד לא תקין" }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "כבר קיים משתמש עם אימייל זה" }, { status: 409 });

    const temporaryPassword = String(body.temporaryPassword || randomBytes(9).toString("base64url"));
    if (temporaryPassword.length < 8) return NextResponse.json({ error: "הסיסמה הזמנית חייבת להכיל לפחות 8 תווים" }, { status: 400 });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role,
        isActive,
        isBlocked: false,
        emailVerified: new Date(),
        passwordHash: await hash(temporaryPassword, 12),
        permissions: ROLE_PERMISSIONS[role] as any,
      },
      select: userSelect,
    });

    await writeAudit(actor.id, "CREATE_USER", user.id, null, user);
    return NextResponse.json({ user, temporaryPassword }, { status: 201 });
  }

  if (id === actor.id) return NextResponse.json({ error: "לא ניתן לאפס את הסיסמה של המשתמש המחובר מפעולה זו" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  const temporaryPassword = randomBytes(9).toString("base64url");
  const updated = await prisma.user.update({
    where: { id },
    data: { passwordHash: await hash(temporaryPassword, 12), isActive: true, isBlocked: false },
    select: userSelect,
  });
  await writeAudit(actor.id, "RESET_USER_PASSWORD", updated.id, target, updated);
  return NextResponse.json({ user: updated, temporaryPassword });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const actor = actorFrom(session);
  if (!isAdmin(actor) || !actor?.id) return NextResponse.json({ error: "רק מנהל מערכת יכול להשבית משתמשים" }, { status: 403 });

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "חסר מזהה משתמש" }, { status: 400 });
  if (id === actor.id) return NextResponse.json({ error: "אי אפשר למחוק את המשתמש המחובר" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  if (target.role === "ADMIN" && target.isActive && !target.isBlocked) {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, isBlocked: false } });
    if (activeAdmins <= 1) return NextResponse.json({ error: "אי אפשר למחוק את מנהל המערכת הפעיל האחרון" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: false, isBlocked: true },
    select: userSelect,
  });
  await writeAudit(actor.id, "DELETE_USER_SOFT", user.id, target, user);
  return NextResponse.json({ user, softDeleted: true, message: "המשתמש הושבת ונחסם. ההיסטוריה והרשומות נשמרו." });
}




