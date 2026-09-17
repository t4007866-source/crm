import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Period = "today" | "week" | "month" | "custom";
type SearchParams = { period?: string };

const colors = ["#17a99a", "#f15a3a", "#3d8bfd", "#7657d9", "#f3b638", "#e9578f", "#2e7d32", "#c45a2a"];
const statusLabels: Record<string, string> = { NEW: "חדש", CONTACTED: "נוצר קשר", QUALIFIED: "מתעניין", PROPOSAL: "הצעה", NEGOTIATION: "מו״מ", WON: "לקוח", LOST: "אבוד" };
const orderLabels: Record<string, string> = { DRAFT: "טיוטה", CONFIRMED: "אושרה", IN_PROGRESS: "בתהליך", COMPLETED: "הושלמה", CANCELLED: "בוטלה" };
const serviceLabels: Record<string, string> = { OPEN: "פתוחה", SCHEDULED: "מתוזמנת", IN_PROGRESS: "בטיפול", COMPLETED: "הושלמה", CANCELLED: "בוטלה" };

function periodRange(period: Period) {
  const now = new Date();
  const start = new Date(now);
  if (period === "today") start.setHours(0, 0, 0, 0);
  else if (period === "week") { start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0); }
  else { start.setDate(1); start.setHours(0, 0, 0, 0); }
  return { start, end: now };
}

