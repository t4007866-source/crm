import { prisma } from "@/lib/prisma";
import { ACTIONS, ROLE_PERMISSIONS } from "@/lib/permissions";

export const ACCESS_SCOPES = ["ALL", "BRANCH", "AREA", "TEAM", "ASSIGNED", "CREATED_BY"] as const;
export type AccessScope = (typeof ACCESS_SCOPES)[number];

export const PERMISSION_CATALOG = [
  ["dashboard", ["view"]],
  ["customers", ["view", "create", "edit", "delete", "export", "view_sensitive"]],
  ["leads", ["view", "create", "edit", "assign", "convert", "export", "delete"]],
  ["orders", ["view", "create", "edit", "delete", "export", "approve"]],
  ["inventory", ["view", "create", "edit", "delete", "export", "approve"]],
  ["serviceCalendar", ["view", "create", "edit", "delete", "export", "assign"]],
  ["serviceMap", ["view", "export"]],
  ["fieldTech", ["view", "create", "edit", "assign", "export"]],
  ["tasks", ["view", "create", "edit", "delete", "assign", "export"]],
  ["automations", ["view", "create", "edit", "delete", "pause", "approve"]],
  ["integrations", ["view", "create", "edit", "delete", "manage"]],
  ["reports", ["view", "create", "edit", "delete", "export", "view_sensitive"]],
  ["ai", ["view", "create", "approve"]],
  ["access", ["view", "manage"]],
  ["users", ["view", "create", "edit", "delete", "manage"]],
  ["whatsapp", ["send_manual", "send_automated", "approve_template"]],
] as const;

export const PERMISSION_KEYS = PERMISSION_CATALOG.flatMap(([module, actions]) =>
  actions.map((action) => `${module}.${action}`)
);

function legacyAllows(role: string, module: string, action: string, permissions: unknown) {
  const overrides = permissions && typeof permissions === "object" && !Array.isArray(permissions)
    ? (permissions as Record<string, unknown>)
    : undefined;
  const override = overrides?.[module];
  if (Array.isArray(override)) return override.includes(action);
  if (override && typeof override === "object") return (override as Record<string, unknown>)[action] === true;
  return ROLE_PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}

export async function hasPermission(userId: string, key: string): Promise<boolean> {
  const [module, action] = key.split(".");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isActive: true,
      isBlocked: true,
      permissions: true,
      customRoleAssignments: {
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], customRole: { isActive: true } },
        include: { customRole: { include: { permissions: { include: { permission: true } } } } },
      },
      temporaryPermissions: { where: { startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } },
    },
  });
  if (!user || !user.isActive || user.isBlocked) return false;
  if (user.role === "ADMIN") return true;
  if (legacyAllows(user.role, module, action, user.permissions)) return true;
  if (user.temporaryPermissions.some((p) => p.permissionKey === key)) return true;
  return user.customRoleAssignments.some((a) => a.customRole.permissions.some((p) => p.permission.key === key && Array.isArray(p.actions) && (p.actions as unknown[]).includes(action)));
}

export async function canAccessRecord(userId: string, key: string, record: { assignedToId?: string | null; createdById?: string | null; branchId?: string | null; areaId?: string | null }) {
  if (await hasPermission(userId, key)) {
    const scope = await effectiveScope(userId, key);
    if (scope === "ALL") return true;
    if (scope === "ASSIGNED") return record.assignedToId === userId;
    if (scope === "CREATED_BY") return record.createdById === userId;
    // BRANCH/AREA/TEAM require organization fields in the existing schema; keep the record visible
    // until those optional fields are configured rather than accidentally hiding legacy data.
    return Boolean(record.branchId || record.areaId) ? Boolean(record.branchId || record.areaId) : true;
  }
  return false;
}

export async function canViewField(userId: string, permissionKey: string, field: string) {
  if (!(await hasPermission(userId, permissionKey))) return false;
  if (permissionKey.endsWith(".view_sensitive")) return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "ADMIN" || !["cost", "margin", "profit", "paymentDetails", "internalNotes"].includes(field);
}

export async function effectiveScope(userId: string, key: string): Promise<AccessScope> {
  const rows = await prisma.customRolePermission.findMany({
    where: { permission: { key }, customRole: { isActive: true, assignments: { some: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } } } },
    select: { scope: true },
  });
  const scope = rows[0]?.scope;
  return ACCESS_SCOPES.includes(scope as AccessScope) ? (scope as AccessScope) : "ALL";
}

export function isKnownPermissionKey(key: string) {
  return PERMISSION_KEYS.includes(key);
}

export function isValidAction(action: string) {
  return (ACTIONS as readonly string[]).includes(action) || ["view_sensitive", "assign", "convert", "pause", "manage", "send_manual", "send_automated", "approve_template"].includes(action);
}

