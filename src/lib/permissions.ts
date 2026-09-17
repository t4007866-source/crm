// הרשאות מודולריות — סרגל הצד הרשמי של שי סחר
export const MODULES = [
  "dashboard", "customers", "quotes", "orders", "inventory", "serviceCalendar", "serviceMap", "fieldTech", "tasks", "leads", "automations", "integrations", "reports", "ai", "access", "users",
] as const;

export const ACTIONS = ["view", "create", "edit", "delete", "export", "approve", "activate"] as const;

const all = [...ACTIONS];
const operational = ["view", "create", "edit", "approve"];
const readOnly = ["view"];

export const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  ADMIN: Object.fromEntries(MODULES.map((m) => [m, all])),
  MANAGER: Object.fromEntries(MODULES.map((m) => [m, m === "access" ? ["view"] : m === "users" ? [] : all])),
  SALES_REP: Object.fromEntries(MODULES.map((m) => [m, ["dashboard", "customers", "quotes", "leads", "tasks", "orders"].includes(m) ? operational : readOnly])),
  CUSTOMER_SERVICE: Object.fromEntries(MODULES.map((m) => [m, ["dashboard", "customers", "leads", "tasks", "serviceCalendar", "automations"].includes(m) ? operational : readOnly])),
  DISPATCHER: Object.fromEntries(MODULES.map((m) => [m, ["dashboard", "customers", "orders", "serviceCalendar", "serviceMap", "tasks"].includes(m) ? operational : readOnly])),
  TECHNICIAN: Object.fromEntries(MODULES.map((m) => [m, ["dashboard", "customers", "serviceCalendar", "serviceMap", "fieldTech", "tasks"].includes(m) ? ["view", "edit"] : readOnly])),
  VIEWER: Object.fromEntries(MODULES.map((m) => [m, readOnly])),
};

export function can(role: string, module: string, action = "view", overrides?: Record<string, string[]>): boolean {
  // הפעלה ואישור של אוטומציות שמשנות נתונים נשארים בידי מנהל בלבד.
  if (module === "automations" && (action === "activate" || action === "approve")) {
    return role === "ADMIN" || role === "MANAGER";
  }
  const perms = overrides?.[module] ?? ROLE_PERMISSIONS[role]?.[module];
  return perms?.includes(action) ?? false;
}
export function canView(role: string, module: string, overrides?: Record<string, string[]>): boolean { return can(role, module, "view", overrides); }

export const SIDEBAR = [
  { id: "dashboard", label: "לוח בקרה", href: "/dashboard" },
  { id: "customers", label: "לקוחות", href: "/customers" },
  { id: "quotes", label: "הצעות מחיר", href: "/quotes" },
  { id: "orders", label: "הזמנות", href: "/orders" },
  { id: "inventory", label: "מלאי ושירותים", href: "/inventory" },
  { id: "serviceCalendar", label: "מרכז שירות — יומן ומפה", href: "/service-calendar" },
  { id: "fieldTech", label: "טכנאים", href: "/technicians" },
  { id: "tasks", label: "משימות", href: "/tasks" },
  { id: "leads", label: "לידים נכנסים", href: "/leads" },
  { id: "automations", label: "אוטומציות", href: "/automations" },
  { id: "integrations", label: "אינטגרציות ו-API", href: "/integrations" },
  { id: "reports", label: "דוחות", href: "/reports" },
  { id: "ai", label: "עוזר AI", href: "/ai" },
  { id: "access", label: "הרשאות וגישה", href: "/access" },
  { id: "users", label: "ניהול משתמשים", href: "/users" },
];

export function sidebarFor(role: string, overrides?: Record<string, string[]>) { return SIDEBAR.filter((item) => canView(role, item.id, overrides)); }












