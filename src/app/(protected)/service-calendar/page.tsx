"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ExportBar from "@/components/ExportBar";

const regionByCity: Record<string, string> = {
  "חיפה": "צפון", "קריית שמונה": "צפון", "עכו": "צפון", "נהריה": "צפון", "טבריה": "צפון", "נצרת": "צפון",
  "תל אביב": "מרכז", "רמת גן": "מרכז", "גבעתיים": "מרכז", "פתח תקווה": "מרכז", "ראש העין": "מרכז", "הרצליה": "מרכז", "נתניה": "מרכז", "כפר סבא": "מרכז", "רעננה": "מרכז", "רחובות": "מרכז", "ראשון לציון": "מרכז", "בת ים": "מרכז", "חולון": "מרכז", "אשדוד": "מרכז", "אשקלון": "מרכז",
  "ירושלים": "ירושלים", "בית שמש": "ירושלים", "מבשרת ציון": "ירושלים",
  "באר שבע": "דרום", "אילת": "דרום", "דימונה": "דרום", "קריית גת": "דרום",
};
const colors: Record<string, string> = { TECHNICIAN_SERVICE: "#C45A2A", FILTER_REPLACEMENT: "#3F7CAC", INSTALLATION: "#2E7D32", FILTER_CHANGE: "#F9A825", REPAIR: "#C62828", MAINTENANCE: "#C45A2A" };
const kindLabel: Record<string, string> = { TECHNICIAN_SERVICE: "שירות טכנאי", FILTER_REPLACEMENT: "החלפת סננים", INSTALLATION: "התקנה", FILTER_CHANGE: "החלפת סנן", REPAIR: "תיקון", MAINTENANCE: "תחזוקה" };
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function monthStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function eventRegion(event: any) { return event.region || regionByCity[String(event.customer?.city || "").trim()] || "אחר"; }
function eventTechnician(event: any) { return event.technician?.name || event.manualTechnicianName || "טרם שובץ"; }