function pct(value: number, total: number) { return total ? Math.round((value / total) * 100) : 0; }
function money(value: number) { return `₪${Math.round(value || 0).toLocaleString("he-IL")}`; }
function dateText(value: Date | string) { return new Date(value).toLocaleDateString("he-IL"); }
function timeText(value: Date | string) { return new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); }

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const role = user?.role || "VIEWER";
  const userId = user?.id || "";
  const params = searchParams ? await searchParams : {};
  const period = (["today", "week", "month", "custom"].includes(params.period || "") ? params.period : "month") as Period;
  const { start, end } = periodRange(period);
  const isManager = ["ADMIN", "MANAGER"].includes(role);
  const canSales = can(role, "leads", "view");
  const canCustomers = can(role, "customers", "view");
  const canOrders = can(role, "orders", "view");
  const canService = can(role, "serviceCalendar", "view");
  const canInventory = can(role, "inventory", "view");
  const canTasks = can(role, "tasks", "view");

  const customerWhere: any = role === "SALES_REP" ? { assignedToId: userId } : {};
  const leadWhere: any = role === "SALES_REP" ? { assignedToId: userId } : {};
  const orderWhere: any = role === "SALES_REP" ? { customer: { assignedToId: userId } } : {};
  const serviceWhere: any = role === "TECHNICIAN" ? { technicianId: userId } : {};
  const taskWhere: any = role === "TECHNICIAN" ? { assignedToId: userId } : {};

  const [
    customers, activeCustomers, newCustomers, leads, openLeads, wonLeads, leadsByStage,
    orders, activeOrders, orderCounts, revenue, previousRevenue, revenueOrders, serviceCalls,
    dueToday, overdueTasks, inventoryLow, appointments, customKpis, recentLeads, recentOrders,
  ] = await Promise.all([
    canCustomers ? prisma.customer.count({ where: customerWhere }) : Promise.resolve(0),
    canCustomers ? prisma.customer.count({ where: { ...customerWhere, status: "ACTIVE" } }) : Promise.resolve(0),
    canCustomers ? prisma.customer.count({ where: { ...customerWhere, createdAt: { gte: start, lte: end } } }) : Promise.resolve(0),
    canSales ? prisma.lead.count({ where: leadWhere }) : Promise.resolve(0),
    canSales ? prisma.lead.count({ where: { ...leadWhere, stage: { notIn: ["WON", "LOST"] } } }) : Promise.resolve(0),
    canSales ? prisma.lead.count({ where: { ...leadWhere, stage: "WON" } }) : Promise.resolve(0),
    canSales ? prisma.lead.groupBy({ by: ["stage"], where: leadWhere, _count: { _all: true } }) : Promise.resolve([]),
    canOrders ? prisma.order.count({ where: orderWhere }) : Promise.resolve(0),
    canOrders ? prisma.order.count({ where: { ...orderWhere, status: { in: ["CONFIRMED", "IN_PROGRESS"] } } }) : Promise.resolve(0),
    canOrders ? prisma.order.groupBy({ by: ["status"], where: orderWhere, _count: { _all: true } }) : Promise.resolve([]),
    canOrders ? prisma.order.aggregate({ where: { ...orderWhere, createdAt: { gte: start, lte: end }, status: { not: "CANCELLED" } }, _sum: { total: true } }) : Promise.resolve({ _sum: { total: 0 } }),
    canOrders ? prisma.order.aggregate({ where: { ...orderWhere, createdAt: { gte: new Date(start.getTime() - (end.getTime() - start.getTime())), lt: start }, status: { not: "CANCELLED" } }, _sum: { total: true } }) : Promise.resolve({ _sum: { total: 0 } }),
    canOrders ? prisma.order.findMany({ where: { ...orderWhere, createdAt: { gte: start, lte: end }, status: { not: "CANCELLED" } }, select: { total: true, createdAt: true }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    canService ? prisma.serviceCall.count({ where: { ...serviceWhere, status: { in: ["OPEN", "SCHEDULED", "IN_PROGRESS"] } } }) : Promise.resolve(0),
    canTasks ? prisma.task.count({ where: { ...taskWhere, status: { in: ["TODO", "IN_PROGRESS"] }, dueAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(24, 0, 0, 0)) } } }) : Promise.resolve(0),
    canTasks ? prisma.task.count({ where: { ...taskWhere, status: { in: ["TODO", "IN_PROGRESS"] }, dueAt: { lt: new Date(), not: null } } }) : Promise.resolve(0),
    canInventory ? prisma.inventoryItem.count({ where: { quantityOnHand: { lte: 0 } } }) : Promise.resolve(0),
    canService ? prisma.appointment.findMany({ where: { ...((role === "TECHNICIAN") ? { technicianId: userId } : {}), startAtUtc: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(24, 0, 0, 0)) }, status: "SCHEDULED" }, orderBy: { startAtUtc: "asc" }, take: 6, include: { customer: { select: { id: true, name: true, city: true } }, technician: { select: { name: true } } } }) : Promise.resolve([]),
    prisma.dashboardKpi.findMany({ where: { userId, isActive: true }, orderBy: { position: "asc" } }),
    canSales ? prisma.lead.findMany({ where: leadWhere, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, phone: true, stage: true, createdAt: true } }) : Promise.resolve([]),
    canOrders ? prisma.order.findMany({ where: orderWhere, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, orderNumber: true, title: true, status: true, total: true, createdAt: true } }) : Promise.resolve([]),
  ]);

  const customValue = (k: any) => {
    if (k.source === "customers") return k.metric === "active" ? activeCustomers : customers;
    if (k.source === "leads") return k.metric === "open" ? openLeads : k.metric === "won" ? wonLeads : leads;
    if (k.source === "orders") return k.metric === "active" ? activeOrders : orders;
    if (k.source === "service") return k.metric === "completed" ? 0 : serviceCalls;
    if (k.source === "tasks") return k.metric === "overdue" ? overdueTasks : overdueTasks + dueToday;
    return "—";
  };

  const kpis = [
    canOrders && { label: "הכנסות בתקופה", value: money(revenue._sum.total || 0), hint: `${pct(Number(revenue._sum.total || 0), Number(previousRevenue._sum.total || 0))}% מול התקופה הקודמת`, href: "/orders", color: colors[1], icon: "₪" },
    canSales && { label: "לידים פתוחים", value: openLeads, hint: `${wonLeads} הומרו ללקוח`, href: "/leads", color: colors[2], icon: "L" },
    canOrders && { label: "הזמנות פעילות", value: activeOrders, hint: `${orders} סה״כ בתקופה`, href: "/orders", color: colors[3], icon: "O" },
    canService && { label: "קריאות שירות", value: serviceCalls, hint: "פתוחות / מתוזמנות / בטיפול", href: "/service-calendar", color: colors[0], icon: "S" },
    canTasks && { label: "משימות באיחור", value: overdueTasks, hint: `${dueToday} לביצוע היום`, href: "/tasks", color: colors[4], icon: "!" },
    canInventory && { label: "מלאי מתחת לסף", value: inventoryLow, hint: "נדרש טיפול במחסן", href: "/inventory", color: colors[5], icon: "I" },
    canCustomers && { label: "לקוחות פעילים", value: activeCustomers, hint: `${newCustomers} חדשים בתקופה`, href: "/customers?status=ACTIVE", color: colors[6], icon: "C" },
  ].filter(Boolean) as any[];

  const stageRows = (leadsByStage as any[]).map((row) => ({ label: statusLabels[row.stage] || row.stage, value: row._count._all, stage: row.stage }));
  const maxStage = Math.max(1, ...stageRows.map((x) => x.value));
  const orderRows = (orderCounts as any[]).map((row) => ({ label: orderLabels[row.status] || row.status, value: row._count._all }));
  const revenueByDay = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(end);
    day.setDate(end.getDate() - (6 - index));
    const key = day.toISOString().slice(0, 10);
    const total = (revenueOrders as any[]).filter((order) => new Date(order.createdAt).toISOString().slice(0, 10) === key).reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { label: day.toLocaleDateString("he-IL", { weekday: "short" }), total };
  });
  const maxRevenueDay = Math.max(1, ...revenueByDay.map((day) => day.total));

  return <div className="space-y-6" dir="rtl">
    <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
      <div><div className="text-sm font-semibold" style={{ color: "var(--rust)" }}>מערכת ניהול חכמה · מקור הנתונים: PostgreSQL</div><h1 className="text-3xl md:text-4xl font-black mt-1">לוח בקרה</h1><p className="mt-1" style={{ color: "var(--muted)" }}>שלום, {user?.name || "משתמש"} — תמונת מצב לפי ההרשאות שלך</p></div>
      <div className="flex flex-wrap gap-2 items-center"><div className="flex rounded-xl border overflow-hidden bg-white" style={{ borderColor: "var(--border)" }}>{[["today", "היום"], ["week", "השבוע"], ["month", "החודש"], ["custom", "טווח מותאם"]].map(([value, label]) => <Link key={value} href={value === "custom" ? "/reports" : `/dashboard?period=${value}`} className="px-3 py-2 text-sm" style={{ background: period === value ? "var(--ink)" : "white", color: period === value ? "white" : "var(--ink)" }}>{label}</Link>)}</div><Link href="/dashboard" className="btn-primary">↻ רענון</Link><Link href="/dashboard/kpi/new" className="btn-accent">+ התאמת לוח הבקרה</Link></div>
    </header>

    <section className="grid grid-cols-2 md:grid-cols-4 gap-3"><Quick href="/customers/new" icon="+" label="לקוח חדש" /><Quick href="/leads/new" icon="+" label="ליד חדש" /><Quick href="/orders" icon="+" label="הזמנה חדשה" /><Quick href="/service-calendar" icon="+" label="קריאת שירות" /><Quick href="/tasks" icon="+" label="משימה" /><Quick href="/service-map" icon="⌖" label="פתיחת מפה" /></section>

    <section><div className="flex items-end justify-between mb-3"><div><h2 className="text-xl font-black">מדדים מרכזיים</h2><p className="text-xs" style={{ color: "var(--muted)" }}>כל כרטיס לחיץ ומוביל לרשומות המקור</p></div><span className="text-xs" style={{ color: "var(--muted)" }}>עודכן: {new Date().toLocaleString("he-IL")}</span></div><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 stagger">{kpis.map((k) => <Link href={k.href} key={k.label} className="card p-4 card-enter group"><div className="flex justify-between items-center"><span className="text-xs font-bold" style={{ color: "var(--muted)" }}>{k.label}</span><span className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white" style={{ background: k.color }}>{k.icon}</span></div><div className="text-2xl font-black mt-3 num" style={{ color: k.color }}>{k.value}</div><div className="text-xs mt-2" style={{ color: "var(--muted)" }}>{k.hint}</div><div className="mt-3 text-xs font-bold group-hover:underline" style={{ color: "var(--rust)" }}>פתח פירוט ←</div></Link>)}</div></section>

    {customKpis.length > 0 && <section><div className="flex justify-between items-center mb-3"><div><h2 className="text-xl font-black">KPI מותאמים אישית</h2><p className="text-xs" style={{ color: "var(--muted)" }}>נשמרו לפי המשתמש שלך וניתנים לעריכה</p></div><Link href="/dashboard/kpi/new" className="text-sm font-bold" style={{ color: "var(--rust)" }}>+ הוסף KPI</Link></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{customKpis.map((k: any) => <Link href={`/${k.source === "customers" ? "customers" : k.source === "leads" ? "leads" : k.source === "orders" ? "orders" : k.source === "service" ? "service-calendar" : "tasks"}`} className="card p-4" key={k.id}><div className="w-10 h-1 rounded-full mb-4" style={{ background: k.color }} /><div className="text-sm" style={{ color: "var(--muted)" }}>{k.title}</div><div className="text-2xl font-black mt-1" style={{ color: k.color }}>{customValue(k)}</div><div className="text-xs mt-2" style={{ color: "var(--muted)" }}>{k.source} · {k.period}{k.target ? ` · יעד ${k.target}` : ""}</div></Link>)}</div></section>}

    <section className="grid grid-cols-1 xl:grid-cols-3 gap-4"><div className="card p-5 xl:col-span-2"><div className="flex justify-between items-start mb-4"><div><h2 className="text-xl font-black">דורש טיפול עכשיו</h2><p className="text-xs" style={{ color: "var(--muted)" }}>רשומות פעילות בלבד · לחץ לפתיחה</p></div><span className="badge badge-high">פעולה מיידית</span></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Action href="/leads" color="#3d8bfd" label="לידים ללא טיפול" value={openLeads} note="לידים בשלבים פתוחים" visible={canSales} /><Action href="/orders" color="#7657d9" label="הזמנות פעילות" value={activeOrders} note="אישור או המשך טיפול" visible={canOrders} /><Action href="/tasks" color="#c62828" label="משימות באיחור" value={overdueTasks} note="עבר מועד ביצוע" visible={canTasks} /><Action href="/inventory" color="#f3b638" label="מלאי חסר" value={inventoryLow} note="מוצרים ללא יתרה" visible={canInventory} /><Action href="/service-calendar" color="#17a99a" label="קריאות פתוחות" value={serviceCalls} note="שירות שטרם הושלם" visible={canService} /><Action href="/service-calendar" color="#f15a3a" label="התקנות היום" value={appointments.filter((a: any) => String(a.title || "").includes("תקנ")).length} note="מתוזמנות להיום" visible={canService} /></div></div><div className="card p-5"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-black">התראות מערכת</h2><Link href="/automations" className="text-xs underline" style={{ color: "var(--rust)" }}>לכל ההתראות</Link></div><Alert text={overdueTasks ? `${overdueTasks} משימות באיחור דורשות טיפול` : "אין משימות באיחור"} tone={overdueTasks ? "danger" : "success"} href="/tasks" /><Alert text={inventoryLow ? `${inventoryLow} פריטי מלאי ללא יתרה` : "המלאי מעל הסף"} tone={inventoryLow ? "warn" : "success"} href="/inventory" /><Alert text={canService && appointments.length ? `${appointments.length} אירועים מתוזמנים להיום` : "אין אירועים מתוזמנים להיום"} tone="info" href="/service-calendar" /></div></section>

    <section className="grid grid-cols-1 xl:grid-cols-2 gap-4"><div className="card p-5"><div className="flex justify-between items-center mb-4"><div><h2 className="text-xl font-black">משפך לידים ומכירות</h2><p className="text-xs" style={{ color: "var(--muted)" }}>מקור: Lead.stage · {leads} לידים</p></div><Link href="/leads" className="text-sm underline" style={{ color: "var(--rust)" }}>פתח לידים</Link></div>{stageRows.length ? <div className="space-y-3">{stageRows.map((row, index) => <Link href={`/leads?stage=${row.stage}`} key={row.label} className="block group"><div className="flex justify-between text-sm mb-1"><span>{row.label}</span><b>{row.value}</b></div><div className="h-3 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(8, (row.value / maxStage) * 100)}%`, background: colors[index % colors.length] }} /></div></Link>)}</div> : <Empty text="אין נתוני לידים להצגה" />}</div><div className="card p-5"><div className="flex justify-between items-center mb-4"><div><h2 className="text-xl font-black">הזמנות והכנסות</h2><p className="text-xs" style={{ color: "var(--muted)" }}>מקור: Order.total ו־Order.status · {money(Number(revenue._sum.total || 0))} בתקופה</p></div><Link href="/orders" className="text-sm underline" style={{ color: "var(--rust)" }}>פתח הזמנות</Link></div><div className="flex items-end gap-2 h-28 mb-4">{revenueByDay.map((day, i) => <div key={`${day.label}-${i}`} className="flex-1 h-full flex flex-col justify-end items-center gap-1"><div className="w-full rounded-t-lg" style={{ height: `${Math.max(day.total ? 8 : 2, (day.total / maxRevenueDay) * 100)}%`, background: `linear-gradient(180deg, ${colors[(i + 1) % colors.length]}, ${colors[(i + 1) % colors.length]}44)` }} title={`${day.label}: ${money(day.total)}`} /><span className="text-[10px]" style={{ color: "var(--muted)" }}>{day.label}</span></div>)}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{orderRows.map((row) => <Link href="/orders" key={row.label} className="rounded-xl p-3 bg-slate-50"><div className="text-xs" style={{ color: "var(--muted)" }}>{row.label}</div><b className="text-lg">{row.value}</b></Link>)}</div></div></section>

    {canService && <section className="card p-5"><div className="flex justify-between items-center mb-4"><div><h2 className="text-xl font-black">לוח שירות יומי</h2><p className="text-xs" style={{ color: "var(--muted)" }}>מקור: Appointment · היום {dateText(new Date())}</p></div><div className="flex gap-2"><Link href="/service-calendar" className="btn-primary">יומן מלא</Link><Link href="/service-map" className="btn-accent">מפת שירות</Link></div></div>{appointments.length ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{appointments.map((a: any) => <Link href="/service-calendar" key={a.id} className="rounded-2xl p-4 border bg-white hover:shadow-md" style={{ borderColor: "var(--border)" }}><div className="flex justify-between"><b>{timeText(a.startAtUtc)}</b><span className="badge badge-prospect">מתוזמן</span></div><div className="font-bold mt-2">{a.title}</div><div className="text-sm mt-1">{a.customer.name} · {a.customer.city || "ללא עיר"}</div><div className="text-xs mt-2" style={{ color: "var(--muted)" }}>טכנאי: {a.technician?.name || "טרם שובץ"}</div></Link>)}</div> : <Empty text="אין אירועי שירות מתוזמנים להיום" />}</section>}

    <section className="grid grid-cols-1 xl:grid-cols-2 gap-4"><div className="card p-5"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-black">המשך מאיפה שהפסקת</h2><span className="text-xs" style={{ color: "var(--muted)" }}>רשומות אחרונות</span></div><div className="space-y-2">{(recentLeads as any[]).map((lead) => <Link href={`/leads/${lead.id}`} key={lead.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 hover:bg-blue-50"><span><b>{lead.name}</b><span className="text-xs mr-2" style={{ color: "var(--muted)" }}>ליד · {dateText(lead.createdAt)}</span></span><span className="badge badge-prospect">{statusLabels[lead.stage] || lead.stage}</span></Link>)}{!(recentLeads as any[]).length && <Empty text="אין לידים אחרונים" />}</div></div><div className="card p-5"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-black">הזמנות אחרונות</h2><Link href="/orders" className="text-xs underline" style={{ color: "var(--rust)" }}>לכל ההזמנות</Link></div><div className="space-y-2">{(recentOrders as any[]).map((order) => <Link href="/orders" key={order.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 hover:bg-blue-50"><span><b>{order.orderNumber}</b><span className="text-xs mr-2" style={{ color: "var(--muted)" }}>{order.title}</span></span><span className="text-left"><b>{money(order.total)}</b><small className="block text-xs" style={{ color: "var(--muted)" }}>{orderLabels[order.status] || order.status}</small></span></Link>)}{!(recentOrders as any[]).length && <Empty text="אין הזמנות אחרונות" />}</div></div></section>

    <footer className="text-xs flex flex-wrap gap-3" style={{ color: "var(--muted)" }}><span>סטטוס חיבור למסד: <b style={{ color: "#2e7d32" }}>מחובר</b></span><span>תפקיד: {role}</span><span>הנתונים מוצגים בהתאם להרשאות המשתמש</span><Link href="/reports" className="underline" style={{ color: "var(--rust)" }}>דוחות וייצוא</Link></footer>
  </div>;
}

