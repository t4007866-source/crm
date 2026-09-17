// הרשאות מודולריות — סרגל הצד הרשמי של שי סחר
export const MODULES = [
  "dashboard", "customers", "orders", "inventory", "serviceCalendar", "serviceMap", "tasks", "leads", "automations", "integrations", "reports", "ai", "access", "users",
] as const;

export const ACTIONS = ["view", "create", "edit", "delete", "export", "approve"] as const;

const all = [...ACTIONS];
const operational = ["view", "create", "edit", "approve"];
const readOnly = ["view"];

export const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  ADMIN: Object.fromEntries(MODULES.map((m) => [m, all])),
  MANAGER: Object.fromEntries(MODULES.map((m) => [m, m === "access" || m === "users" ? ["view"] : all])),
  SALES_REP: Object.fromEntries(MODULES.map((m) => [m, ["dashboard", "customers", "leads", "tasks", "orders"].includes(m) ? operational : readOnly])),
  CUSTOMER_SERVICE: Object.fromEntries(MODULES.map((m) => [m, ["dashboard", "customers", "leads", "tasks", "serviceCalendar", "automations"].includes(m) ? operational : readOnly])),
  DISPATCHER: Object.fromEntries(MODULES.map((m) => [m, ["dashboard", "customers", "orders", "serviceCalendar", "serviceMap", "tasks"].includes(m) ? operational : readOnly])),
  TECHNICIAN: Object.fromEntries(MODULES.map((m) => [m, ["dashboard", "customers", "serviceCalendar", "serviceMap", "tasks"].includes(m) ? ["view", "edit"] : readOnly])),
  VIEWER: Object.fromEntries(MODULES.map((m) => [m, readOnly])),
};

export function can(role: string, module: string, action = "view") {
  return ROLE_PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}
export function canView(role: string, module: string) { return can(role, module, "view"); }

export const SIDEBAR = [
  { id: "dashboard", label: "לוח בקרה", href: "/dashboard" },
  { id: "customers", label: "לקוחות", href: "/customers" },
  { id: "orders", label: "הזמנות", href: "/orders" },
  { id: "inventory", label: "מלאי ושירותים", href: "/inventory" },
  { id: "serviceCalendar", label: "יומן שירות והתקנות", href: "/service-calendar" },
  { id: "serviceMap", label: "מפת שירות", href: "/service-map" },
  { id: "tasks", label: "משימות", href: "/tasks" },
  { id: "leads", label: "לידים נכנסים", href: "/leads" },
  { id: "automations", label: "אוטומציות", href: "/automations" },
  { id: "integrations", label: "אינטגרציות ו-API", href: "/integrations" },
  { id: "reports", label: "דוחות", href: "/reports" },
  { id: "ai", label: "עוזר AI", href: "/ai" },
  { id: "access", label: "הרשאות וגישה", href: "/access" },
  { id: "users", label: "ניהול משתמשים", href: "/users" },
];

export function sidebarFor(role: string) { return SIDEBAR.filter((item) => canView(role, item.id)); }

