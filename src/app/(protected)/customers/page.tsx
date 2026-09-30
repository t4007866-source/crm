"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ExportBar from "@/components/ExportBar";

const statusOptions = [["", "כל הסטטוסים"], ["LEAD", "ליד"], ["PROSPECT", "פוטנציאלי"], ["ACTIVE", "לקוח פעיל"], ["CHURNED", "עזב"]];
const sourceOptions = [["", "כל המקורות"], ["WEBSITE", "אתר"], ["FACEBOOK", "Facebook"], ["INSTAGRAM", "Instagram"], ["REFERRAL", "הפניה"], ["WHATSAPP", "WhatsApp"], ["GMAIL", "אימייל"], ["OTHER", "אחר"]];
const statusLabel: Record<string, string> = { LEAD: "ליד", PROSPECT: "פוטנציאלי", ACTIVE: "פעיל", CHURNED: "עזב" };
const sourceLabel: Record<string, string> = Object.fromEntries(sourceOptions.filter(([value]) => value).map(([value, label]) => [value, label]));

type Filters = { search: string; status: string; city: string; assignedToId: string; systemType: string; source: string; installationFrom: string; installationTo: string; serviceFrom: string; serviceTo: string; isNew: boolean; openService: boolean; reminderSoon: boolean };
const initialFilters: Filters = { search: "", status: "", city: "", assignedToId: "", systemType: "", source: "", installationFrom: "", installationTo: "", serviceFrom: "", serviceTo: "", isNew: false, openService: false, reminderSoon: false };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({ active: 0, newThisMonth: 0, upcoming: 0, inactive: 0, byCity: [] });
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    params.set("page", String(page));
    return params.toString();
  }, [filters, page]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/customers?${queryString}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "לא ניתן לטעון לקוחות");
      setCustomers(data.customers || []);
      setKpis(data.kpis || { active: 0, newThisMonth: 0, upcoming: 0, inactive: 0, byCity: [] });
      setUsers(data.options?.users || []);
      setMeta(data.meta || { page, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת הלקוחות");
    } finally {
      setLoading(false);
    }
  }, [page, queryString]);

  useEffect(() => {
    const timer = window.setTimeout(fetchCustomers, filters.search ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [fetchCustomers, filters.search]);

  const updateFilter = (key: keyof Filters, value: string | boolean) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const resetFilters = () => { setPage(1); setFilters(initialFilters); };

  const deleteCustomer = async (customer: any) => {
    if (!window.confirm(`האם למחוק את הלקוח ${customer.name}?`)) return;
    setDeletingId(customer.id);
    const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    const data = await response.json();
    setDeletingId(null);
    if (!response.ok) { setError(data.error || "לא ניתן למחוק את הלקוח"); return; }
    fetchCustomers();
  };

  const exportColumns = [
    { header: "שם לקוח", key: "name" }, { header: "טלפון", key: "phone" }, { header: "אימייל", key: "email" },
    { header: "עיר", key: "city" }, { header: "סטטוס", key: "status" }, { header: "מערכות", key: "_count.installedSystems" },
  ];

  return <div className="space-y-5" dir="rtl">
    <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
      <div><div className="text-sm font-semibold" style={{ color: "var(--rust)" }}>CRM · ניהול לקוחות</div><h1 className="text-3xl font-black">לקוחות</h1><p className="text-sm" style={{ color: "var(--muted)" }}>חיפוש וסינון בצד השרת · {meta.total.toLocaleString("he-IL")} תוצאות</p></div>
      <Link href="/customers/new" className="btn-accent">+ לקוח חדש</Link>
    </header>

    <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Kpi title="לקוחות פעילים" value={kpis.active} color="#2e7d32" />
      <Kpi title="חדשים החודש" value={kpis.newThisMonth} color="#3d8bfd" />
      <Kpi title="שירות קרוב" value={kpis.upcoming} color="#f15a3a" />
      <Kpi title="ללא פעילות" value={kpis.inactive} color="#7657d9" />
      <Kpi title="לפי אזור" value={(kpis.byCity || []).slice(0, 2).map((x: any) => `${x.city || "ללא עיר"} (${x._count._all})`).join(" · ") || "אין נתונים"} color="#c45a2a" />
    </section>

    <section className="card p-4 space-y-3">
      <div className="flex flex-col lg:flex-row gap-2">
        <input className="input-field flex-1" placeholder="חיפוש שם, טלפון, אימייל, עיר, כתובת, מספר מערכת, הזמנה או קריאה" value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} />
        <select className="input-field lg:w-44" value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className="input-field lg:w-40" value={filters.source} onChange={(e) => updateFilter("source", e.target.value)}>{sourceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="btn-primary" onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? "הסתר מסננים" : "מסננים מתקדמים"}</button>
        <button className="btn-primary" onClick={resetFilters}>נקה</button>
      </div>
      {showAdvanced && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <Field label="עיר" value={filters.city} onChange={(v) => updateFilter("city", v)} />
        <label className="text-sm">נציג אחראי<select className="input-field" value={filters.assignedToId} onChange={(e) => updateFilter("assignedToId", e.target.value)}><option value="">כל הנציגים</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <Field label="סוג מערכת" value={filters.systemType} onChange={(v) => updateFilter("systemType", v)} />
        <Field label="התקנה מתאריך" type="date" value={filters.installationFrom} onChange={(v) => updateFilter("installationFrom", v)} />
        <Field label="התקנה עד תאריך" type="date" value={filters.installationTo} onChange={(v) => updateFilter("installationTo", v)} />
        <Field label="שירות מתאריך" type="date" value={filters.serviceFrom} onChange={(v) => updateFilter("serviceFrom", v)} />
        <Field label="שירות עד תאריך" type="date" value={filters.serviceTo} onChange={(v) => updateFilter("serviceTo", v)} />
        <div className="flex flex-wrap items-end gap-3 text-sm md:col-span-2 lg:col-span-4">{[["isNew", "לקוח חדש החודש"], ["openService", "יש קריאת שירות פתוחה"], ["reminderSoon", "תזכורת קרובה"]].map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(filters[key as keyof Filters])} onChange={(e) => updateFilter(key as keyof Filters, e.target.checked)} />{label}</label>)}</div>
      </div>}
    </section>

    <ExportBar title="לקוחות" data={customers} columns={exportColumns} printableId="customers-printable-table" />
    {error && <div className="p-3 rounded border" style={{ background: "#ffebee", color: "#b71c1c", borderColor: "#ef9a9a" }}>{error}</div>}
    <div className="card overflow-x-auto">
      <table id="customers-printable-table" className="w-full text-sm min-w-[1100px]"><thead><tr className="border-b" style={{ borderColor: "var(--border)", background: "#fafaf7" }}>
        {['לקוח', 'טלפון', 'עיר', 'סטטוס', 'מערכות', 'שירות הבא', 'קריאות פתוחות', 'הזמנה אחרונה', 'נציג אחראי', 'עדכון אחרון', 'פעולות'].map((title) => <th key={title} className="text-right p-3">{title}</th>)}
      </tr></thead><tbody>{loading ? <tr><td colSpan={11} className="p-10 text-center" style={{ color: "var(--muted)" }}>טוען לקוחות...</td></tr> : customers.length === 0 ? <tr><td colSpan={11} className="p-10 text-center" style={{ color: "var(--muted)" }}>לא נמצאו לקוחות לפי הסינון</td></tr> : customers.map((c) => {
        const nextService = c.serviceCalls?.[0]; const order = c.orders?.[0]; const activity = c.activities?.[0];
        return <tr key={c.id} className="border-b hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
          <td className="p-3"><Link href={`/customers/${c.id}`} className="font-bold hover:underline" style={{ color: "var(--rust)" }}>{c.name}</Link><div className="text-xs" style={{ color: "var(--muted)" }}>{c.email || "ללא אימייל"}</div></td>
          <td className="p-3 font-mono">{c.phone}</td><td className="p-3">{c.city || "—"}</td>
          <td className="p-3"><span className={`badge badge-${String(c.status).toLowerCase()}`}>{statusLabel[c.status] || c.status}</span></td>
          <td className="p-3">{c._count?.installedSystems ?? c.installedSystems?.length ?? 0}</td>
          <td className="p-3">{nextService?.scheduledAt ? new Date(nextService.scheduledAt).toLocaleDateString("he-IL") : "—"}</td>
          <td className="p-3">{c.serviceCalls?.length || 0}{c._count?.serviceCalls > 1 ? ` / ${c._count.serviceCalls}` : ""}</td>
          <td className="p-3">{order ? <><b>{order.orderNumber}</b><div className="text-xs">₪{Number(order.total || 0).toLocaleString("he-IL")}</div></> : "—"}</td>
          <td className="p-3">{c.assignedTo?.name || "—"}</td><td className="p-3 text-xs">{activity?.createdAt ? new Date(activity.createdAt).toLocaleDateString("he-IL") : new Date(c.updatedAt).toLocaleDateString("he-IL")}</td>
          <td className="p-3"><div className="flex gap-1 flex-wrap"><Link href={`/customers/${c.id}`} className="btn-primary text-xs">כרטיס</Link><a href={`tel:${c.phone}`} className="btn-primary text-xs">התקשר</a><a href={`https://wa.me/${String(c.phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-accent text-xs">WhatsApp</a><button className="btn-danger text-xs" disabled={deletingId === c.id} onClick={() => deleteCustomer(c)}>{deletingId === c.id ? "..." : "מחיקה"}</button></div></td>
        </tr>;
      })}</tbody></table>
    </div>
    <div className="flex items-center justify-between gap-3"><span className="text-sm" style={{ color: "var(--muted)" }}>עמוד {meta.page} מתוך {meta.totalPages}</span><div className="flex gap-2"><button className="btn-primary" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>הקודם</button><button className="btn-primary" disabled={page >= meta.totalPages || loading} onClick={() => setPage((value) => value + 1)}>הבא</button></div></div>
  </div>;
}

function Kpi({ title, value, color }: { title: string; value: string | number; color: string }) { return <div className="card p-4"><div className="text-xs font-bold" style={{ color: "var(--muted)" }}>{title}</div><div className="text-2xl font-black mt-2" style={{ color }}>{value}</div></div>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="text-sm">{label}<input className="input-field" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>; }

