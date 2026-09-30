"use client";

import { useEffect, useMemo, useState } from "react";

const fields = [
  ["name", "שם מלא", "שם מלא|שם|full_name"],
  ["firstName", "שם פרטי", "שם פרטי|first_name"],
  ["lastName", "שם משפחה", "שם משפחה|last_name"],
  ["phone", "טלפון", "טלפון|נייד|phone|mobile"],
  ["email", "אימייל", "אימייל|email|e-mail"],
  ["city", "עיר", "עיר|יישוב|city"],
  ["company", "חברה", "חברה|ארגון|company"],
  ["interest", "מוצר / עניין", "מוצר|תחום עניין|interest|product"],
  ["system", "מערכת קיימת", "מערכת|סוג מערכת|existing system"],
] as const;

type Profile = {
  id: string;
  name: string;
  matchType: "DOMAIN" | "SENDER";
  matchValue: string;
  mapping: { labels?: Record<string, string[]> };
  enabled: boolean;
  priority: number;
};

const initialSample = "שם לקוח: דוד לוי\nטלפון נייד: 050-1234567\nדואר אלקטרוני: david@example.com\nיישוב: תל אביב\nמוצר מבוקש: אוסמוזה הפוכה";

export default function EmailMappingPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sample, setSample] = useState(initialSample);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", matchType: "DOMAIN", matchValue: "", priority: "10", enabled: true });
  const [mapping, setMapping] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(([key, , hint]) => [key, hint]))
  );

  const normalizedMapping = useMemo(() => ({
    labels: Object.fromEntries(
      Object.entries(mapping)
        .map(([key, value]) => [key, value.split(/[|,\n]/).map((item) => item.trim()).filter(Boolean)])
        .filter(([, values]) => values.length)
    ),
  }), [mapping]);

  const load = async () => {
    const response = await fetch("/api/integrations/email/profiles", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "לא ניתן לטעון פרופילים");
    setProfiles(data.profiles || []);
  };

  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const preview = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/integrations/email/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: sample, mapping: normalizedMapping }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "לא ניתן לנתח את האימייל");
      setResult(data);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", matchType: "DOMAIN", matchValue: "", priority: "10", enabled: true });
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/integrations/email/profiles", {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), ...form, priority: Number(form.priority), mapping: normalizedMapping }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "שמירת הפרופיל נכשלה");
      await load(); resetForm(); setMessage("פרופיל המיפוי נשמר בהצלחה");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const editProfile = (profile: Profile) => {
    setEditingId(profile.id);
    setForm({ name: profile.name, matchType: profile.matchType, matchValue: profile.matchValue, priority: String(profile.priority), enabled: profile.enabled });
    setMapping(Object.fromEntries(fields.map(([key, , hint]) => [key, (profile.mapping?.labels?.[key] || []).join(" | ") || hint])));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleProfile = async (profile: Profile) => {
    await fetch("/api/integrations/email/profiles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: profile.id, enabled: !profile.enabled }) });
    await load();
  };

  const deleteProfile = async (profile: Profile) => {
    if (!window.confirm(`למחוק את הפרופיל "${profile.name}"?`)) return;
    await fetch(`/api/integrations/email/profiles?id=${encodeURIComponent(profile.id)}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">פרופילי מיפוי אימיילים</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>הגדר פעם אחת איך כל דומיין או שולח מציג את השדות. קליטת האימייל תבחר אוטומטית את הפרופיל המתאים.</p>
      </div>
      {error && <div className="p-3 rounded" style={{ background: "#ffebee", color: "#c62828" }}>{error}</div>}
      {message && <div className="p-3 rounded" style={{ background: "#e8f5e9", color: "#2e7d32" }}>{message}</div>}

      <form className="card p-5 space-y-4" onSubmit={saveProfile}>
        <div className="flex justify-between items-center"><h2 className="font-bold">{editingId ? "עריכת פרופיל" : "פרופיל חדש"}</h2>{editingId && <button type="button" className="text-sm underline" onClick={resetForm}>ביטול עריכה</button>}</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-sm">שם הפרופיל<input required className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="טופס אתר" /></label>
          <label className="text-sm">מתאים לפי<select className="input-field" value={form.matchType} onChange={(e) => setForm({ ...form, matchType: e.target.value })}><option value="DOMAIN">דומיין</option><option value="SENDER">כתובת שולח מלאה</option></select></label>
          <label className="text-sm">ערך התאמה<input required className="input-field" value={form.matchValue} onChange={(e) => setForm({ ...form, matchValue: e.target.value })} placeholder={form.matchType === "DOMAIN" ? "forms.example.com" : "leads@example.com"} /></label>
          <label className="text-sm">עדיפות<input type="number" className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> פרופיל פעיל</label>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {fields.map(([key, label, hint]) => <label className="text-sm" key={key}>{label}<span className="block text-xs" style={{ color: "var(--muted)" }}>מילים חלופיות מופרדות ב־|</span><input className="input-field" value={mapping[key] || ""} placeholder={hint} onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })} /></label>)}
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? "שומר…" : editingId ? "שמור שינויים" : "שמור פרופיל"}</button>
      </form>

      <section className="card p-5"><div className="flex justify-between items-center mb-4"><h2 className="font-bold">פרופילים שמורים</h2><span className="text-sm" style={{ color: "var(--muted)" }}>{profiles.length} פרופילים</span></div>
        {profiles.length === 0 ? <p className="text-sm" style={{ color: "var(--muted)" }}>עדיין לא נשמרו פרופילים. פרופיל ברירת המחדל ממשיך לעבוד.</p> : <div className="space-y-3">{profiles.map((profile) => <div className="rounded border p-4 flex flex-wrap justify-between items-center gap-3" key={profile.id}><div><div className="font-bold">{profile.name}</div><div className="text-sm" style={{ color: "var(--muted)" }}>{profile.matchType === "DOMAIN" ? "דומיין" : "שולח"}: {profile.matchValue} · עדיפות {profile.priority}</div></div><div className="flex gap-2"><button className="px-3 py-1 rounded border text-sm" onClick={() => toggleProfile(profile)}>{profile.enabled ? "השבת" : "הפעל"}</button><button className="px-3 py-1 rounded border text-sm" onClick={() => editProfile(profile)}>ערוך</button><button className="px-3 py-1 rounded border text-sm" style={{ color: "#b42318" }} onClick={() => deleteProfile(profile)}>מחק</button></div></div>)}</div>}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4"><div className="card p-5 space-y-3"><h2 className="font-bold">בדיקה לפני קליטה</h2><textarea className="input-field min-h-52" value={sample} onChange={(e) => setSample(e.target.value)} /><button className="btn-primary" onClick={preview} disabled={busy}>{busy ? "מנתח…" : "בדוק מיפוי"}</button></div>{result && <div className="card p-5"><h2 className="font-bold mb-4">תוצאת החילוץ</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Object.entries(result.data || {}).map(([key, value]) => <div className="rounded p-3" style={{ background: "var(--bone)" }} key={key}><div className="text-xs" style={{ color: "var(--muted)" }}>{key}</div><div className="font-medium mt-1">{Array.isArray(value) ? value.join(", ") : String(value || "—")}</div></div>)}</div><div className="mt-4 text-sm">{result.next?.canCreateLead ? "✓ נמצאו שם וטלפון — ניתן ליצור ליד" : `חסרים שדות: ${(result.next?.missingRequiredFields || []).join(", ")}`}</div></div>}</section>
    </div>
  );
}

