"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const serviceTypes = [
  ["MAINTENANCE", "תחזוקה"],
  ["FILTER_CHANGE", "החלפת סננים"],
  ["REPAIR", "תיקון תקלה"],
  ["INSPECTION", "בדיקה"],
  ["INSTALLATION", "התקנה"],
];

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [tab, setTab] = useState("summary");
  const [modal, setModal] = useState<"service" | "install" | "edit" | "system" | "" >("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [service, setService] = useState({ type: "MAINTENANCE", fault: "", description: "", scheduledAt: "", technicianId: "", cost: "", notes: "", systemId: "" });
  const [edit, setEdit] = useState<any>(null);
  const [system, setSystem] = useState({ id: "", systemType: "", model: "", serialNumber: "", installationDate: "", serviceCycleDays: "365", nextFilterChangeDate: "", warrantyUntil: "", manufacturerWarrantyStart: "", manufacturerWarrantyUntil: "", manufacturerWarrantyStatus: "NONE", manufacturerWarrantyReminderDays: "30", technicianTips: "" });

  const load = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `שגיאת שרת ${response.status}`);
      setCustomer(data);
      setEdit({ name: data.name || "", company: data.company || "", phone: data.phone || "", email: data.email || "", address: data.address || "", city: data.city || "", notes: data.notes || "", status: data.status || "LEAD" });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא ניתן לטעון את הלקוח");
    }
  };

  useEffect(() => {
    params.then(({ id: value }) => {
      setId(value);
      load(value);
    });
  }, [params]);

  const nextAlerts = useMemo(() => (customer?.installedSystems || []).filter((s: any) => s.nextFilterChangeDate).map((s: any) => ({ ...s, days: Math.ceil((new Date(s.nextFilterChangeDate).getTime() - Date.now()) / 86400000) })), [customer]);

  if (error) return <div className="card p-6 max-w-xl mx-auto"><h1 className="text-xl font-bold">לא ניתן לפתוח את כרטיס הלקוח</h1><p className="mt-2">{error}</p><Link href="/customers" className="btn-primary inline-block mt-4">חזרה ללקוחות</Link></div>;
  if (!customer || !edit) return <div className="p-8 text-center">טוען...</div>;

  const saveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const response = await fetch(`/api/customers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(data.error || "לא ניתן לשמור את השינויים"); return; }
    setMessage("פרטי הלקוח עודכנו");
    setModal("");
    load(id);
  };

  const deleteCustomer = async () => {
    if (!window.confirm(`האם למחוק את הלקוח ${customer.name}? פעולה זו אינה ניתנת לביטול.`)) return;
    setDeleting(true);
    const response = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    const data = await response.json();
    setDeleting(false);
    if (!response.ok) {
      const details = Array.isArray(data.details) ? `: ${data.details.join(", ")}` : "";
      setMessage(`${data.error || "לא ניתן למחוק את הלקוח"}${details}`);
      return;
    }
    window.location.href = "/customers";
  };

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const response = await fetch("/api/service-calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: id, installedSystemId: service.systemId || null, type: modal === "install" ? "INSTALLATION" : service.type, fault: service.fault, description: service.description || service.fault, technicianId: service.technicianId || null, cost: service.cost || null, scheduledAt: service.scheduledAt || null, notes: service.notes }) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(data.error || "לא ניתן לפתוח קריאה"); return; }
    setMessage("הקריאה נפתחה ונוספה ליומן השירות וההתקנות");
    setModal("");
    load(id);
  };

  const tabs = [["summary", "סקירה"], ["details", "פרטים"], ["systems", "מערכות"], ["orders", "הזמנות"], ["service", "קריאות שירות"], ["calendar", "יומן"], ["communication", "תקשורת"], ["followup", "Follow-up"], ["documents", "מסמכים"], ["activity", "פעילות מערכת"]];
  return <div className="max-w-6xl mx-auto space-y-4">
    <Link href="/customers" className="text-sm" style={{ color: "var(--rust)" }}>← חזרה ללקוחות</Link>
    <div className="card p-5 flex justify-between items-start gap-4"><div><h1 className="text-3xl font-bold">{customer.name}</h1><p style={{ color: "var(--muted)" }}>{customer.company || "לקוח פרטי"} · {customer.city || "ללא עיר"}</p></div><div className="flex gap-2 flex-wrap justify-end"><a href={`tel:${customer.phone}`} className="btn-primary">חיוג</a><a href={`https://wa.me/${String(customer.phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-accent">WhatsApp</a><button onClick={() => setModal("edit")} className="btn-primary">עריכת לקוח</button><button onClick={() => setModal("service")} className="btn-primary">פתיחת קריאת שירות</button><button onClick={() => setModal("install")} className="btn-primary">תיאום התקנה</button><button onClick={deleteCustomer} disabled={deleting} className="btn-danger">{deleting ? "מוחק..." : "מחיקת לקוח"}</button></div></div>
    {nextAlerts.filter((x: any) => x.days <= 30).map((x: any) => <div key={x.id} className="p-3 rounded border" style={{ background: x.days <= 0 ? "#ffebee" : "#fff8e1", color: x.days <= 0 ? "#b71c1c" : "#795548" }}>⚠ <strong>{x.systemType}:</strong> {x.days <= 0 ? "מועד החלפת הסננים עבר" : `החלפת סננים בעוד ${x.days} ימים`} · <button onClick={() => { setTab("systems"); setModal("system"); }} className="underline">ערוך מועד</button></div>)}
    {message && <div className="p-3 rounded" style={{ background: "#e8f5e9", color: "#2e7d32" }}>{message}</div>}
    <div className="card p-2 flex gap-1 flex-wrap">{tabs.map(([x, label]) => <button key={x} onClick={() => setTab(x)} className="px-4 py-2 rounded text-sm" style={{ background: tab === x ? "var(--ink)" : "transparent", color: tab === x ? "#fff" : "var(--muted)" }}>{label}</button>)}</div>
    {modal === "edit" && <EditCustomer edit={edit} setEdit={setEdit} save={saveCustomer} saving={saving} close={() => setModal("")} />}
    {(modal === "service" || modal === "install") && <ServiceForm mode={modal} service={service} setService={setService} systems={customer.installedSystems || []} save={saveService} saving={saving} close={() => setModal("")} />}
    {modal === "system" && <SystemForm customerId={id} system={system} setSystem={setSystem} close={() => setModal("")} onSaved={() => { setModal(""); load(id); }} />}
    {tab === "summary" && <><section className="card p-5"><div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">{[["שם", customer.name], ["טלפון", customer.phone], ["אימייל", customer.email || "—"], ["חברה", customer.company || "—"], ["עיר", customer.city || "—"], ["כתובת", customer.address || "—"], ["סטטוס", customer.status], ["מקור", customer.source || "—"], ["הערות", customer.notes || "—"]].map(([label, value]) => <div key={label}><div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div><div>{value}</div></div>)}</div></section><InsurancePanel customer={customer} customerId={id} onSaved={() => load(id)} /></>}
    {tab === "systems" && <section className="card p-5"><div className="flex justify-between mb-4"><h2 className="font-bold">מערכות מותקנות ותכניות סננים</h2><button onClick={() => setModal("system")} className="btn-accent">מערכת חדשה</button></div><List items={customer.installedSystems} empty="אין מערכות מותקנות" render={(s: any) => <><strong>{s.systemType}</strong> · {s.model} · סנן הבא: {s.nextFilterChangeDate ? new Date(s.nextFilterChangeDate).toLocaleDateString("he-IL") : "לא הוגדר"} <button className="underline mr-3" onClick={() => { setSystem({ id: s.id, systemType: s.systemType || "", model: s.model || "", serialNumber: s.serialNumber || "", installationDate: s.installationDate?.slice(0, 10) || "", serviceCycleDays: String(s.serviceCycleDays || 365), nextFilterChangeDate: s.nextFilterChangeDate?.slice(0, 10) || "", warrantyUntil: s.warrantyUntil?.slice(0, 10) || "", manufacturerWarrantyStart: s.manufacturerWarrantyStart?.slice(0, 10) || "", manufacturerWarrantyUntil: s.manufacturerWarrantyUntil?.slice(0, 10) || "", manufacturerWarrantyStatus: s.manufacturerWarrantyStatus || "NONE", manufacturerWarrantyReminderDays: String(s.manufacturerWarrantyReminderDays || 30), technicianTips: s.technicianTips || "" }); setModal("system"); }}>עריכה</button></>} /></section>}
    {tab === "service" && <section className="card p-5"><div className="flex justify-between mb-4"><h2 className="font-bold">יומן שירות והתקנות</h2><button onClick={() => setModal("service")} className="btn-accent">קריאה חדשה</button></div><List items={customer.serviceCalls} empty="אין קריאות שירות" render={(s: any) => <><strong>{s.callNumber}</strong> · {s.type} · {s.status} · {s.fault || "ללא תקלה"} · {s.scheduledAt ? new Date(s.scheduledAt).toLocaleString("he-IL") : "ללא תזמון"}</>} /></section>}
    {tab === "tasks" && <section className="card p-5"><List items={customer.tasks} empty="אין משימות" render={(t: any) => <><strong>{t.title}</strong> · {t.status} · {t.dueAt ? new Date(t.dueAt).toLocaleString("he-IL") : "ללא מועד"}</>} /></section>}
    {tab === "orders" && <section className="card p-5"><div className="flex justify-between mb-4"><h2 className="font-bold">הזמנות</h2><Link href="/orders" className="btn-accent">יצירת הזמנה</Link></div><List items={customer.orders} empty="אין הזמנות" render={(o: any) => <><strong>{o.orderNumber}</strong> · {o.title} · ₪{Number(o.total || 0).toLocaleString("he-IL")} · {o.status}</>} /></section>}
    {tab === "details" && <section className="card p-5"><h2 className="font-bold mb-4">פרטי קשר וכתובת</h2><div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">{[["שם", customer.name], ["טלפון", customer.phone], ["אימייל", customer.email || "—"], ["חברה", customer.company || "—"], ["עיר", customer.city || "—"], ["כתובת", customer.address || "—"], ["מקור", sourceText(customer.source)], ["שפה", customer.preferredLanguage || "he"], ["הסכמה ל-WhatsApp", customer.whatsappConsent ? "כן" : "לא"]].map(([label, value]) => <div key={String(label)}><div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div><div>{value}</div></div>)}</div><div className="flex gap-2 mt-5"><a className="btn-primary" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([customer.address, customer.city].filter(Boolean).join(", "))}`} target="_blank" rel="noreferrer">הצג במפה</a><a className="btn-primary" href={`https://waze.com/ul?q=${encodeURIComponent([customer.address, customer.city].filter(Boolean).join(", "))}`} target="_blank" rel="noreferrer">נווט ב-Waze</a><a className="btn-primary" href={`mailto:${customer.email || ""}`}>שליחת אימייל</a></div></section>}
    {tab === "calendar" && <section className="card p-5"><h2 className="font-bold mb-4">יומן לקוח</h2><List items={customer.appointments} empty="אין ביקורים מתוזמנים" render={(a: any) => <><strong>{a.title}</strong> · {new Date(a.startAtUtc).toLocaleString("he-IL")} · {a.status}</>} /></section>}
    {tab === "communication" && <section className="card p-5"><h2 className="font-bold mb-4">תקשורת</h2><div className="flex gap-2 mb-4"><a href={`tel:${customer.phone}`} className="btn-primary">התקשר</a><a href={`https://wa.me/${String(customer.phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-accent">WhatsApp</a><a href={`mailto:${customer.email || ""}`} className="btn-primary">אימייל</a></div><List items={(customer.activities || []).filter((a: any) => ["CALL", "EMAIL", "WHATSAPP"].includes(a.type))} empty="אין פעולות תקשורת" render={(a: any) => <><strong>{a.subject}</strong> · {a.type} · {new Date(a.createdAt).toLocaleString("he-IL")}</>} /></section>}
    {tab === "followup" && <section className="card p-5"><h2 className="font-bold mb-4">Follow-up</h2><List items={customer.leads?.flatMap((lead: any) => lead.followUps || [])} empty="אין משימות Follow-up" render={(f: any) => <><strong>{f.channel}</strong> · {f.status} · {new Date(f.scheduledAt).toLocaleString("he-IL")} · {f.notes || ""}</>} /></section>}
    {tab === "documents" && <section className="card p-5"><h2 className="font-bold mb-4">מסמכים</h2><p className="text-sm" style={{ color: "var(--muted)" }}>אין מודול מסמכים זמין בסכמה הנוכחית.</p></section>}
    {tab === "activity" && <section className="card p-5"><h2 className="font-bold mb-4">ציר פעילות מאוחד</h2><Timeline customer={customer} /></section>}
  </div>;
}
function InsurancePanel({ customer, customerId, onSaved }: any) {
  const [form, setForm] = useState({
    enabled: Boolean(customer.serviceInsuranceEnabled),
    plan: customer.serviceInsurancePlan || "",
    startDate: customer.serviceInsuranceStartDate?.slice(0, 10) || "",
    endDate: customer.serviceInsuranceEndDate?.slice(0, 10) || "",
    amount: String(customer.serviceInsuranceMonthlyPrice || ""),
    frequency: customer.serviceInsuranceFrequency || "MONTHLY",
    status: customer.serviceInsuranceStatus || "ACTIVE",
    reminderDays: String(customer.serviceInsuranceReminderDays || 30),
    notes: customer.serviceInsuranceNotes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch(`/api/customers/${customerId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceInsuranceEnabled: form.enabled, serviceInsurancePlan: form.plan || null, serviceInsuranceStartDate: form.startDate || null, serviceInsuranceEndDate: form.endDate || null, serviceInsuranceMonthlyPrice: form.amount ? Number(form.amount) : null, serviceInsuranceFrequency: form.frequency, serviceInsuranceStatus: form.status, serviceInsuranceReminderDays: form.reminderDays ? Number(form.reminderDays) : 30, serviceInsuranceNotes: form.notes || null }) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setError(data.error || "לא ניתן לשמור את הביטוח"); return; }
    onSaved();
  };
  return <section className="card p-5"><h2 className="font-bold mb-4">ביטוח שירות בתשלום</h2>{error && <div className="p-2 rounded mb-3" style={{ background: "#ffebee", color: "#b71c1c" }}>{error}</div>}<form onSubmit={save} className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> ביטוח מופעל</label><label>תכנית<input className="input-field" value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} /></label><label>תאריך התחלה<input className="input-field" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></label><label>תאריך סיום / חידוש<input className="input-field" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></label><label>סכום<input className="input-field" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><label>תדירות<select className="input-field" value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}><option value="MONTHLY">חודשי</option><option value="QUARTERLY">רבעוני</option><option value="ANNUAL">שנתי</option><option value="ONE_TIME">חד-פעמי</option></select></label><label>סטטוס<select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="ACTIVE">פעיל</option><option value="EXPIRED">פג תוקף</option><option value="CANCELLED">בוטל</option><option value="PENDING_RENEWAL">ממתין לחידוש</option></select></label><label>התראה לפני חידוש (ימים)<input className="input-field" type="number" min="0" value={form.reminderDays} onChange={e => setForm({ ...form, reminderDays: e.target.value })} /></label><label className="col-span-2 md:col-span-4">הערות<textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label><div className="col-span-2 md:col-span-4 flex items-center gap-3"><button className="btn-accent" disabled={saving}>{saving ? "שומר..." : "שמור ביטוח"}</button><span className="text-xs" style={{ color: "var(--muted)" }}>חידושים ותשלומים מתועדים בהיסטוריה</span></div></form>{customer.serviceInsuranceRenewals?.length > 0 && <div className="mt-5"><h3 className="font-bold mb-2">היסטוריית חידושים ותשלומים</h3><List items={customer.serviceInsuranceRenewals} empty="אין היסטוריה" render={(r: any) => <>{new Date(r.startDate).toLocaleDateString("he-IL")}–{new Date(r.endDate).toLocaleDateString("he-IL")} · ₪{Number(r.amount).toLocaleString("he-IL")} · {r.paidAt ? "שולם" : "לא שולם"}</>} /></div>}</section>;
}
function EditCustomer({ edit, setEdit, save, saving, close }: any) { return <section className="card p-5"><h2 className="font-bold mb-4">עריכת פרטי לקוח</h2><form onSubmit={save} className="grid grid-cols-2 gap-3">{[["name", "שם"], ["company", "חברה"], ["phone", "טלפון"], ["email", "אימייל"], ["city", "עיר"], ["address", "כתובת"], ["notes", "הערות"]].map(([key, label]) => <label key={key} className="text-sm">{label}<input className="input-field" value={edit[key] || ""} onChange={e => setEdit({ ...edit, [key]: e.target.value })} /></label>)}<div className="col-span-2 flex gap-2"><button className="btn-accent" disabled={saving}>{saving ? "שומר..." : "שמור שינויים"}</button><button type="button" className="btn-primary" onClick={close}>ביטול</button></div></form></section>; }
function ServiceForm({ mode, service, setService, systems, save, saving, close }: any) { return <section className="card p-5"><h2 className="font-bold mb-4">{mode === "install" ? "תיאום התקנה" : "פתיחת קריאת שירות"}</h2><form onSubmit={save} className="grid grid-cols-2 gap-3"><select className="input-field" value={service.type} onChange={e => setService({ ...service, type: e.target.value })} disabled={mode === "install"}>{serviceTypes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><select className="input-field" value={service.systemId} onChange={e => setService({ ...service, systemId: e.target.value })}><option value="">בחר מערכת</option>{systems.map((s: any) => <option key={s.id} value={s.id}>{s.systemType} · {s.model}</option>)}</select><input className="input-field" placeholder="סוג תקלה / סיבת ביקור" value={service.fault} onChange={e => setService({ ...service, fault: e.target.value })} required={mode !== "install"} /><input className="input-field" placeholder="תיאור מפורט" value={service.description} onChange={e => setService({ ...service, description: e.target.value })} /><input className="input-field" type="datetime-local" value={service.scheduledAt} onChange={e => setService({ ...service, scheduledAt: e.target.value })} /><input className="input-field" type="number" min="0" step="0.01" placeholder="עלות (₪)" value={service.cost} onChange={e => setService({ ...service, cost: e.target.value })} /><textarea className="input-field col-span-2" rows={3} placeholder="הערות לטכנאי" value={service.notes} onChange={e => setService({ ...service, notes: e.target.value })} /><div className="col-span-2 flex gap-2"><button className="btn-accent" disabled={saving}>{saving ? "שומר..." : "שמור וכתוב ביומן"}</button><button type="button" className="btn-primary" onClick={close}>ביטול</button></div></form></section>; }
function SystemForm({ customerId, system, setSystem, close, onSaved }: any) { const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const submit = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); const endpoint = system.id ? `/api/installed-systems/${system.id}` : "/api/installed-systems"; const method = system.id ? "PATCH" : "POST"; const r = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, ...system }) }); const d = await r.json(); setSaving(false); if (!r.ok) { setError(d.error || "שגיאה"); return; } onSaved(); }; return <section className="card p-5"><h2 className="font-bold mb-4">מערכת מותקנת ותכנית סננים</h2>{error && <div className="p-2 rounded mb-3" style={{ background: "#ffebee", color: "#c62828" }}>{error}</div>}<form onSubmit={submit} className="grid grid-cols-2 gap-3">{[["systemType", "סוג מערכת"], ["model", "דגם"], ["serialNumber", "מספר סידורי"], ["installationDate", "תאריך התקנה"], ["serviceCycleDays", "מחזור טיפול בימים"], ["nextFilterChangeDate", "מועד החלפת סננים"], ["warrantyUntil", "אחריות עד"], ["manufacturerWarrantyStart", "תחילת אחריות יצרן"], ["manufacturerWarrantyUntil", "סיום אחריות יצרן"], ["manufacturerWarrantyReminderDays", "התראה לפני סיום (ימים)"]].map(([key, label]) => <label key={key} className="text-sm">{label}<input className="input-field" type={String(key).includes("Date") || String(key).includes("date") || String(key).includes("WarrantyStart") || String(key).includes("WarrantyUntil") ? "date" : String(key).includes("Days") ? "number" : "text"} value={system[key] || ""} onChange={e => setSystem({ ...system, [key]: e.target.value })} required={key === "systemType" || key === "model"} /></label>)}<label className="text-sm">סטטוס אחריות יצרן<select className="input-field" value={system.manufacturerWarrantyStatus} onChange={e => setSystem({ ...system, manufacturerWarrantyStatus: e.target.value })}><option value="NONE">ללא אחריות</option><option value="ACTIVE">בתוקף</option><option value="EXPIRED">הסתיימה</option></select></label><label className="text-sm col-span-2">טיפים לטכנאי<textarea className="input-field" rows={3} value={system.technicianTips} onChange={e => setSystem({ ...system, technicianTips: e.target.value })} /></label><div className="col-span-2 flex gap-2"><button className="btn-accent" disabled={saving}>{saving ? "שומר..." : "שמור מערכת"}</button><button type="button" className="btn-primary" onClick={close}>ביטול</button></div></form></section>; }
function sourceText(value: string | null | undefined) { const labels: Record<string, string> = { WEBSITE: "אתר", FACEBOOK: "Facebook", INSTAGRAM: "Instagram", REFERRAL: "הפניה", WHATSAPP: "WhatsApp", GMAIL: "אימייל", OTHER: "אחר" }; return value ? labels[value] || value : "—"; }
function Timeline({ customer }: { customer: any }) {
  const items = [
    ...(customer.activities || []).map((x: any) => ({ date: x.createdAt, type: x.type, title: x.subject || "פעילות", note: x.body || "" })),
    ...(customer.orders || []).map((x: any) => ({ date: x.createdAt, type: "ORDER", title: `הזמנה ${x.orderNumber}`, note: x.title || "" })),
    ...(customer.serviceCalls || []).map((x: any) => ({ date: x.createdAt || x.openedAt, type: "SERVICE", title: `קריאת שירות ${x.callNumber}`, note: x.fault || x.description || "" })),
    ...(customer.installedSystems || []).filter((x: any) => x.installationDate).map((x: any) => ({ date: x.installationDate, type: "INSTALLATION", title: `התקנת ${x.systemType}`, note: x.model || "" })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items.length ? <div className="space-y-3">{items.map((item, index) => <div key={`${item.type}-${item.date}-${index}`} className="flex gap-3 border-b pb-3" style={{ borderColor: "var(--border)" }}><span className="w-2 h-2 rounded-full mt-2" style={{ background: "var(--rust)" }} /><div><div className="font-semibold">{item.title}</div><div className="text-xs" style={{ color: "var(--muted)" }}>{new Date(item.date).toLocaleString("he-IL")} · {item.type}</div>{item.note && <div className="text-sm mt-1">{item.note}</div>}</div></div>)}</div> : <p style={{ color: "var(--muted)" }}>אין פעילות להצגה</p>;
}
function List({ items, empty, render }: any) { return items?.length ? <div className="space-y-2">{items.map((x: any) => <div key={x.id} className="border-b pb-2 text-sm" style={{ borderColor: "var(--border)" }}>{render(x)}</div>)}</div> : <p style={{ color: "var(--muted)" }}>{empty}</p>; }




















