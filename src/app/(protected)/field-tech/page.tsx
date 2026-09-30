"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const labels: Record<string, string> = { MAINTENANCE: "תחזוקה", FILTER_CHANGE: "החלפת סננים", REPAIR: "תיקון", INSPECTION: "בדיקה", INSTALLATION: "התקנה" };

type Part = { productId: string; warehouseId: string; name: string; quantity: number };

export default function FieldTechPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [calls, setCalls] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError("");
    const [callsResponse, inventoryResponse] = await Promise.all([fetch(`/api/field-tech?date=${date}`), fetch("/api/inventory")]);
    const callsData = await callsResponse.json();
    const inventoryData = await inventoryResponse.json();
    if (!callsResponse.ok) { setError(callsData.error || "לא ניתן לטעון קריאות"); return; }
    setCalls(callsData.calls || []);
    setProducts(inventoryData.items || []);
  };
  useEffect(() => { load(); }, [date]);
  const completed = calls.filter((c) => c.status === "COMPLETED").length;
  const progress = calls.length ? Math.round((completed / calls.length) * 100) : 0;
  const openCall = async (call: any) => {
    setSelected(call);
    const response = await fetch(`/api/customers/${call.customerId}`);
    const customer = await response.json();
    setHistory((customer.activities || []).slice(0, 5));
  };
  const save = async (payload: any) => {
    setSaving(true); setError("");
    const response = await fetch(`/api/field-tech/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) { setError(data.error || "לא ניתן לשמור"); return; }
    setMessage(payload.status === "COMPLETED" ? "הקריאה נסגרה והלקוח עודכן" : "השינויים נשמרו"); setSelected(null); await load();
  };
  return <div className="max-w-2xl mx-auto space-y-4 pb-8" dir="rtl">
    <header className="card p-4 sticky top-2 z-10"><div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">טכנאי שטח</h1><p className="text-sm" style={{ color: "var(--muted)" }}>היום שלך, קריאה אחרי קריאה</p></div><input aria-label="תאריך" className="input-field" style={{ width: 150 }} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><div className="mt-4"><div className="flex justify-between text-sm mb-1"><span>{completed} מתוך {calls.length} קריאות הושלמו</span><strong>{progress}%</strong></div><div className="h-3 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: "linear-gradient(90deg,var(--teal),var(--blue))" }} /></div></div></header>
    {message && <div className="p-3 rounded" style={{ background: "#e8f5e9", color: "#2e7d32" }}>{message}</div>}
    {error && <div className="p-3 rounded" style={{ background: "#ffebee", color: "#b71c1c" }}>{error}</div>}
    {!calls.length && <div className="card p-8 text-center" style={{ color: "var(--muted)" }}>אין קריאות מתוזמנות לתאריך זה</div>}
    <div className="space-y-3">{calls.map((call, index) => <article key={call.id} className="card p-4" style={{ borderRight: `5px solid ${call.status === "COMPLETED" ? "var(--teal)" : "var(--rust)"}` }}><div className="flex gap-3"><div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white" style={{ background: call.status === "COMPLETED" ? "var(--teal)" : "var(--ink)" }}>{index + 1}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><h2 className="font-bold truncate">{call.customer?.name}</h2><span className="badge" style={{ background: call.status === "COMPLETED" ? "#e2faf3" : "#fff1df", color: call.status === "COMPLETED" ? "#087f6d" : "#c36b13" }}>{call.status === "COMPLETED" ? "הושלם" : labels[call.type] || call.type}</span></div><div className="text-sm mt-1">{call.scheduledAt ? new Date(call.scheduledAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "ללא שעה"} · {call.customer?.address || call.customer?.city || "כתובת חסרה"}</div><div className="text-sm mt-1" style={{ color: "var(--muted)" }}>{call.fault || call.description || "ביקור שירות"}</div></div></div><div className="grid grid-cols-4 gap-2 mt-4"><a className="btn-primary text-xs" href={`tel:${call.customer?.phone}`}>📞 חיוג</a><a className="btn-accent text-xs" target="_blank" rel="noreferrer" href={`https://waze.com/ul?q=${encodeURIComponent(call.customer?.address || call.customer?.city || "")}`}>🧭 Waze</a><a className="btn-primary text-xs" target="_blank" rel="noreferrer" href={`https://wa.me/${String(call.customer?.phone || "").replace(/\D/g, "")}`}>💬 WhatsApp</a><button className="btn-primary text-xs" onClick={() => openCall(call)}>פתיחה</button></div></article>)}</div>
    {selected && <Closeout call={selected} history={history} products={products} saving={saving} close={() => setSelected(null)} save={save} />}
  </div>;
}

function Closeout({ call, history, products, saving, close, save }: any) {
  const [notes, setNotes] = useState(call.treatmentNotes || "");
  const [pressure, setPressure] = useState(call.pressureReading || "");
  const [leakCheck, setLeakCheck] = useState<boolean | null>(call.leakCheck ?? null);
  const [checklist, setChecklist] = useState<any>(call.inspectionChecklist || {});
  const [beforePhotos, setBeforePhotos] = useState<string[]>(call.beforePhotos || []);
  const [afterPhotos, setAfterPhotos] = useState<string[]>(call.afterPhotos || []);
  const [parts, setParts] = useState<Part[]>(call.partsUsed || []);
  const [cycle, setCycle] = useState("6");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const speech = () => { const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!Recognition) return; const recognition = new Recognition(); recognition.lang = "he-IL"; recognition.onresult = (event: any) => setNotes((value: string) => `${value}${value ? " " : ""}${event.results[0][0].transcript}`); recognition.start(); };
  const photo = (files: FileList | null, setter: React.Dispatch<React.SetStateAction<string[]>>) => { if (!files) return; Array.from(files).forEach((file) => { const reader = new FileReader(); reader.onload = () => setter((items) => [...items, String(reader.result)]); reader.readAsDataURL(file); }); };
  const signStart = (e: React.PointerEvent) => { const canvas = canvasRef.current; if (!canvas) return; drawing.current = true; const rect = canvas.getBoundingClientRect(); const ctx = canvas.getContext("2d")!; ctx.beginPath(); ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top); };
  const signMove = (e: React.PointerEvent) => { if (!drawing.current) return; const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); const ctx = canvas.getContext("2d")!; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#16213e"; ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.stroke(); };
  const addPart = (item: any) => { if (!item) return; setParts((current) => [...current, { productId: item.productId, warehouseId: item.warehouseId, name: item.product.name, quantity: 1 }]); };
  const submit = (status: string) => save({ status, treatmentNotes: notes, pressureReading: pressure, leakCheck, inspectionChecklist: checklist, beforePhotos, afterPhotos, partsUsed: parts, signatureDataUrl: canvasRef.current?.toDataURL("image/png") || null, nextFilterChangeDate: status === "COMPLETED" && (call.type === "FILTER_CHANGE" || call.type === "MAINTENANCE") ? new Date(new Date().setMonth(new Date().getMonth() + Number(cycle))).toISOString() : undefined });
  return <div className="fixed inset-0 z-30 bg-black/40 p-2 overflow-y-auto"><section className="card max-w-2xl mx-auto p-4 space-y-4 mt-2"><div className="flex justify-between items-center"><div><h2 className="text-xl font-bold">סגירת {call.callNumber}</h2><p className="text-sm" style={{ color: "var(--muted)" }}>{call.customer?.name} · {call.customer?.phone}</p></div><button className="btn-primary" onClick={close}>סגור</button></div><div className="rounded-lg p-3" style={{ background: "#f5f7fb" }}><strong>Quick Glance</strong>{history.length ? history.map((x: any) => <div key={x.id} className="text-sm mt-1">{new Date(x.createdAt).toLocaleDateString("he-IL")} · {x.subject}</div>) : <div className="text-sm mt-1">אין היסטוריה זמינה</div>}</div><div className="grid grid-cols-2 gap-3"><label className="text-sm">לחץ / מדידה<input className="input-field" value={pressure} onChange={(e) => setPressure(e.target.value)} placeholder="לדוגמה 2.5 bar" /></label><label className="text-sm">מחזור הבא<select className="input-field" value={cycle} onChange={(e) => setCycle(e.target.value)}><option value="6">6 חודשים</option><option value="12">12 חודשים</option></select></label></div><div><div className="font-bold text-sm mb-2">בדיקת צ'קליסט</div><div className="grid grid-cols-2 gap-2 text-sm">{[["pressure", "לחצים תקינים"], ["leaks", "אין נזילות"], ["installation", "התקנה תקינה"], ["customerBriefed", "הלקוח תודרך"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 p-2 rounded border"><input type="checkbox" checked={Boolean(checklist[key])} onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })} />{label}</label>)}</div><div className="flex gap-2 mt-2"><button className={`btn-primary ${leakCheck === true ? "ring-2 ring-green-400" : ""}`} onClick={() => setLeakCheck(true)}>✓ אין נזילה</button><button className={`btn-danger ${leakCheck === false ? "ring-2 ring-red-400" : ""}`} onClick={() => setLeakCheck(false)}>✕ נמצאה נזילה</button></div></div><div><div className="font-bold text-sm mb-2">חלפים ממלאי הרכב</div><select className="input-field" onChange={(e) => { addPart(products.find((x: any) => `${x.productId}:${x.warehouseId}` === e.target.value)); e.currentTarget.value = ""; }}><option value="">הוסף חלף...</option>{products.filter((x: any) => x.product?.isActive).map((x: any) => <option key={`${x.productId}:${x.warehouseId}`} value={`${x.productId}:${x.warehouseId}`}>{x.product.name} · {x.warehouse.name} · זמין {x.quantityOnHand - x.quantityReserved}</option>)}</select>{parts.map((part, i) => <div key={`${part.productId}-${i}`} className="flex gap-2 items-center mt-2 text-sm"><span className="flex-1">{part.name}</span><input className="input-field" style={{ width: 90 }} type="number" min="1" value={part.quantity} onChange={(e) => setParts(parts.map((x, index) => index === i ? { ...x, quantity: Number(e.target.value) } : x))} /><button onClick={() => setParts(parts.filter((_, index) => index !== i))}>הסר</button></div>)}</div><div className="grid grid-cols-2 gap-3"><label className="text-sm">תמונות לפני<input className="input-field" type="file" accept="image/*" capture="environment" multiple onChange={(e) => photo(e.target.files, setBeforePhotos)} /></label><label className="text-sm">תמונות אחרי<input className="input-field" type="file" accept="image/*" capture="environment" multiple onChange={(e) => photo(e.target.files, setAfterPhotos)} /></label></div>{(beforePhotos.length || afterPhotos.length) ? <div className="flex gap-2 overflow-x-auto">{[...beforePhotos, ...afterPhotos].map((src, i) => <img key={i} src={src} alt="תיעוד" className="w-16 h-16 rounded object-cover" />)}</div> : null}<div><div className="flex justify-between items-center"><label className="font-bold text-sm">הערות ביצוע</label><button className="btn-primary text-xs" type="button" onClick={speech}>🎙 הכתבה</button></div><textarea className="input-field mt-2" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="מה בוצע, ממצאים והמלצות..." /></div><div><div className="font-bold text-sm mb-2">חתימת לקוח</div><canvas ref={canvasRef} width={600} height={160} className="w-full h-32 bg-white border rounded touch-none" onPointerDown={signStart} onPointerMove={signMove} onPointerUp={() => { drawing.current = false; }} /><button className="text-xs underline mt-1" onClick={() => canvasRef.current?.getContext("2d")?.clearRect(0, 0, 600, 160)}>נקה חתימה</button></div><div className="flex gap-2"><button className="btn-accent flex-1" disabled={saving} onClick={() => submit("COMPLETED")}>{saving ? "שומר..." : "סגור וסנכרן לקוח"}</button><button className="btn-primary" disabled={saving} onClick={() => submit("IN_PROGRESS")}>שמור להמשך</button></div></section></div>;
}



