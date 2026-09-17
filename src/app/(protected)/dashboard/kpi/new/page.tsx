"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const options: Record<string, [string, string][]> = {
  customers: [["count", "סה״כ לקוחות"], ["active", "לקוחות פעילים"]],
  leads: [["count", "סה״כ לידים"], ["open", "לידים פתוחים"], ["won", "לידים שהומרו"]],
  orders: [["count", "סה״כ הזמנות"], ["active", "הזמנות פעילות"]],
  service: [["open", "קריאות פתוחות"], ["completed", "קריאות שהושלמו"]],
  tasks: [["open", "משימות פתוחות"], ["overdue", "משימות באיחור"]],
};
export default function NewKpiPage() {
  const router = useRouter(); const [f, setF] = useState({ title: "", source: "customers", metric: "count", period: "month", target: "", color: "#3d8bfd" }); const [error, setError] = useState("");
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const r = await fetch("/api/dashboard/kpis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, filterJson: {} }) }); const d = await r.json(); if (!r.ok) { setError(d.error || "לא ניתן לשמור KPI"); return; } router.push("/dashboard"); };
  return <div className="max-w-2xl mx-auto space-y-4"><h1 className="text-3xl font-bold">הוספת KPI מותאם</h1>{error && <div className="p-3 rounded" style={{ background: "#ffebee", color: "#c62828" }}>{error}</div>}<form onSubmit={submit} className="card p-5 space-y-4"><Field label="שם KPI" value={f.title} onChange={(v: string) => set("title", v)} required /><label className="block text-sm">מקור נתונים<select className="input-field" value={f.source} onChange={e => { const source = e.target.value; setF({ ...f, source, metric: options[source][0][0] }); }}>{Object.keys(options).map(x => <option key={x} value={x}>{({ customers: "לקוחות", leads: "לידים", orders: "הזמנות", service: "שירות", tasks: "משימות" } as any)[x]}</option>)}</select></label><label className="block text-sm">מדד<select className="input-field" value={f.metric} onChange={e => set("metric", e.target.value)}>{options[f.source].map(([x, y]) => <option key={x} value={x}>{y}</option>)}</select></label><label className="block text-sm">תקופה<select className="input-field" value={f.period} onChange={e => set("period", e.target.value)}><option value="today">היום</option><option value="week">השבוע</option><option value="month">החודש</option><option value="quarter">הרבעון</option><option value="all">כל הזמנים</option></select></label><Field label="יעד (אופציונלי)" value={f.target} onChange={(v: string) => set("target", v)} type="number" /><label className="block text-sm">צבע KPI<input className="input-field h-12" type="color" value={f.color} onChange={e => set("color", e.target.value)} /></label><div className="flex gap-2"><button className="btn-accent">שמור בדשבורד</button><button type="button" className="btn-primary" onClick={() => router.back()}>ביטול</button></div></form></div>;
}
function Field({ label, value, onChange, type = "text", required = false }: any) { return <label className="block text-sm">{label}<input className="input-field" type={type} value={value} onChange={e => onChange(e.target.value)} required={required} /></label>; }



