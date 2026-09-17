"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

declare global { interface Window { google: any; initShiSacharMap?: () => void; } }

const statusColors: Record<string, string> = { ACTIVE: "#2e7d32", PROSPECT: "#1565c0", LEAD: "#ef6c00", CHURNED: "#757575" };
const statusLabels: Record<string, string> = { ACTIVE: "פעיל", PROSPECT: "פרוספקט", LEAD: "ליד", CHURNED: "עזב" };
const statusOptions = [
  { value: "", label: "הכל" },
  { value: "ACTIVE", label: "פעיל" },
  { value: "PROSPECT", label: "פרוספקט" },
  { value: "LEAD", label: "ליד" },
  { value: "CHURNED", label: "עזב" },
];

export default function ServiceMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/service-map").then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "לא ניתן לטעון נתוני מפה"); return d; }).then((d) => setCustomers(d.customers || [])).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) { setError("חסר NEXT_PUBLIC_GOOGLE_MAPS_API_KEY בקובץ .env"); return; }
    if (window.google?.maps) { setReady(true); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) { existing.addEventListener("load", () => setReady(true)); return; }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.onload = () => setReady(true);
    script.onerror = () => setError("טעינת Google Maps נכשלה. בדוק את המפתח וההרשאות ב-Google Cloud.");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const center = { lat: 31.9, lng: 34.8 };
    mapInstance.current = new window.google.maps.Map(mapRef.current, { center, zoom: 8, mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
  }, [ready]);

  useEffect(() => {
    if (!mapInstance.current || !window.google?.maps) return;
    markers.current.forEach((m) => m.setMap(null)); markers.current = [];
    const visible = customers.filter((c) => {
      const matchesStatus = !statusFilter || c.status === statusFilter;
      const matchesQuery =
        !query ||
        `${c.name} ${c.company || ""} ${c.city || ""}`
          .toLowerCase()
          .includes(query.toLowerCase());
      return matchesStatus && matchesQuery;
    });
    visible.forEach((c) => {
      const marker = new window.google.maps.Marker({ map: mapInstance.current, position: { lat: Number(c.lat), lng: Number(c.lng) }, title: c.name, icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: statusColors[c.status] || "#777", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      marker.addListener("click", () => setSelected(c)); markers.current.push(marker);
    });
    if (visible.length) { const bounds = new window.google.maps.LatLngBounds(); visible.forEach((c) => bounds.extend({ lat: Number(c.lat), lng: Number(c.lng) })); mapInstance.current.fitBounds(bounds); }
  }, [customers, query, statusFilter, ready]);

  return <div className="space-y-4"><div className="flex justify-between items-center"><div><h1 className="text-2xl font-bold">מפת שירות</h1><p className="text-sm" style={{ color: "var(--muted)" }}>לקוחות, קריאות שירות וניווט</p></div><Link href="/service-calendar" className="btn-primary">יומן שירות</Link></div>{error && <div className="p-3 rounded" style={{ background: "#fff3e0", color: "#bf360c" }}>{error}</div>}<div className="flex flex-col gap-3"><div className="flex gap-3 flex-wrap items-center"><input className="input-field" placeholder="חיפוש לקוח או עיר" value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 320 }} /><span className="text-sm" style={{ color: "var(--muted)" }}>{customers.length} לקוחות עם מיקום</span></div><div className="flex gap-2 flex-wrap items-center" role="group" aria-label="סינון לפי סטטוס לקוח"><span className="text-sm font-medium">סטטוס:</span>{statusOptions.map((option) => { const active = statusFilter === option.value; return <button key={option.value || "all"} type="button" onClick={() => setStatusFilter(option.value)} aria-pressed={active} className="px-3 py-1.5 rounded-full text-sm transition-colors" style={{ background: active ? (option.value ? statusColors[option.value] : "var(--ink)") : "transparent", color: active ? "#fff" : "var(--ink)", border: "1px solid var(--border)" }}>{option.label}</button>; })}</div></div><div className="grid grid-cols-1 lg:grid-cols-4 gap-4"><div className="card p-4 lg:col-span-1"><h2 className="font-bold mb-3">מקרא</h2>{Object.entries(statusLabels).map(([k, v]) => <div key={k} className="flex items-center gap-2 text-sm mb-2"><span className="w-3 h-3 rounded-full" style={{ background: statusColors[k] }} />{v}</div>)}<p className="text-xs mt-4" style={{ color: "var(--muted)" }}>הצבעים מייצגים את סטטוס הלקוח. קריאות פעילות יוצגו בכרטיס המידע.</p></div><div className="card overflow-hidden lg:col-span-3" style={{ minHeight: 560 }}><div ref={mapRef} style={{ width: "100%", height: 560, background: "#e8eef3" }}>{!ready && !error && <div className="p-8 text-center">טוען את Google Maps...</div>}</div></div></div>{selected && <div className="card p-5"><div className="flex justify-between"><div><h2 className="text-xl font-bold">{selected.name}</h2><p style={{ color: "var(--muted)" }}>{selected.company || ""} · {selected.city || ""} · {selected.phone}</p></div><button onClick={() => setSelected(null)} className="btn-primary">סגור</button></div><div className="flex gap-2 mt-4"><Link href={`/customers/${selected.id}`} className="btn-primary">פתח כרטיס לקוח</Link><a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer" className="btn-primary">Google Maps</a><a href={`https://waze.com/ul?ll=${selected.lat}%2C${selected.lng}&navigate=yes`} target="_blank" rel="noreferrer" className="btn-accent">Waze</a></div>{selected.serviceCalls?.length > 0 && <div className="mt-4 text-sm"><strong>קריאות פעילות:</strong> {selected.serviceCalls.map((s: any) => `${s.callNumber} (${s.type})`).join(" · ")}</div>}</div>}</div>;
}








