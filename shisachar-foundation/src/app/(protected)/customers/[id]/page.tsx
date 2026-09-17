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
  const [service, setService] = useState({ type: "MAINTENANCE", fault: "", scheduledAt: "", notes: "", systemId: "" });
  const [edit, setEdit] = useState<any>(null);
  const [system, setSystem] = useState({ systemType: "", model: "", serialNumber: "", installationDate: "", serviceCycleDays: "365", nextFilterChangeDate: "", warrantyUntil: "", technicianTips: "" });

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

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const response = await fetch("/api/service-calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: id, installedSystemId: service.systemId || null, type: modal === "install" ? "INSTALLATION" : service.type, fault: service.fault, scheduledAt: service.scheduledAt || null, notes: service.notes }) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(data.error || "לא ניתן לפתוח קריאה"); return; }
    setMessage("הקריאה נפתחה ונוספה ליומן השירות וההתקנות");
    setModal("");
    load(id);
  };

  const tabs = [["summary", "פרטי לקוח"], ["systems", "מערכות וסננים"], ["service", "יומן שירות והתקנות"], ["tasks", "משימות"], ["orders", "הזמנות"]];
  return <div className="max-w-6xl mx-auto space-y-4">
    <Link href="/customers" className="text-sm" style={{ color: "var(--rust)" }}>← חזרה ללקוחות</Link>
    <div className="card p-5 flex justify-between items-start gap-4"><div><h1 className="text-3xl font-bold">{customer.name}</h1><p style={{ color: "var(--muted)" }}>{customer.company || "לקוח פרטי"} · {customer.city || "ללא עיר"}</p></div><div className="flex gap-2 flex-wrap justify-end"><a href={`tel:${customer.phone}`} className="btn-primary">חיוג</a><a href={`https://wa.me/${String(customer.phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-accent">WhatsApp</a><button onClick={() => setModal("edit")} className="btn-primary">עריכת לקוח</button><button onClick={() => setModal("service")} className="btn-primary">פתיחת קריאת שירות</button><button onClick={() => setModal("install")} className="btn-primary">תיאום התקנה</button></div></div>
    {nextAlerts.filter((x: any) => x.days <= 30).map((x: any) => <div key={x.id} className="p-3 rounded border" style={{ background: x.days <= 0 ? "#ffebee" : "#fff8e1", color: x.days <= 0 ? "#b71c1c" : "#795548" }}>⚠ <strong>{x.systemType}:</strong> {x.days <= 0 ? "מועד החלפת הסננים עבר" : `החלפת סננים בעוד ${x.days} ימים`} · <button onClick={() => { setTab("systems"); setModal("system"); }} className="underline">ערוך מועד</button></div>)}
    {message && <div className="p-3 rounded" style={{ background: "#e8f5e9", color: "#2e7d32" }}>{message}</div>}
    <div className="card p-2 flex gap-1 flex-wrap">{tabs.map(([x, label]) => <button key={x} onClick={() => setTab(x)} className="px-4 py-2 rounded text-sm" style={{ background: tab === x ? "var(--ink)" : "transparent", color: tab === x ? "#fff" : "var(--muted)" }}>{label}</button>)}</div>
    {modal === "edit" && <EditCustomer edit={edit} setEdit={setEdit} save={saveCustomer} saving={saving} close={() => setModal("")} />}
    {(modal === "service" || modal === "install") && <ServiceForm mode={modal} service={service} setService={setService} systems={customer.installedSystems || []} save={saveService} saving={saving} close={() => setModal("")} />}
    {modal === "system" && <SystemForm customerId={id} system={system} setSystem={setSystem} close={() => setModal("")} onSaved={() => { setModal(""); load(id); }} />}
    {tab === "summary" && <section className="card p-5"><div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">{[["שם", customer.name], ["טלפון", customer.phone], ["אימייל", customer.email || "—"], ["חברה", customer.company || "—"], ["עיר", customer.city || "—"], ["כתובת", customer.address || "—"], ["סטטוס", customer.status], ["מקור", customer.source || "—"], ["הערות", customer.notes || "—"]].map(([label, value]) => <div key={label}><div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div><div>{value}</div></div>)}</div></section>}
    {tab === "systems" && <section className="card p-5"><div className="flex justify-between mb-4"><h2 className="font-bold">מערכות מותקנות ותכניות סננים</h2><button onClick={() => setModal("system")} className="btn-accent">מערכת חדשה</button></div><List items={customer.installedSystems} empty="אין מערכות מותקנות" render={(s: any) => <><strong>{s.systemType}</strong> · {s.model} · סנן הבא: {s.nextFilterChangeDate ? new Date(s.nextFilterChangeDate).toLocaleDateString("he-IL") : "לא הוגדר"} <button className="underline mr-3" onClick={() => { setSystem({ systemType: s.systemType || "", model: s.model || "", serialNumber: s.serialNumber || "", installationDate: s.installationDate?.slice(0, 10) || "", serviceCycleDays: String(s.serviceCycleDays || 365), nextFilterChangeDate: s.nextFilterChangeDate?.slice(0, 10) || "", warrantyUntil: s.warrantyUntil?.slice(0, 10) || "", technicianTips: s.technicianTips || "" }); setModal("system"); }}>עריכה</button></>} /></section>}
    {tab === "service" && <section className="card p-5"><div className="flex justify-between mb-4"><h2 className="font-bold">יומן שירות והתקנות</h2><button onClick={() => setModal("service")} className="btn-accent">קריאה חדשה</button></div><List items={customer.serviceCalls} empty="אין קריאות שירות" render={(s: any) => <><strong>{s.callNumber}</strong> · {s.type} · {s.status} · {s.fault || "ללא תקלה"} · {s.scheduledAt ? new Date(s.scheduledAt).toLocaleString("he-IL") : "ללא תזמון"}</>} /></section>}
    {tab === "tasks" && <section className="card p-5"><List items={customer.tasks} empty="אין משימות" render={(t: any) => <><strong>{t.title}</strong> · {t.status} · {t.dueAt ? new Date(t.dueAt).toLocaleString("he-IL") : "ללא מועד"}</>} /></section>}
    {tab === "orders" && <section className="card p-5"><List items={customer.orders} empty="אין הזמנות" render={(o: any) => <><strong>{o.orderNumber}</strong> · {o.title} · ₪{o.total.toLocaleString()} · {o.status}</>} /></section>}
  </div>;
}
function EditCustomer({ edit, setEdit, save, saving, close }: any) { return <section className="card p-5"><h2 className="font-bold mb-4">עריכת פרטי לקוח</h2><form onSubmit={save} className="grid grid-cols-2 gap-3">{[["name", "שם"], ["company", "חברה"], ["phone", "טלפון"], ["email", "אימייל"], ["city", "עיר"], ["address", "כתובת"], ["notes", "הערות"]].map(([key, label]) => <label key={key} className="text-sm">{label}<input className="input-field" value={edit[key] || ""} onChange={e => setEdit({ ...edit, [key]: e.target.value })} /></label>)}<div className="col-span-2 flex gap-2"><button className="btn-accent" disabled={saving}>{saving ? "שומר..." : "שמור שינויים"}</button><button type="button" className="btn-primary" onClick={close}>ביטול</button></div></form></section>; }
function ServiceForm({ mode, service, setService, systems, save, saving, close }: any) { return <section className="card p-5"><h2 className="font-bold mb-4">{mode === "install" ? "תיאום התקנה" : "פתיחת קריאת שירות"}</h2><form onSubmit={save} className="grid grid-cols-2 gap-3"><select className="input-field" value={service.type} onChange={e => setService({ ...service, type: e.target.value })} disabled={mode === "install"}>{serviceTypes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><select className="input-field" value={service.systemId} onChange={e => setService({ ...service, systemId: e.target.value })}><option value="">בחר מערכת</option>{systems.map((s: any) => <option key={s.id} value={s.id}>{s.systemType} · {s.model}</option>)}</select><input className="input-field" placeholder="סוג תקלה / סיבת ביקור" value={service.fault} onChange={e => setService({ ...service, fault: e.target.value })} required={mode !== "install"} /><input className="input-field" type="datetime-local" value={service.scheduledAt} onChange={e => setService({ ...service, scheduledAt: e.target.value })} /><textarea className="input-field col-span-2" rows={3} placeholder="הערות לטכנאי" value={service.notes} onChange={e => setService({ ...service, notes: e.target.value })} /><div className="col-span-2 flex gap-2"><button className="btn-accent" disabled={saving}>{saving ? "שומר..." : "שמור וכתוב ביומן"}</button><button type="button" className="btn-primary" onClick={close}>ביטול</button></div></form></section>; }
function SystemForm({ customerId, system, setSystem, close, onSaved }: any) { const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const submit = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); const r = await fetch("/api/installed-systems", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, ...system }) }); const d = await r.json(); setSaving(false); if (!r.ok) { setError(d.error || "שגיאה"); return; } onSaved(); }; return <section className="card p-5"><h2 className="font-bold mb-4">מערכת מותקנת ותכנית סננים</h2>{error && <div className="p-2 rounded mb-3" style={{ background: "#ffebee", color: "#c62828" }}>{error}</div>}<form onSubmit={submit} className="grid grid-cols-2 gap-3">{[["systemType", "סוג מערכת"], ["model", "דגם"], ["serialNumber", "מספר סידורי"], ["installationDate", "תאריך התקנה"], ["serviceCycleDays", "מחזור טיפול בימים"], ["nextFilterChangeDate", "מועד החלפת סננים"], ["warrantyUntil", "אחריות עד"]].map(([key, label]) => <label key={key} className="text-sm">{label}<input className="input-field" type={String(key).includes("Date") || String(key).includes("date") ? "date" : String(key).includes("Days") ? "number" : "text"} value={system[key] || ""} onChange={e => setSystem({ ...system, [key]: e.target.value })} required={key === "systemType" || key === "model"} /></label>)}<label className="text-sm col-span-2">טיפים לטכנאי<textarea className="input-field" rows={3} value={system.technicianTips} onChange={e => setSystem({ ...system, technicianTips: e.target.value })} /></label><div className="col-span-2 flex gap-2"><button className="btn-accent" disabled={saving}>{saving ? "שומר..." : "שמור מערכת"}</button><button type="button" className="btn-primary" onClick={close}>ביטול</button></div></form></section>; }
function List({ items, empty, render }: any) { return items?.length ? <div className="space-y-2">{items.map((x: any) => <div key={x.id} className="border-b pb-2 text-sm" style={{ borderColor: "var(--border)" }}>{render(x)}</div>)}</div> : <p style={{ color: "var(--muted)" }}>{empty}</p>; }



