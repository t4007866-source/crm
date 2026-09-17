"use client";

import { FormEvent, useState } from "react";

const suggestions = ["כמה לידים חדשים הגיעו השבוע?", "אילו לקוחות צריכים החלפת מסנן?", "אילו הזמנות עדיין ממתינות?", "איזה טכנאי עמוס ביותר?", "אילו קריאות שירות באיחור?", "מה היו ההכנסות החודש?"];

type Message = { role: "user" | "assistant"; text: string; source?: string; range?: string; rows?: Array<Record<string, unknown>> };

export default function AiPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailPreview, setEmailPreview] = useState<any>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(value = question) {
    if (!value.trim() || loading) return;
    setQuestion(""); setError(""); setMessages((m) => [...m, { role: "user", text: value }]); setLoading(true);
    try { const r = await fetch("/api/ai/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: value }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "לא ניתן לקבל תשובה"); setMessages((m) => [...m, { role: "assistant", ...d.answer }]); }
    catch (e) { setError(e instanceof Error ? e.message : "שגיאה"); }
    finally { setLoading(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void ask(); }
  async function previewEmail(e: FormEvent) { e.preventDefault(); setEmailLoading(true); setError(""); try { const r = await fetch("/api/ai/email-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: email }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "לא ניתן לנתח אימייל"); setEmailPreview(d); } catch (x) { setError(x instanceof Error ? x.message : "שגיאה"); } finally { setEmailLoading(false); } }

  return <div className="space-y-5" dir="rtl">
    <div><div className="text-sm" style={{ color: "var(--muted)" }}>קריאה בלבד בשלב הראשון · כל שאילתה נרשמת ב-Audit Log</div><h1 className="text-3xl font-black">עוזר AI מרכזי למנהל</h1><p style={{ color: "var(--muted)" }}>שאל שאלות על נתוני ה-CRM, קבל מקור וטווח זמן, בלי שהעוזר יוכל לשנות נתונים.</p></div>
    {error && <div className="rounded-lg p-3" style={{ background: "#ffebee", color: "#b71c1c" }}>{error}</div>}
    <section className="card p-5">
      <div className="flex flex-wrap gap-2 mb-4">{suggestions.map((s) => <button key={s} className="px-3 py-2 rounded-full text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }} onClick={() => void ask(s)}>{s}</button>)}</div>
      <form onSubmit={submit} className="flex gap-2"><input className="input-field flex-1" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="לדוגמה: כמה לידים מפייסבוק הפכו להזמנה ברבעון האחרון?" /><button className="btn-primary" disabled={loading}>{loading ? "בודק…" : "שאל"}</button></form>
      <div className="mt-5 space-y-3">{messages.length === 0 && <div className="text-center py-8" style={{ color: "var(--muted)" }}>בחר שאלה לדוגמה או כתוב שאלה חופשית.</div>}{messages.map((m, i) => <div key={i} className={`rounded-lg p-4 ${m.role === "user" ? "mr-12" : "ml-12"}`} style={{ background: m.role === "user" ? "#eef6ff" : "var(--surface-2)" }}><div className="font-semibold mb-1">{m.role === "user" ? "אתה" : "עוזר AI"}</div><div>{m.text}</div>{m.role === "assistant" && <><div className="text-xs mt-3" style={{ color: "var(--muted)" }}>מקור: {m.source} · טווח: {m.range}</div>{m.rows && m.rows.length > 0 && <div className="overflow-auto mt-3"><table className="w-full text-sm"><tbody>{m.rows.slice(0, 12).map((row, ri) => <tr key={ri} className="border-b">{Object.entries(row).map(([k, v]) => <td key={k} className="p-2"><span className="font-semibold">{k}: </span>{String(v ?? "—")}</td>)}</tr>)}</tbody></table></div>}</>}</div>)}</div>
    </section>
    <section className="card p-5"><h2 className="text-xl font-bold">עיבוד אימייל עם אישור אנושי</h2><p className="text-sm mt-1 mb-3" style={{ color: "var(--muted)" }}>הדבק אימייל לא מובנה. המערכת תציג תצוגה מקדימה בלבד — היא לא תיצור ליד ללא אישורך.</p><form onSubmit={previewEmail} className="space-y-3"><textarea className="input-field w-full min-h-32" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="הדבק כאן את תוכן האימייל…" /><button className="btn-primary" disabled={emailLoading}>{emailLoading ? "מנתח…" : "הצג תצוגה מקדימה"}</button></form>{emailPreview && <div className="mt-4 rounded-lg p-4" style={{ background: "#f7fafc", border: "1px solid var(--border)" }}><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Object.entries(emailPreview.preview || {}).filter(([, v]) => typeof v !== "object").map(([k, v]) => <div key={k}><div className="text-xs" style={{ color: "var(--muted)" }}>{k}</div><div className="font-semibold">{String(v || "לא נמצא")} {v ? "✓" : "—"}</div></div>)}</div><div className="mt-4 text-sm" style={{ color: "var(--muted)" }}>ציון ביטחון: {emailPreview.confidence || "לא זמין"} · נדרשת בדיקה ואישור אנושי לפני יצירת ליד</div><div className="flex gap-2 mt-4"><button className="btn-primary" disabled={!emailPreview.canCreateLead}>צור ליד לאחר אישור</button><button className="px-4 py-2 rounded" style={{ border: "1px solid var(--border)" }} onClick={() => setEmailPreview(null)}>התעלם</button></div></div>}</section>
    <section className="grid md:grid-cols-3 gap-3"><Info title="הרשאות" text="העוזר מכבד את תפקיד המשתמש. נציג רואה רק את הנתונים שהוקצו לו." /><Info title="פעולות מסוכנות" text="שליחת WhatsApp, אימייל, שינוי סטטוס, מחיר, שיבוץ או מחיקה ידרשו אישור מפורש." /><Info title="Feature flag" text="אפשר לכבות את המודול עם AI_ASSISTANT_ENABLED=false בלי לפגוע בשאר המערכת." /></section>
  </div>;
}
function Info({ title, text }: { title: string; text: string }) { return <div className="card p-4"><div className="font-bold">{title}</div><div className="text-sm mt-2" style={{ color: "var(--muted)" }}>{text}</div></div>; }

