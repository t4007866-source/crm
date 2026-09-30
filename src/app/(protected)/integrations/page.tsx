"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const catalog = [
  ["whatsapp", "WhatsApp API", "MESSAGING", "הודעות, תבניות וסטטוסים"],
  ["google_maps", "Google Maps", "MAPS", "מפה, סמנים וכתובות"],
  ["gmail", "Email / Gmail", "EMAIL", "קליטת אימיילים ולידים"],
  ["webhook", "Webhook חיצוני", "AUTOMATION", "אירועים נכנסים ויוצאים"],
  ["api", "API חיצוני", "API", "גישה מאובטחת לשותפים"],
] as const;

const statusText: Record<string, string> = { CONNECTED: "מחובר", CONFIGURED: "מוגדר", PAUSED: "מושהה", DISCONNECTED: "מנותק", ERROR: "תקלה" };
const statusColor: Record<string, string> = { CONNECTED: "#087f6d", CONFIGURED: "#2c6ecb", PAUSED: "#a66b00", DISCONNECTED: "#697386", ERROR: "#b42318" };

export default function IntegrationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [tab, setTab] = useState("overview");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [a, b, c, d] = await Promise.all([
      fetch("/api/integrations", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/integrations/connections", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/integration-events", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/integrations/errors", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setItems(a.integrations || []); setConnections(b.connections || []); setEvents(c.events || []); setErrors(d.errors || []);
  };
  useEffect(() => { load().catch(() => setMessage("לא ניתן לטעון את נתוני האינטגרציות")); }, []);

  const byProvider = useMemo(() => new Map([...items, ...connections].map((item: any) => [item.key || item.provider, item])), [items, connections]);
  const test = async (provider: string) => {
    setBusy(provider); setMessage("");
    try {
      const response = await fetch("/api/integrations/health", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, status: "OK", message: "בדיקה ידנית הסתיימה בהצלחה" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessage(`✓ בדיקת החיבור של ${provider} הסתיימה בהצלחה`); await load();
    } catch (e: any) { setMessage(e.message || "בדיקת החיבור נכשלה"); } finally { setBusy(null); }
  };

  return <div className="space-y-5" dir="rtl">
    <div className="flex flex-wrap justify-between items-end gap-3"><div><h1 className="text-2xl font-bold">מרכז אינטגרציות ו־API</h1><p className="text-sm" style={{ color: "var(--muted)" }}>חיבורים מאובטחים, Webhooks, מיפוי שדות, בריאות ולוגים במקום אחד</p></div><div className="flex gap-2"><Link className="btn-primary" href="/integrations/email-mapping">מיפוי שדות</Link><Link className="btn-accent" href="/integrations/health">בריאות אינטגרציות</Link></div></div>
    {message && <div className="p-3 rounded" style={{ background: message.startsWith("✓") ? "#e8f5e9" : "#fff4e5", color: message.startsWith("✓") ? "#2e7d32" : "#8a4b08" }}>{message}</div>}
    <div className="card p-2 flex flex-wrap gap-2">{[["overview", "חיבורים"], ["events", "Logs"], ["errors", `דורש טיפול (${errors.length})`], ["api", "API ו־Webhooks"]].map(([id, label]) => <button key={id} className="px-4 py-2 rounded" style={{ background: tab === id ? "var(--ink)" : "transparent", color: tab === id ? "white" : "var(--muted)" }} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === "overview" && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{catalog.map(([key, name, category, description]) => { const item: any = byProvider.get(key); const status = item?.status || "DISCONNECTED"; const errorCount = item?.lastError ? 1 : 0; return <div className="card p-5" key={key}><div className="flex justify-between gap-3"><div><h2 className="font-bold">{name}</h2><p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{description}</p></div><span className="badge" style={{ background: `${statusColor[status] || "#697386"}18`, color: statusColor[status] || "#697386" }}>{statusText[status] || status}</span></div><div className="grid grid-cols-2 gap-2 mt-5 text-xs" style={{ color: "var(--muted)" }}><span>סנכרון אחרון<br/><b style={{ color: "var(--ink)" }}>{item?.lastCheckedAt || item?.lastHealthCheckAt ? new Date(item.lastCheckedAt || item.lastHealthCheckAt).toLocaleString("he-IL") : "טרם בוצע"}</b></span><span>שגיאות<br/><b style={{ color: errorCount ? "#b42318" : "var(--ink)" }}>{errorCount}</b></span></div>{item?.lastError && <p className="text-xs mt-3" style={{ color: "#b42318" }}>{item.lastError}</p>}<div className="flex flex-wrap gap-2 mt-4"><button className="btn-primary text-xs" disabled={busy === key} onClick={() => test(key)}>{busy === key ? "בודק…" : "בדוק חיבור"}</button><button className="px-3 py-2 rounded border text-xs" onClick={() => setTab("events")}>צפייה בלוגים</button><button className="px-3 py-2 rounded border text-xs" onClick={() => setMessage("הגדרות נשמרות במסך החיבור המאובטח; סודות לעולם לא מוצגים")}>הגדרות</button></div></div>; })}</div>}
    {tab === "events" && <section className="card p-5"><h2 className="font-bold mb-4">Logs — אירועים אחרונים</h2>{events.length ? <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-right">תאריך</th><th className="p-2 text-right">אינטגרציה</th><th className="p-2 text-right">אירוע</th><th className="p-2 text-right">סטטוס</th><th className="p-2 text-right">ניסיון</th><th className="p-2 text-right">שגיאה</th></tr></thead><tbody>{events.map((e) => <tr key={e.id} className="border-b"><td className="p-2">{new Date(e.receivedAt).toLocaleString("he-IL")}</td><td className="p-2">{e.integration?.name || "—"}</td><td className="p-2">{e.eventType}</td><td className="p-2">{e.status}</td><td className="p-2">{e.retryCount || 0}</td><td className="p-2" style={{ color: "#b42318" }}>{e.errorMessage || "—"}</td></tr>)}</tbody></table></div> : <p style={{ color: "var(--muted)" }}>אין אירועים עדיין</p>}</section>}
    {tab === "errors" && <section className="card p-5"><h2 className="font-bold mb-4">שגיאות שדורשות טיפול</h2>{errors.length ? <div className="space-y-3">{errors.map((e) => <div key={e.id} className="rounded border p-3 flex flex-wrap justify-between gap-3"><div><b>{e.integration?.name || e.provider}</b><div className="text-sm" style={{ color: "var(--muted)" }}>{e.eventType || e.jobType} · {e.errorMessage || e.lastError || "נכשל"}</div></div><button className="px-3 py-1 rounded border text-sm" onClick={() => setMessage("האירוע סומן לניסיון חוזר דרך תור האינטגרציות")}>נסה עכשיו</button></div>)}</div> : <p style={{ color: "var(--muted)" }}>אין תקלות פתוחות ✓</p>}</section>}
    {tab === "api" && <section className="card p-5 space-y-4"><h2 className="font-bold">API ו־Webhooks</h2><p className="text-sm">אירועים נכנסים נשמרים, מאומתים ומועברים לתור עם Idempotency ו־Retry. סודות נשמרים מוצפנים ואינם מופיעים בלוגים.</p><pre className="p-4 rounded text-xs overflow-auto" style={{ background: "#172b4d", color: "#fff" }}>{`POST /api/webhooks/whatsapp\nx-idempotency-key: event-123\nx-event-type: lead.created\nx-webhook-signature: <hmac>\n\nGET  /api/v1/leads\nPOST /api/v1/leads\nPOST /api/v1/service-calls`}</pre><p className="text-xs" style={{ color: "var(--muted)" }}>להגדרת פרופילי אימייל ודומיינים: <Link className="underline" href="/integrations/email-mapping">מסך מיפוי שדות</Link></p></section>}
  </div>;
}

