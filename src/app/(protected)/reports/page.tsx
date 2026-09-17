"use client";

import { useEffect, useMemo, useState } from "react";

const periods = [["today", "היום"], ["week", "השבוע"], ["month", "החודש"], ["quarter", "הרבעון"], ["year", "השנה"]];
const sources = [["", "כל המקורות"], ["WEBSITE", "אתר"], ["FACEBOOK", "Facebook"], ["INSTAGRAM", "Instagram"], ["REFERRAL", "המלצה"], ["WHATSAPP", "WhatsApp"], ["GMAIL", "Gmail"], ["OTHER", "אחר"]];
const statuses = [["", "כל הסטטוסים"], ["LEAD", "ליד"], ["PROSPECT", "פרוספקט"], ["ACTIVE", "פעיל"], ["CHURNED", "עזב"]];

export default function ReportsPage() {
  const [filters, setFilters] = useState({ period: "month", source: "", status: "", city: "" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => new URLSearchParams(filters).toString(), [filters]);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?${query}`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "לא ניתן לטעון את הדוח"); return d; }).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [query]);

  const update = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const exportCsv = () => {
    if (!data) return;
    const rows = [["מדד", "ערך"], ...Object.entries(data.kpis).map(([key, value]) => [key, String(value)])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "shisachar-report.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-5" dir="rtl">
    <div className="flex flex-wrap justify-between items-end gap-3"><div><div className="text-sm" style={{ color: "var(--muted)" }}>מרכז ניתוח נתונים</div><h1 className="text-3xl font-black">דוחות וכל החתכים</h1><p style={{ color: "var(--muted)" }}>לידים, מכירות, לקוחות, שירות, סננים, מלאי ואינטגרציות</p></div><button className="btn-primary" onClick={exportCsv} disabled={!data}>ייצוא CSV</button></div>
    <section className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <label className="text-sm">תקופה<select className="input-field" value={filters.period} onChange={(e) => update("period", e.target.value)}>{periods.map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label>
      <label className="text-sm">מקור ליד<select className="input-field" value={filters.source} onChange={(e) => update("source", e.target.value)}>{sources.map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label>
      <label className="text-sm">סטטוס לקוח<select className="input-field" value={filters.status} onChange={(e) => update("status", e.target.value)}>{statuses.map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label>
      <label className="text-sm">עיר<input className="input-field" placeholder="כל הערים" value={filters.city} onChange={(e) => update("city", e.target.value)} /></label>
    </section>
    {error && <div className="p-3 rounded" style={{ background: "#ffebee", color: "#c62828" }}>{error}</div>}
    {loading && <div className="card p-8 text-center">טוען את נתוני הדוח…</div>}
    {!loading && data && <>
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{[
        ["לקוחות", data.kpis.customers, "#17a99a"], ["לידים", data.kpis.leads, "#3d8bfd"], ["המרה", `${data.kpis.conversionRate}%`, "#7657d9"], ["הזמנות", data.kpis.orders, "#f3b638"], ["הכנסות", `₪${Number(data.kpis.revenue).toLocaleString()}`, "#f15a3a"], ["שירות פתוח", data.kpis.serviceCalls - data.kpis.completedService, "#e9578f"]
      ].map(([label, value, color]) => <div className="card p-4" key={String(label)}><div className="w-9 h-1 rounded-full mb-3" style={{ background: color as string }} /><div className="text-sm" style={{ color: "var(--muted)" }}>{label}</div><div className="text-2xl font-black" style={{ color: color as string }}>{value}</div></div>)}</section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><ReportTable title="לידים לפי מקור" rows={data.breakdowns.bySource} labelKey="source" /><ReportTable title="לקוחות לפי סטטוס" rows={data.breakdowns.byCustomerStatus} labelKey="status" /><section className="card p-5"><h2 className="font-bold mb-4">התראות תפעוליות</h2><Metric label="החלפות סננים שהגיע מועדן" value={data.kpis.overdueFilters} /><Metric label="מוצרים במלאי אפס" value={data.kpis.lowStock} /><Metric label="תורים קרובים" value={data.kpis.upcomingAppointments} /><Metric label="אירועי אינטגרציה שנכשלו" value={data.kpis.integrationErrors} /></section></div>
      <section className="card p-5"><h2 className="text-lg font-bold mb-4">חתכי המשך זמינים</h2><div className="flex flex-wrap gap-2">{["לפי נציג", "לפי טכנאי", "לפי עיר", "לפי מוצר", "לפי קמפיין", "לפי סוג שירות", "לפי סטטוס הזמנה", "לפי מחסן", "לפי ערוץ תקשורת"].map((x) => <span className="px-3 py-2 rounded-full text-sm" style={{ background: "var(--bone)", color: "var(--ink)" }} key={x}>{x}</span>)}</div><p className="text-sm mt-4" style={{ color: "var(--muted)" }}>ההרשאות של המשתמש מוחלות על הנתונים. הרחבות חתך נוספות יכולות להשתמש באותו מסנן בלי לשנות את הלקוחות, הלידים, ההזמנות או השירות.</p></section>
    </>}
  </div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="flex justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}><span className="text-sm">{label}</span><strong>{value}</strong></div>; }
function ReportTable({ title, rows, labelKey }: { title: string; rows: any[]; labelKey: string }) { return <section className="card p-5"><h2 className="font-bold mb-4">{title}</h2>{rows.map((row) => <div className="flex justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }} key={row[labelKey]}><span className="text-sm">{row[labelKey]}</span><strong>{row.count}</strong></div>)}</section>; }

