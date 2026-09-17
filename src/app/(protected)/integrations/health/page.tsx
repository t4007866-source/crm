"use client";

import { useEffect, useState } from "react";

const text: Record<string, string> = { OK: "תקין", WARNING: "אזהרה", ERROR: "תקלה" };
const color: Record<string, string> = { OK: "#087f6d", WARNING: "#a66b00", ERROR: "#b42318" };

export default function IntegrationHealthPage() {
  const [checks, setChecks] = useState<any[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/integrations/health", { cache: "no-store" }).then((r) => r.json()).then((d) => setChecks(d.checks || [])).catch(() => setError("לא ניתן לטעון נתוני בריאות")); }, []);
  return <div dir="rtl" className="space-y-5"><div><h1 className="text-2xl font-bold">בריאות האינטגרציות</h1><p className="text-sm" style={{ color: "var(--muted)" }}>זמינות, זמן תגובה, שגיאות ובדיקות חיבור</p></div>{error && <div className="p-3 rounded" style={{ background: "#ffebee", color: "#b42318" }}>{error}</div>}<section className="card p-5"><div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5"><div className="rounded p-4" style={{ background: "#e2faf3" }}><div className="text-sm">בדיקות תקינות</div><div className="text-2xl font-bold">{checks.filter((x) => x.status === "OK").length}</div></div><div className="rounded p-4" style={{ background: "#fff5d8" }}><div className="text-sm">אזהרות</div><div className="text-2xl font-bold">{checks.filter((x) => x.status === "WARNING").length}</div></div><div className="rounded p-4" style={{ background: "#ffebee" }}><div className="text-sm">תקלות</div><div className="text-2xl font-bold">{checks.filter((x) => x.status === "ERROR").length}</div></div></div>{checks.length ? <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-right">ספק</th><th className="p-2 text-right">סטטוס</th><th className="p-2 text-right">זמן תגובה</th><th className="p-2 text-right">הודעה</th><th className="p-2 text-right">נבדק</th></tr></thead><tbody>{checks.map((item) => <tr className="border-b" key={item.id}><td className="p-2">{item.provider}</td><td className="p-2 font-bold" style={{ color: color[item.status] || "var(--ink)" }}>{text[item.status] || item.status}</td><td className="p-2">{item.responseMs ? `${item.responseMs}ms` : "—"}</td><td className="p-2">{item.message || "—"}</td><td className="p-2">{new Date(item.checkedAt).toLocaleString("he-IL")}</td></tr>)}</tbody></table></div> : <p style={{ color: "var(--muted)" }}>עדיין לא בוצעו בדיקות חיבור.</p>}</section></div>;
}

