"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    google?: any;
    __googleMapsLoading?: Promise<void>;
  }
}

type MapCustomer = {
  id: string;
  name: string;
  company?: string | null;
  city?: string | null;
  phone?: string | null;
  status: string;
  lat: number;
  lng: number;
  activeServiceCalls?: number;
};

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "", label: "הכל", color: "#172B4D" },
  { value: "ACTIVE", label: "פעיל", color: "#2E7D32" },
  { value: "PROSPECT", label: "פרוספקט", color: "#1E5AA8" },
  { value: "LEAD", label: "ליד", color: "#C45A2A" },
  { value: "CHURNED", label: "עזב", color: "#8A8275" },
];

function statusColor(status: string): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.color || "#8A8275";
}

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (window.__googleMapsLoading) return window.__googleMapsLoading;
  window.__googleMapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=he&region=IL`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
  return window.__googleMapsLoading;
}

export default function ServiceMapPage() {
  const [customers, setCustomers] = useState<MapCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/service-map", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        // תמיכה בשני פורמטים: { customers, counts } או מערך ישיר
        const list: MapCustomer[] = Array.isArray(data)
          ? data
          : data.customers || [];
        setCustomers(list);
        if (Array.isArray(data)) {
          const c: Record<string, number> = { all: list.length };
          list.forEach((x) => {
            c[x.status] = (c[x.status] || 0) + 1;
          });
          setCounts(c);
        } else {
          setCounts({ all: list.length, ...(data.counts || {}) });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "שגיאה בטעינת הנתונים");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      const matchStatus = !statusFilter || c.status === statusFilter;
      const matchQuery =
        !q ||
        `${c.name} ${c.company || ""} ${c.city || ""} ${c.phone || ""}`
          .toLowerCase()
          .includes(q);
      return matchStatus && matchQuery;
    });
  }, [customers, query, statusFilter]);

  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (!infoWindowRef.current) {
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }

    const bounds = new window.google.maps.LatLngBounds();

    visible.forEach((c) => {
      const marker = new window.google.maps.Marker({
        position: { lat: c.lat, lng: c.lng },
        map,
        title: c.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: statusColor(c.status),
          fillOpacity: 0.95,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
        },
      });

      marker.addListener("click", () => {
        const info = infoWindowRef.current;
        if (!info) return;
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
        const wazeLink = `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`;
        info.setContent(
          `<div dir="rtl" style="font-family:inherit;min-width:200px">` +
            `<div style="font-weight:700;font-size:14px">${c.name}</div>` +
            (c.company ? `<div>${c.company}</div>` : "") +
            `<div style="margin-top:4px;color:${statusColor(c.status)};font-weight:600">${statusLabel(c.status)}</div>` +
            (c.city ? `<div>${c.city}</div>` : "") +
            (c.phone ? `<div dir="ltr">${c.phone}</div>` : "") +
            (c.activeServiceCalls ? `<div>קריאות פעילות: ${c.activeServiceCalls}</div>` : "") +
            `<div style="margin-top:6px"><a href="${mapsLink}" target="_blank">Google Maps</a> · ` +
            `<a href="${wazeLink}" target="_blank">Waze</a></div>` +
            `</div>`
        );
        info.open(map, marker);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat: c.lat, lng: c.lng });
    });

    if (visible.length > 1) {
      map.fitBounds(bounds, 60);
    } else if (visible.length === 1) {
      map.setCenter({ lat: visible[0].lat, lng: visible[0].lng });
      map.setZoom(14);
    }
  }, [visible]);

  useEffect(() => {
    if (loading || error) return;
    if (!apiKey) {
      setError("חסר מפתח Google Maps. הגדר NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ובצע Redeploy.");
      return;
    }
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!containerRef.current || mapRef.current) return;
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: { lat: 32.0853, lng: 34.7818 },
          zoom: 8,
          language: "he",
          disableDefaultUI: false,
        });
        renderMarkers();
      })
      .catch(() => {
        setError("נכשלה טעינת מפות Google. בדוק את המפתח, הפעלת Maps JavaScript API והגבלת הדומיין.");
      });
  }, [loading, error, apiKey, renderMarkers]);

  useEffect(() => {
    renderMarkers();
  }, [visible, renderMarkers]);

  if (loading) {
    return (
      <div className="p-6" dir="rtl">
        <p style={{ color: "var(--muted, #8A8275)" }}>טוען מפת שירות…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6" dir="rtl">
        <div
          className="rounded-lg p-4"
          style={{ background: "#FDECEC", border: "1px solid #F5C6C6" }}
        >
          <p style={{ color: "#8A2B2B", fontWeight: 600 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold" style={{ color: "var(--ink, #172B4D)" }}>
          מפת שירות
        </h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לקוח, עיר או טלפון…"
          className="rounded-md px-3 py-2 text-sm w-64"
          style={{
            border: "1px solid var(--border, #E0D9C8)",
            background: "#fff",
            color: "var(--ink, #172B4D)",
          }}
        />
      </div>

      {/* כפתורי סינון לפי סטטוס */}
      <div className="flex gap-2 flex-wrap items-center">
        {STATUS_OPTIONS.map(({ value, label, color }) => {
          const selected = statusFilter === value;
          return (
            <button
              key={value || "all"}
              onClick={() => setStatusFilter(value)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                background: selected ? color : "transparent",
                color: selected ? "#fff" : "var(--muted, #8A8275)",
                border: `1px solid ${selected ? color : "var(--border, #E0D9C8)"}`,
              }}
            >
              {label}
              <span
                className="mr-1.5 text-xs"
                style={{ opacity: 0.85 }}
                dir="ltr"
              >
                {value ? counts[value] ?? 0 : counts.all ?? customers.length}
              </span>
            </button>
          );
        })}
        <span className="text-xs" style={{ color: "var(--muted, #8A8275)" }}>
          מוצגים {visible.length} לקוחות מתוך {customers.length}
        </span>
      </div>

      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ height: "70vh", minHeight: 420, border: "1px solid var(--border, #E0D9C8)" }}
      />

      <div className="flex gap-4 flex-wrap text-xs" style={{ color: "var(--muted, #8A8275)" }}>
        {STATUS_OPTIONS.filter((o) => o.value).map(({ value, label, color }) => (
          <span key={value} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: color }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}


