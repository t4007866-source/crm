"use client";

import { useEffect, useMemo, useState } from "react";

const colors: Record<string, string> = {
  TECHNICIAN_SERVICE: "#C45A2A",
  FILTER_REPLACEMENT: "#3F7CAC",
  LEAD_SALES: "#6B5B95",
  INSTALLATION: "#2E7D32",
  FILTER_CHANGE: "#F9A825",
  REPAIR: "#C62828",
  MAINTENANCE: "#C45A2A",
};

function monthStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function monthLabel(date: Date) { return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(date); }
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export default function ServiceCalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(monthStart(new Date()));
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => { fetch("/api/service-calendar").then((r) => r.json()).then((d) => setEvents(d.events || [])); }, []);

  const filtered = useMemo(() => filter === "ALL" ? events : events.filter((e) => e.kind === filter), [events, filter]);
  const byDay = useMemo(() => filtered.reduce((acc: Record<string, any[]>, event) => { const key = dayKey(new Date(event.start)); (acc[key] ||= []).push(event); return acc; }, {}), [filtered]);

  const cells = useMemo(() => {
    const first = monthStart(cursor);
    const start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  return <div className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3 items-center"><div><h1 className="text-2xl font-bold">יומן שירות והתקנות</h1><p className="text-sm" style={{ color: "var(--muted)" }}>יומן נפרד לשירות, התקנות והחלפת סננים</p></div><div className="flex gap-2"><button className="btn-primary" onClick={() => setCursor(monthStart(new Date()))}>היום</button><button className="btn-primary" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button><strong className="px-3 py-2">{monthLabel(cursor)}</strong><button className="btn-primary" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button></div></div>
    <div className="card p-3 flex flex-wrap gap-2 items-center"><div className="flex rounded border overflow-hidden" style={{ borderColor: "var(--border)" }}><button className="px-3 py-2 text-sm" style={{ background: view === "month" ? "var(--ink)" : "white", color: view === "month" ? "white" : "var(--ink)" }} onClick={() => setView("month")}>חודש</button><button className="px-3 py-2 text-sm" style={{ background: view === "week" ? "var(--ink)" : "white", color: view === "week" ? "white" : "var(--ink)" }} onClick={() => setView("week")}>שבוע</button></div><select className="input-field" style={{ width: 210 }} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="ALL">כל סוגי האירועים</option><option value="TECHNICIAN_SERVICE">שירות טכנאי</option><option value="FILTER_REPLACEMENT">החלפת סננים</option><option value="INSTALLATION">התקנה</option><option value="REPAIR">תיקון</option></select><span className="text-sm" style={{ color: "var(--muted)" }}>{filtered.length} אירועים</span></div>
    <div className="card p-3"><div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>{["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((d) => <div key={d} className="p-2 text-sm font-bold text-center">{d}</div>)}</div><div className="grid grid-cols-7">{cells.map((date) => { const key = dayKey(date); const outside = date.getMonth() !== cursor.getMonth(); return <div key={key} className="min-h-28 border-b border-l p-2" style={{ borderColor: "var(--border)", opacity: outside ? 0.45 : 1 }}><div className="text-xs font-bold mb-1">{date.getDate()}</div>{(byDay[key] || []).slice(0, 3).map((event) => <button key={event.id} onClick={() => setSelected(event)} className="block w-full text-right text-xs truncate rounded px-1 py-0.5 mb-1" style={{ background: `${colors[event.kind] || "#607D8B"}18`, color: colors[event.kind] || "#607D8B", borderRight: `3px solid ${colors[event.kind] || "#607D8B"}` }}>{new Date(event.start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} {event.title}</button>)}{(byDay[key] || []).length > 3 && <div className="text-xs" style={{ color: "var(--muted)" }}>+ עוד {(byDay[key] || []).length - 3}</div>}</div>; })}</div></div>
    {selected && <div className="card p-5"><div className="flex justify-between"><h2 className="font-bold">{selected.title}</h2><button onClick={() => setSelected(null)}>סגור</button></div><p className="text-sm mt-2">לקוח: {selected.customer?.name || "—"} · {selected.customer?.address || selected.customer?.city || "—"}</p><p className="text-sm">מועד: {new Date(selected.start).toLocaleString("he-IL")} · סטטוס: {selected.status}</p><a className="text-sm underline" style={{ color: "var(--rust)" }} href={selected.customer?.lat && selected.customer?.lng ? `https://www.google.com/maps/dir/?api=1&destination=${selected.customer.lat},${selected.customer.lng}` : "#"} target="_blank">פתח ניווט</a></div>}
  </div>;
}

