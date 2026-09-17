"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Lead = any;

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [edit, setEdit] = useState<Lead | null>(null);
  const [tab, setTab] = useState("details");
  const [id, setId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async (leadId: string) => {
    const response = await fetch(`/api/leads/${leadId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "לא ניתן לטעון את הליד");
    setLead(data);
    setEdit({
      ...data,
      interests: Array.isArray(data.interests) ? data.interests.join(", ") : "",
      utm_source: data.utmData?.utm_source || "",
      utm_campaign: data.utmData?.utm_campaign || "",
      utm_adset: data.utmData?.utm_adset || "",
    });
  };

  useEffect(() => {
    params.then(({ id: value }) => {
      setId(value);
      reload(value).catch((e) => setError(e.message));
    });
  }, [params]);

  if (error) return <div dir="rtl" className="p-8 text-center text-red-700">{error}</div>;
  if (!lead || !edit) return <div dir="rtl" className="p-8 text-center">טוען...</div>;

  const setField = (key: string, value: string) => setEdit({ ...edit, [key]: value });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    const body = {
      ...edit,
      value: edit.value === "" ? null : Number(edit.value),
      interests: String(edit.interests || "").split(",").map((x: string) => x.trim()).filter(Boolean),
      utmData: { utm_source: edit.utm_source || "", utm_campaign: edit.utm_campaign || "", utm_adset: edit.utm_adset || "" },
    };
    const response = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setError(data.error || "שגיאה בעדכון"); return; }
    setMessage("פרטי הליד עודכנו ונרשמו ביומן הביקורת"); setTab("details"); await reload(id);
  };

  const remove = async () => {
    if (!window.confirm("האם למחוק את הליד? הפעולה בלתי הפיכה וכל היסטוריית הליד תימחק.")) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setError(data.error || "לא ניתן למחוק את הליד"); return; }
    window.location.href = "/leads";
  };

  const convert = async () => {
    if (!window.confirm("להמיר את הליד ללקוח? רצף ה-Follow-up ייעצר.")) return;
    setBusy(true);
    const response = await fetch(`/api/leads/${id}/convert`, { method: "POST" });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setError(data.error || "לא ניתן להמיר את הליד"); return; }
    window.location.href = `/customers/${data.customer.id}`;
  };

  return <div dir="rtl" className="max-w-6xl mx-auto space-y-4">
    <Link href="/leads" className="text-sm" style={{ color: "var(--rust)" }}>חזרה ללידים ←</Link>
    <div className="card p-5 flex justify-between items-start gap-4 flex-wrap">
      <div><h1 className="text-3xl font-bold">{lead.name}</h1><p style={{ color: "var(--muted)" }}>{lead.phone || "ללא טלפון"} · {lead.email || "ללא אימייל"} · {lead.source}</p>{lead.customer && <p className="text-sm mt-2">מקושר ללקוח: <Link className="underline" href={`/customers/${lead.customer.id}`}>{lead.customer.name}</Link></p>}</div>
      <div className="flex gap-2 flex-wrap justify-end"><a href={`tel:${lead.phone || ""}`} className="btn-primary">חייג</a><a href={`https://wa.me/${String(lead.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-accent">WhatsApp</a><button onClick={() => setTab("edit")} className="btn-primary">ערוך פרטים</button>{lead.stage !== "WON" && <button onClick={convert} disabled={busy || !lead.phone} className="btn-accent">המר ללקוח</button>}<button onClick={remove} disabled={busy || lead.stage === "WON" || Boolean(lead.convertedCustomerId)} className="px-4 py-2 rounded bg-red-700 text-white disabled:opacity-40">מחק ליד</button></div>
    </div>
    {message && <div className="p-3 rounded bg-green-100 text-green-800">{message}</div>}
    {error && <div className="p-3 rounded bg-red-100 text-red-800">{error}</div>}
    <div className="card p-2 flex gap-1 flex-wrap">{[["details", "פרטי ליד"], ["edit", "עריכת ליד"], ["log", "שיחות והערות"], ["followup", "Follow-up"], ["calendar", "מועדי קשר"]].map(([value, label]) => <button key={value} onClick={() => setTab(value)} className="px-4 py-2 rounded text-sm" style={{ background: tab === value ? "var(--ink)" : "transparent", color: tab === value ? "#fff" : "var(--muted)" }}>{label}</button>)}</div>
    <div className="card p-5">
      {tab === "details" && <Details lead={lead} />}
      {tab === "edit" && <EditForm edit={edit} set={setField} save={save} busy={busy} />}
      {tab === "log" && <Activity lead={lead} id={id} reload={() => reload(id)} />}
      {tab === "followup" && <div>{lead.followUps?.length ? lead.followUps.map((item: any) => <div key={item.id} className="border-b py-2 text-sm">ניסיון {item.attemptNumber} · {item.channel} · {item.status} · {new Date(item.scheduledAt).toLocaleString("he-IL")}</div>) : "אין פעולות Follow-up"}</div>}
      {tab === "calendar" && <div>{lead.calendarEvents?.length ? lead.calendarEvents.map((item: any) => <div key={item.id} className="border-b py-2 text-sm">{item.title} · {new Date(item.startAtUtc).toLocaleString("he-IL")}</div>) : "אין מועדי קשר"}</div>}
    </div>
  </div>;
}

function Details({ lead }: { lead: Lead }) { const rows = [["שם", lead.name], ["טלפון", lead.phone || "—"], ["אימייל", lead.email || "—"], ["עיר", lead.city || "—"], ["חברה", lead.company || "—"], ["מקור", lead.source], ["עניין", Array.isArray(lead.interests) ? lead.interests.join(", ") : "—"], ["מצב נוכחי", lead.currentSystem || "—"], ["סטטוס", lead.stage], ["Confidence", lead.confidence], ["ערך", lead.value ? `₪${lead.value.toLocaleString()}` : "—"], ["נוצר בתאריך", new Date(lead.createdAt).toLocaleString("he-IL")]]; return <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">{rows.map(([label, value]) => <div key={label}><div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div><div>{value}</div></div>)}</div>; }

function EditForm({ edit, set, save, busy }: { edit: Lead; set: (key: string, value: string) => void; save: (event: React.FormEvent) => void; busy: boolean }) { return <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="שם" value={edit.name} set={(v) => set("name", v)} required /><Field label="טלפון" value={edit.phone || ""} set={(v) => set("phone", v)} required /><Field label="אימייל" value={edit.email || ""} set={(v) => set("email", v)} /><Field label="חברה" value={edit.company || ""} set={(v) => set("company", v)} /><Field label="עיר" value={edit.city || ""} set={(v) => set("city", v)} /><Field label="תחומי עניין" value={edit.interests || ""} set={(v) => set("interests", v)} /><Field label="מצב נוכחי" value={edit.currentSystem || ""} set={(v) => set("currentSystem", v)} /><Field label="סכום הצעה" value={edit.value ?? ""} set={(v) => set("value", v)} type="number" /><Field label="utm_source" value={edit.utm_source || ""} set={(v) => set("utm_source", v)} /><Field label="utm_campaign" value={edit.utm_campaign || ""} set={(v) => set("utm_campaign", v)} /><label className="text-sm">סטטוס<select className="input-field" value={edit.stage} onChange={(e) => set("stage", e.target.value)}><option value="NEW">חדש</option><option value="CONTACTED">בשיחה</option><option value="QUALIFIED">מוכשר</option><option value="PROPOSAL">נשלחה הצעה</option><option value="NEGOTIATION">משא ומתן</option><option value="WON">סגר והזמין</option><option value="LOST">לא רלוונטי</option></select></label><label className="text-sm">Confidence<select className="input-field" value={edit.confidence} onChange={(e) => set("confidence", e.target.value)}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label><button disabled={busy} className="btn-accent md:col-span-2 disabled:opacity-50">{busy ? "שומר..." : "שמור שינויים"}</button></form>; }

function Field({ label, value, set, type = "text", required = false }: { label: string; value: string | number; set: (value: string) => void; type?: string; required?: boolean }) { return <label className="text-sm">{label}<input required={required} type={type} className="input-field" value={value} onChange={(e) => set(e.target.value)} /></label>; }

function Activity({ lead, id, reload }: { lead: Lead; id: string; reload: () => Promise<void> }) { const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [saving, setSaving] = useState(false); const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); const response = await fetch("/api/lead-activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: id, type: "NOTE", subject, body }) }); const data = await response.json(); setSaving(false); if (!response.ok) return; setSubject(""); setBody(""); await reload(); }; return <div className="space-y-4"><form onSubmit={submit} className="space-y-2"><input className="input-field" placeholder="נושא ההערה" value={subject} onChange={(e) => setSubject(e.target.value)} required /><textarea className="input-field" placeholder="תוכן ההערה" value={body} onChange={(e) => setBody(e.target.value)} required /><button disabled={saving} className="btn-accent disabled:opacity-50">{saving ? "שומר..." : "שמור הערה"}</button></form>{lead.activities?.length ? lead.activities.map((activity: any) => <div key={activity.id} className="border-b pb-3 text-sm" style={{ borderColor: "var(--border)" }}><strong>{activity.subject}</strong><div>{activity.body}</div><small style={{ color: "var(--muted)" }}>{new Date(activity.createdAt).toLocaleString("he-IL")} · {activity.createdBy?.name || activity.createdById || "מערכת"}</small></div>) : <div style={{ color: "var(--muted)" }}>אין היסטוריית פעילות</div>}</div>; }

