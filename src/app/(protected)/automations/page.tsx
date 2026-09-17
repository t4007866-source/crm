"use client";

import { useEffect, useState } from "react";

type Automation = any;
type Metric = { totalRuns: number; successfulRuns: number; failedRuns: number; pendingApprovals: number };

const stageLabels: Record<string, string> = { DRAFT: "טיוטה", TEST: "בדיקה", ACTIVE: "פעילה", PAUSED: "מושהית", ARCHIVED: "בארכיון" };
const triggerLabels: Record<string, string> = { record_created: "רשומה חדשה", no_response: "ללא מענה", date_near: "תאריך מתקרב", threshold: "מתחת לסף" };

export default function AutomationsPage() {
  const [items, setItems] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<Automation[]>([]);
  const [metrics, setMetrics] = useState<Metric>({ totalRuns: 0, successfulRuns: 0, failedRuns: 0, pendingApprovals: 0 });
  const [selected, setSelected] = useState<Automation | null>(null);
  const [runs, setRuns] = useState<Automation[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/automations", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "שגיאה בטעינת האוטומציות");
      setItems(data.automations || []); setTemplates(data.templates || []); setMetrics(data.metrics || metrics);
      const runResponse = await fetch("/api/automations/runs", { cache: "no-store" });
      if (runResponse.ok) setRuns((await runResponse.json()).runs || []);
    } catch (e) { setError(e instanceof Error ? e.message : "שגיאה"); }
  }
  useEffect(() => { load(); }, []);

  function newAutomation() {
    setSelected({ name: "אוטומציה חדשה", module: "general", status: "DRAFT", enabled: false, version: 1, trigger: { type: "record_created", entity: "Lead" }, conditions: [], actions: [{ type: "notify_in_app" }], approvalPolicy: { required: false }, safetyPolicy: { cooldownHours: 24, maxRetries: 2 } });
  }
  async function createTemplate(template: Automation) {
    setBusy(true); setError("");
    const response = await fetch("/api/automations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(template) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return setError(data.error || "לא ניתן ליצור אוטומציה");
    setSelected(data.automation); setMessage("נוצרה טיוטה בטוחה"); load();
  }
  async function save() {
    if (!selected) return;
    setBusy(true); setError("");
    const response = await fetch("/api/automations", { method: selected.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return setError(data.error || "לא ניתן לשמור");
    setSelected(data.automation); setMessage("נשמרה גרסה חדשה ונוצר Audit Log"); load();
  }
  async function toggle(item: Automation) {
    setError("");
    const response = await fetch("/api/automations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, enabled: !item.enabled, status: item.enabled ? "PAUSED" : "ACTIVE" }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "אין הרשאה להפעיל"); else { setMessage(item.enabled ? "האוטומציה הושהתה" : "האוטומציה הופעלה"); load(); }
  }
  async function preview(item: Automation) {
    const response = await fetch("/api/automations/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ automationId: item.id, mode: "test", idempotencyKey: `preview:${item.id}:${item.version}` }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "לא ניתן להריץ בדיקה"); else { setMessage(data.duplicate ? "הבדיקה כבר הורצה — לא נוצרה כפילות" : "נוצר Preview בלבד: לא נשלחה הודעה ולא השתנה מידע"); load(); }
  }
  const counts = { active: items.filter((a) => a.enabled).length, paused: items.filter((a) => a.status === "PAUSED").length, draft: items.filter((a) => a.status === "DRAFT").length };

  return <main className="space-y-5" dir="rtl">
    <header className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="text-2xl font-bold">אוטומציות</h1><p className="text-sm" style={{ color: "var(--muted)" }}>Trigger → תנאים → פעולה → אישור/ביצוע → Audit Log</p></div><button className="btn-accent" onClick={newAutomation}>+ אוטומציה חדשה</button></header>
    {error && <div className="p-3 rounded" style={{ background: "#ffebee", color: "#b71c1c" }}>{error}</div>}{message && <div className="p-3 rounded" style={{ background: "#e8f5e9", color: "#1b5e20" }}>{message}</div>}
    <section className="grid grid-cols-2 md:grid-cols-6 gap-3">{[["פעילות היום", metrics.totalRuns], ["הצלחות", metrics.successfulRuns], ["כשלים", metrics.failedRuns], ["ממתינות לאישור", metrics.pendingApprovals], ["פעילות", counts.active], ["טיוטות", counts.draft]].map(([label, value]) => <div className="card p-3" key={String(label)}><div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div><strong className="text-2xl">{value}</strong></div>)}</section>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><section className="card p-4"><h2 className="font-bold mb-3">תבניות בטוחות להתחלה</h2>{templates.map((t) => <div className="border-b py-3" style={{ borderColor: "var(--border)" }} key={t.name}><strong className="text-sm">{t.name}</strong><p className="text-xs my-1" style={{ color: "var(--muted)" }}>{t.description}</p><button disabled={busy} className="text-xs underline" style={{ color: "var(--rust)" }} onClick={() => createTemplate(t)}>הוסף כטיוטה</button></div>)}</section>
    <section className="card p-4 lg:col-span-2"><div className="flex justify-between mb-3"><h2 className="font-bold">האוטומציות שלי</h2><span className="text-xs" style={{ color: "var(--muted)" }}>ברירת מחדל: טיוטה ובדיקה</span></div>{items.length === 0 ? <p style={{ color: "var(--muted)" }}>אין עדיין אוטומציות.</p> : <div className="space-y-2">{items.map((a) => <div className="border rounded p-3 flex flex-wrap justify-between gap-3 items-center" style={{ borderColor: "var(--border)" }} key={a.id}><div><button className="font-bold text-right" onClick={() => setSelected(a)}>{a.name}</button><div className="text-xs" style={{ color: "var(--muted)" }}>{a.module} · {stageLabels[a.status] || a.status} · {triggerLabels[a.trigger?.type] || a.trigger?.type} · גרסה {a.version}</div></div><div className="flex gap-2"><button className="btn-primary text-xs" onClick={() => preview(a)}>Preview</button><button className="btn-secondary text-xs" onClick={() => toggle(a)}>{a.enabled ? "השהה" : "הפעל"}</button></div></div>)}</div>}</section></div>
    <section className="card p-4"><h2 className="font-bold mb-3">ניטור ריצות אחרונות</h2>{runs.length === 0 ? <p className="text-sm" style={{ color: "var(--muted)" }}>אין ריצות. Preview אינו משנה נתונים.</p> : <div className="space-y-2">{runs.slice(0, 10).map((run: any) => <div className="text-sm border-b pb-2" style={{ borderColor: "var(--border)" }} key={run.id}><b>{run.automation?.name || "אוטומציה"}</b> · {run.status} · {new Date(run.startedAt).toLocaleString("he-IL")} · {run.idempotencyKey}</div>)}</div>}</section>
    {selected && <section className="card p-4 space-y-3"><div className="flex justify-between"><h2 className="font-bold">עריכת אוטומציה</h2><button onClick={() => setSelected(null)}>✕</button></div><input className="input w-full" value={selected.name || ""} onChange={(e) => setSelected({ ...selected, name: e.target.value })} placeholder="שם האוטומציה" /><textarea className="input w-full min-h-20" value={selected.description || ""} onChange={(e) => setSelected({ ...selected, description: e.target.value })} placeholder="תיאור" /><div className="grid md:grid-cols-3 gap-3"><select className="input" value={selected.module || "general"} onChange={(e) => setSelected({ ...selected, module: e.target.value })}><option value="general">כללי</option><option value="leads">לידים</option><option value="customers">לקוחות</option><option value="service">שירות</option><option value="inventory">מלאי</option><option value="orders">הזמנות</option></select><select className="input" value={selected.trigger?.type || "record_created"} onChange={(e) => setSelected({ ...selected, trigger: { ...(selected.trigger || {}), type: e.target.value } })}><option value="record_created">רשומה חדשה</option><option value="no_response">ללא מענה</option><option value="date_near">תאריך מתקרב</option><option value="threshold">מתחת לסף</option></select><label className="flex gap-2 items-center"><input type="checkbox" checked={Boolean(selected.approvalPolicy?.required)} onChange={(e) => setSelected({ ...selected, approvalPolicy: { ...(selected.approvalPolicy || {}), required: e.target.checked } })} /> נדרש אישור אנושי</label></div><div className="p-3 rounded text-sm" style={{ background: "#fff8e1" }}>מצב בדיקה: הפעולות יוצגו כ־Preview בלבד. אין שליחת WhatsApp, שינוי מלאי או שינוי סטטוס.</div><button disabled={busy} className="btn-accent" onClick={save}>שמור כגרסה חדשה</button></section>}
  </main>;
}

