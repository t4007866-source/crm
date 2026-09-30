"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const initial = {
  name: "", company: "", taxId: "", phone: "", whatsappPhone: "", email: "",
  address: "", city: "", lat: "", lng: "", status: "LEAD", source: "WEBSITE", confidence: "MEDIUM",
  contactName: "", contactRole: "", contactPhone: "", contactEmail: "",
  productName: "", model: "", serialNumber: "", installationDate: "", serviceFrequencyDays: "365", nextServiceDate: "", warrantyUntil: "", technicianTips: "",
  debtDescription: "", debtAmount: "", debtDueDate: "", notes: "", whatsappConsent: false, communicationOptOut: false,
};

function addDays(date: string, days: string) {
  if (!date || !days) return "";
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [section, setSection] = useState("identity");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof initial, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));
  const computedNextDate = useMemo(() => form.nextServiceDate || addDays(form.installationDate, form.serviceFrequencyDays), [form.nextServiceDate, form.installationDate, form.serviceFrequencyDays]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    const payload = {
      name: form.name, company: form.company, taxId: form.taxId, phone: form.phone, whatsappPhone: form.whatsappPhone || form.phone,
      email: form.email, address: form.address, city: form.city, lat: form.lat, lng: form.lng, status: form.status, source: form.source, confidence: form.confidence,
      notes: form.notes, whatsappConsent: form.whatsappConsent, communicationOptOut: form.communicationOptOut,
      primaryContact: { name: form.contactName, role: form.contactRole, phone: form.contactPhone, email: form.contactEmail },
      servicePlan: { productName: form.productName, model: form.model, serialNumber: form.serialNumber, installationDate: form.installationDate, serviceFrequencyDays: form.serviceFrequencyDays, nextServiceDate: computedNextDate, warrantyUntil: form.warrantyUntil, technicianTips: form.technicianTips },
      debt: { description: form.debtDescription, amount: form.debtAmount, dueDate: form.debtDueDate },
    };
    const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json(); setSaving(false);
    if (!res.ok) { setError(typeof data.error === "string" ? data.error : "לא ניתן לשמור את הלקוח"); return; }
    router.push(`/customers/${data.id}`); router.refresh();
  };

  const sections = [["identity", "זיהוי ופרטים"], ["contacts", "אנשי קשר"], ["technical", "מערכת וסננים"], ["communication", "תקשורת והסכמה"], ["finance", "חובות ומסמכים"], ["notes", "הערות והרשאות"]];
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex justify-between items-start"><div><div className="text-sm" style={{ color: "var(--muted)" }}>לקוחות / לקוח חדש</div><h1 className="text-3xl font-bold mt-1">הוספת לקוח חדש</h1><p className="text-sm mt-1" style={{ color: "var(--muted)" }}>מלא את הפרטים הדרושים. ניתן להשלים מידע חסר מאוחר יותר.</p></div><button className="btn-primary" style={{ background: "#8a8275" }} onClick={() => router.back()}>ביטול</button></div>
      <form onSubmit={submit} className="space-y-4">
        <div className="card p-2 flex gap-1 flex-wrap">{sections.map(([id, label]) => <button type="button" key={id} onClick={() => setSection(id)} className="px-3 py-2 rounded text-sm" style={{ background: section === id ? "var(--ink)" : "transparent", color: section === id ? "#fff" : "var(--muted)" }}>{label}</button>)}</div>
        {section === "identity" && <Panel title="זיהוי הלקוח" hint="פרטי בסיס, סטטוס, מקור וכתובת"><Grid><Field label="שם מלא *" value={form.name} onChange={(v) => update("name", v)} required /><Field label="חברה" value={form.company} onChange={(v) => update("company", v)} /><Field label="ח.פ / עוסק מורשה" value={form.taxId} onChange={(v) => update("taxId", v)} /><Field label="טלפון ראשי *" value={form.phone} onChange={(v) => update("phone", v)} required type="tel" /><Field label="אימייל" value={form.email} onChange={(v) => update("email", v)} type="email" /><Select label="סטטוס" value={form.status} onChange={(v) => update("status", v)} options={[["LEAD", "ליד"], ["PROSPECT", "פרוספקט"], ["ACTIVE", "פעיל"], ["CHURNED", "עזב"]]} /><Select label="מקור" value={form.source} onChange={(v) => update("source", v)} options={[["WEBSITE", "אתר"], ["REFERRAL", "המלצה"], ["FACEBOOK", "Facebook"], ["INSTAGRAM", "Instagram"], ["WHATSAPP", "WhatsApp"], ["GMAIL", "Gmail"], ["OTHER", "אחר"]]} /><Select label="Confidence" value={form.confidence} onChange={(v) => update("confidence", v)} options={[["LOW", "נמוכה"], ["MEDIUM", "בינונית"], ["HIGH", "גבוהה"]]} /><Field label="כתובת מלאה" value={form.address} onChange={(v) => update("address", v)} /><Field label="עיר *" value={form.city} onChange={(v) => update("city", v)} /><Field label="Latitude" value={form.lat} onChange={(v) => update("lat", v)} /><Field label="Longitude" value={form.lng} onChange={(v) => update("lng", v)} /></Grid><div className="mt-4 p-3 rounded text-sm" style={{ background: "#e8f0fe", color: "#174ea6" }}>לאחר שמירת הלקוח יתווספו בכרטיס כפתורי Waze, Google Maps, חיוג ו-WhatsApp.</div></Panel>}
        {section === "contacts" && <Panel title="איש קשר ראשי" hint="ניתן להוסיף אנשי קשר נוספים לאחר יצירת הלקוח"><Grid><Field label="שם איש קשר" value={form.contactName} onChange={(v) => update("contactName", v)} /><Field label="תפקיד" value={form.contactRole} onChange={(v) => update("contactRole", v)} /><Field label="טלפון ישיר" value={form.contactPhone} onChange={(v) => update("contactPhone", v)} type="tel" /><Field label="אימייל ישיר" value={form.contactEmail} onChange={(v) => update("contactEmail", v)} type="email" /></Grid></Panel>}
        {section === "technical" && <Panel title="מערכת, ציוד וסננים" hint="מועד השירות הבא מחושב אוטומטית מתאריך ההתקנה והתדירות"><Grid><Field label="סוג מערכת / מוצר" value={form.productName} onChange={(v) => update("productName", v)} /><Field label="דגם מדויק" value={form.model} onChange={(v) => update("model", v)} /><Field label="מספר סידורי" value={form.serialNumber} onChange={(v) => update("serialNumber", v)} /><Field label="תאריך התקנה ראשונית" value={form.installationDate} onChange={(v) => update("installationDate", v)} type="date" /><Field label="מחזור טיפול (ימים)" value={form.serviceFrequencyDays} onChange={(v) => update("serviceFrequencyDays", v)} type="number" /><Field label="תאריך טיפול הבא" value={computedNextDate} onChange={(v) => update("nextServiceDate", v)} type="date" /><Field label="תוקף אחריות" value={form.warrantyUntil} onChange={(v) => update("warrantyUntil", v)} type="date" /></Grid><TextArea label="טיפים לטכנאי" value={form.technicianTips} onChange={(v) => update("technicianTips", v)} /><div className="mt-4 p-3 rounded" style={{ background: "#fff8e1", border: "1px solid #ffe082" }}>המערכת תציג בכרטיס הלקוח התראה כאשר מועד החלפת הסנן מתקרב.</div></Panel>}
        {section === "communication" && <Panel title="תקשורת והסכמות" hint="הודעות WhatsApp יישלחו רק לפי הרשאות ותהליך האישור"><Grid><Field label="מספר WhatsApp" value={form.whatsappPhone} onChange={(v) => update("whatsappPhone", v)} type="tel" /></Grid><div className="space-y-3 mt-4"><Check label="הלקוח אישר קבלת WhatsApp" checked={form.whatsappConsent} onChange={(v) => update("whatsappConsent", v)} /><Check label="Opt-out: הלקוח ביקש לא לקבל הודעות אוטומטיות" checked={form.communicationOptOut} onChange={(v) => update("communicationOptOut", v)} /></div></Panel>}
        {section === "finance" && <Panel title="חובות ומסמכים" hint="מסמכים יועלו לאחר יצירת הלקוח"><Grid><Field label="תיאור חוב" value={form.debtDescription} onChange={(v) => update("debtDescription", v)} /><Field label="סכום חוב (₪)" value={form.debtAmount} onChange={(v) => update("debtAmount", v)} type="number" /><Field label="מועד תשלום" value={form.debtDueDate} onChange={(v) => update("debtDueDate", v)} type="date" /></Grid><div className="mt-4 p-4 border border-dashed rounded text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>לאחר שמירת הלקוח ניתן להעלות חוזה, הצעת מחיר, אחריות וחשבוניות מכרטיס הלקוח.</div></Panel>}
        {section === "notes" && <Panel title="הערות והרשאות"><TextArea label="הערות פנימיות" value={form.notes} onChange={(v) => update("notes", v)} /><div className="mt-4 p-3 rounded" style={{ background: "#e8f0fe", color: "#174ea6" }}>הרשאות, שדות מותאמים ואיש השירות האחראי ניתנים להתאמה על ידי מנהל המערכת.</div></Panel>}
        {error && <div className="p-3 rounded text-sm" style={{ background: "#ffebee", color: "#c62828" }}>{error}</div>}
        <div className="flex justify-between items-center card p-4"><div className="text-sm" style={{ color: "var(--muted)" }}>יישמרו כרטיס לקוח, איש קשר, תכנית שירות וחוב אם מולאו.</div><button type="submit" className="btn-accent" disabled={saving}>{saving ? "שומר..." : "שמור לקוח"}</button></div>
      </form>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) { return <section className="card p-5"><h2 className="text-lg font-bold">{title}</h2>{hint && <p className="text-sm mt-1 mb-5" style={{ color: "var(--muted)" }}>{hint}</p>}<div className="mt-4">{children}</div></section>; }
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>; }
function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) { return <label className="block text-sm"><span className="block mb-1 font-medium">{label}</span><input className="input-field" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) { return <label className="block text-sm"><span className="block mb-1 font-medium">{label}</span><select className="input-field" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="block text-sm mt-4"><span className="block mb-1 font-medium">{label}</span><textarea className="input-field" rows={4} value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) { return <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />{label}</label>; }