export default function ServiceCalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [backlog, setBacklog] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [view, setView] = useState<"day" | "week" | "month" | "map">("month");
  const [cursor, setCursor] = useState(monthStart(new Date()));
  const [kind, setKind] = useState("ALL");
  const [region, setRegion] = useState("ALL");
  const [city, setCity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);

  useEffect(() => {
    Promise.all([fetch("/api/service-calendar").then((r) => r.json()), fetch("/api/service-tasks").then((r) => r.json())]).then(([calendar, tasks]) => {
      setEvents(calendar.events || []); setBacklog(tasks.tasks || []); setTechnicians(tasks.technicians || []);
    });
  }, []);

  const options = useMemo(() => ({
    cities: Array.from(new Set(events.map((e) => e.customer?.city).filter(Boolean))).sort(),
    statuses: Array.from(new Set(events.map((e) => e.status).filter(Boolean))).sort(),
  }), [events]);

  const filtered = useMemo(() => events.filter((event) => {
    const eventCity = event.customer?.city || "";
    const techId = event.technicianId || "UNASSIGNED";
    return (kind === "ALL" || event.kind === kind) && (region === "ALL" || eventRegion(event) === region) && (city === "ALL" || eventCity === city) && (status === "ALL" || event.status === status) && (!selectedTechs.length || selectedTechs.includes(techId));
  }), [events, kind, region, city, status, selectedTechs]);

  const mapEvents = useMemo(() => filtered.filter((e) => Number.isFinite(Number(e.customer?.lat)) && Number.isFinite(Number(e.customer?.lng))), [filtered]);
  const byDay = useMemo(() => filtered.reduce((acc: Record<string, any[]>, event) => { const key = dayKey(new Date(event.start)); (acc[key] ||= []).push(event); return acc; }, {}), [filtered]);
  const cells = useMemo(() => { const first = monthStart(cursor); const start = new Date(first); start.setDate(1 - first.getDay()); return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; }); }, [cursor]);
  const weekDays = useMemo(() => { const d = new Date(cursor); d.setDate(d.getDate() - d.getDay()); return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; }); }, [cursor]);
  const dayEvents = byDay[dayKey(cursor)] || [];

  useEffect(() => {
    if (view !== "map" || !mapRef.current) return;
    const init = () => {
      const google = (window as any).google;
      if (!google?.maps || !mapRef.current) return;
      mapInstance.current ||= new google.maps.Map(mapRef.current, { center: { lat: 31.8, lng: 34.9 }, zoom: 8, mapTypeControl: false, streetViewControl: false });
      markers.current.forEach((marker) => marker.setMap(null)); markers.current = [];
      const bounds = new google.maps.LatLngBounds();
      mapEvents.forEach((event) => {
        const position = { lat: Number(event.customer.lat), lng: Number(event.customer.lng) }; bounds.extend(position);
        const marker = new google.maps.Marker({ map: mapInstance.current, position, title: `${event.customer?.name || "לקוח"} — ${eventTechnician(event)}`, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: colors[event.kind] || "#607D8B", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
        marker.addListener("click", () => setSelected(event)); markers.current.push(marker);
      });
      if (mapEvents.length) mapInstance.current.fitBounds(bounds);
    };
    const google = (window as any).google;
    if (google?.maps) init(); else { const script = document.createElement("script"); script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`; script.async = true; script.onload = init; document.head.appendChild(script); }
    return () => { markers.current.forEach((marker) => marker.setMap(null)); markers.current = []; };
  }, [view, mapEvents]);

  const toggleTech = (id: string) => setSelectedTechs((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  const move = (amount: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + amount));
  const title = view === "day" ? cursor.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : cursor.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const exportData = filtered.map((e) => ({ ...e, customerName: e.customer?.name || "", technicianName: eventTechnician(e), regionName: eventRegion(e), startFormatted: new Date(e.start).toLocaleString("he-IL") }));

  return <div className="space-y-4" dir="rtl">
    <div className="flex flex-wrap justify-between gap-3 items-center"><div><h1 className="text-2xl font-bold">מרכז שירות: יומן + מפה</h1><p className="text-sm" style={{ color: "var(--muted)" }}>שירות, התקנות, החלפות סננים ופריסת טכנאים במסך אחד</p></div><div className="flex gap-2 items-center"><button className="btn-primary" onClick={() => setCursor(new Date())}>היום</button><button className="btn-primary" onClick={() => move(view === "day" ? -1 : view === "week" ? -7 : -30)}>‹</button><strong className="px-2">{title}</strong><button className="btn-primary" onClick={() => move(view === "day" ? 1 : view === "week" ? 7 : 30)}>›</button></div></div>
    <ExportBar title="מרכז שירות" data={exportData} columns={[{ header: "אירוע", key: "title" }, { header: "לקוח", key: "customerName" }, { header: "טכנאי", key: "technicianName" }, { header: "אזור", key: "regionName" }, { header: "מועד", key: "startFormatted" }]} printableId="service-calendar-printable-table" />
    <div className="card p-3 space-y-3"><div className="flex flex-wrap gap-2 items-center"><div className="flex rounded border overflow-hidden"><button className="px-3 py-2 text-sm" onClick={() => setView("day")} style={{ background: view === "day" ? "var(--ink)" : "white", color: view === "day" ? "white" : "var(--ink)" }}>יום</button><button className="px-3 py-2 text-sm" onClick={() => setView("week")} style={{ background: view === "week" ? "var(--ink)" : "white", color: view === "week" ? "white" : "var(--ink)" }}>שבוע</button><button className="px-3 py-2 text-sm" onClick={() => setView("month")} style={{ background: view === "month" ? "var(--ink)" : "white", color: view === "month" ? "white" : "var(--ink)" }}>חודש</button><button className="px-3 py-2 text-sm" onClick={() => setView("map")} style={{ background: view === "map" ? "var(--ink)" : "white", color: view === "map" ? "white" : "var(--ink)" }}>מפה</button></div><select className="input-field" value={kind} onChange={(e) => setKind(e.target.value)}><option value="ALL">כל סוגי הפעילות</option>{Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="text-sm" style={{ color: "var(--muted)" }}>{filtered.length} אירועים · {mapEvents.length} עם מיקום</span></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2"><select className="input-field" value={region} onChange={(e) => setRegion(e.target.value)}><option value="ALL">כל האזורים</option>{["צפון", "מרכז", "ירושלים", "דרום", "אחר"].map((x) => <option key={x}>{x}</option>)}</select><select className="input-field" value={city} onChange={(e) => setCity(e.target.value)}><option value="ALL">כל הערים</option>{options.cities.map((x: any) => <option key={x}>{x}</option>)}</select><select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">כל הסטטוסים</option>{options.statuses.map((x: any) => <option key={x}>{x}</option>)}</select><button className="btn-secondary" onClick={() => { setKind("ALL"); setRegion("ALL"); setCity("ALL"); setStatus("ALL"); setSelectedTechs([]); }}>נקה סינון</button></div><div className="flex flex-wrap gap-2 items-center"><span className="text-sm font-bold">טכנאים:</span>{technicians.map((tech) => <button key={tech.id} onClick={() => toggleTech(tech.id)} className="px-3 py-1 rounded-full border text-sm" style={{ borderColor: selectedTechs.includes(tech.id) ? "var(--rust)" : "var(--border)", background: selectedTechs.includes(tech.id) ? "#fff1ec" : "white" }}>{tech.name}</button>)}<button onClick={() => setSelectedTechs((selectedTechs.length === technicians.length ? [] : technicians.map((t) => t.id)))} className="text-sm underline">{selectedTechs.length === technicians.length ? "בטל בחירת טכנאים" : "בחר את כולם"}</button></div></div>
    {view === "map" ? <div className="card overflow-hidden"><div ref={mapRef} className="h-[560px] w-full bg-slate-100 flex items-center justify-center" />{!mapEvents.length && <div className="p-3 text-sm" style={{ color: "var(--muted)" }}>אין אירועים מסוננים עם קואורדינטות להצגה במפה.</div>}</div> : view === "month" ? <div id="service-calendar-printable-table" className="card p-3"><div className="grid grid-cols-7 border-b">{["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((d) => <div key={d} className="p-2 text-sm font-bold text-center">{d}</div>)}</div><div className="grid grid-cols-7">{cells.map((date) => <div key={dayKey(date)} className="min-h-28 border-b border-l p-2" style={{ opacity: date.getMonth() === cursor.getMonth() ? 1 : .4 }}><div className="text-xs font-bold mb-1">{date.getDate()}</div>{(byDay[dayKey(date)] || []).slice(0, 4).map((event) => <button key={event.id} onClick={() => setSelected(event)} className="block w-full text-right text-xs truncate rounded px-1 py-1 mb-1" style={{ background: `${colors[event.kind] || "#607D8B"}18`, color: colors[event.kind] || "#607D8B", borderRight: `3px solid ${colors[event.kind] || "#607D8B"}` }}>{new Date(event.start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} {event.title}</button>)}</div>)}</div></div> : <div className="grid grid-cols-1 md:grid-cols-7 gap-2">{(view === "day" ? [cursor] : weekDays).map((date) => <div key={dayKey(date)} className="card p-3 min-h-64"><div className="font-bold border-b pb-2 mb-2">{date.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "short" })}</div>{(byDay[dayKey(date)] || (view === "day" ? dayEvents : [])).map((event) => <button key={event.id} onClick={() => setSelected(event)} className="block w-full text-right text-sm rounded p-2 mb-2" style={{ background: `${colors[event.kind] || "#607D8B"}18`, borderRight: `4px solid ${colors[event.kind] || "#607D8B"}` }}><b>{new Date(event.start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} · {event.title}</b><div>{event.customer?.name} · {eventTechnician(event)}</div></button>)}</div>)}</div>}
    <div className="card p-4"><div className="flex justify-between items-center"><h2 className="font-bold">משימות שטרם שובצו</h2><span className="text-sm" style={{ color: "var(--muted)" }}>{backlog.filter((x) => !x.technicianId && !x.manualTechnicianName && ["OPEN", "SCHEDULED"].includes(x.status)).length} ממתינות</span></div><div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">{backlog.filter((x) => !x.technicianId && !x.manualTechnicianName && ["OPEN", "SCHEDULED"].includes(x.status)).slice(0, 6).map((task) => <div key={task.id} className="border rounded p-3 text-sm"><b>{task.title}</b><div>{task.customer?.name} · {task.customer?.city || "ללא עיר"}</div><div className="mt-1" style={{ color: "var(--muted)" }}>{task.type === "INSTALLATION" ? "התקנה" : task.type === "FILTER_REPLACEMENT" ? "החלפת סננים" : "שירות"}</div></div>)}</div></div>
    {selected && <div className="card p-5"><div className="flex justify-between"><h2 className="font-bold">{selected.title}</h2><button className="btn-secondary" onClick={() => setSelected(null)}>סגור</button></div><p className="text-sm mt-2">לקוח: {selected.customer?.name || "—"} · {selected.customer?.city || selected.customer?.address || "—"}</p><p className="text-sm">טכנאי: {eventTechnician(selected)} · אזור: {eventRegion(selected)} · מועד: {new Date(selected.start).toLocaleString("he-IL")}</p>{selected.customer?.lat && selected.customer?.lng && <a className="text-sm underline" style={{ color: "var(--rust)" }} href={`https://www.google.com/maps/dir/?api=1&destination=${selected.customer.lat},${selected.customer.lng}`} target="_blank">פתח ניווט</a>}</div>}
  </div>;
}