function Quick({ href, icon, label }: { href: string; icon: string; label: string }) { return <Link href={href} className="card p-3 flex items-center gap-3 hover:-translate-y-0.5"><span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black" style={{ background: "linear-gradient(135deg,var(--rust),var(--purple))" }}>{icon}</span><span className="text-sm font-bold">{label}</span></Link>; }
function Action({ href, color, label, value, note, visible }: { href: string; color: string; label: string; value: number; note: string; visible: boolean }) { if (!visible) return null; return <Link href={href} className="flex items-center gap-3 p-3 rounded-xl border hover:shadow-sm" style={{ borderColor: "var(--border)" }}><span className="w-3 h-10 rounded-full" style={{ background: color }} /><span className="flex-1"><b className="block">{label}</b><small style={{ color: "var(--muted)" }}>{note}</small></span><strong className="text-2xl num" style={{ color }}>{value}</strong><span style={{ color: "var(--muted)" }}>←</span></Link>; }
function Alert({ text, tone, href }: { text: string; tone: "danger" | "warn" | "info" | "success"; href: string }) { const map = { danger: ["#fff0ef", "#c62828", "!"], warn: ["#fff8e1", "#a66b00", "!"], info: ["#eaf3ff", "#2c6ecb", "i"], success: ["#e8f7f1", "#087f6d", "✓"] }; const [bg, color, icon] = map[tone]; return <Link href={href} className="flex items-center gap-3 p-3 rounded-xl mb-2" style={{ background: bg, color }}><span className="w-7 h-7 rounded-full flex items-center justify-center font-black" style={{ background: `${color}20` }}>{icon}</span><span className="text-sm font-semibold flex-1">{text}</span><span>←</span></Link>; }
function Empty({ text }: { text: string }) { return <div className="p-7 text-center rounded-xl bg-slate-50 text-sm" style={{ color: "var(--muted)" }}>{text}</div>; }





