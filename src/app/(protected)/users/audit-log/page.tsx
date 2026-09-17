"use client";

import { useEffect, useState } from "react";

export default function UserAuditLogPage() {
  const [logs, setLogs] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/users/audit-log", { cache: "no-store" }).then(async (r) => { const json = await r.json(); if (!r.ok) throw new Error(json.error || "לא ניתן לטעון את היומן"); setLogs(json.logs); }).catch((e) => setError(e.message)); }, []);
  if (error) return <div className="card p-6" dir="rtl">{error}</div>;
  if (!logs) return <div className="p-8 text-center" dir="rtl">טוען יומן...</div>;
  return <div className="space-y-4" dir="rtl"><a href="/users" className="underline text-sm">← חזרה לניהול משתמשים</a><div><h1 className="text-2xl font-bold">יומן ביקורת — משתמשים</h1><p className="text-sm" style={{ color: "var(--muted)" }}>פעולות רגישות על משתמשים, ללא הצגת סיסמאות או Tokens.</p></div><div className="card overflow-auto"><table className="w-full text-sm min-w-[800px]"><thead><tr className="border-b"><th className="text-right p-3">תאריך</th><th className="text-right p-3">פעולה</th><th className="text-right p-3">מבצע</th><th className="text-right p-3">משתמש יעד</th></tr></thead><tbody>{logs.length ? logs.map((log) => <tr className="border-b" key={log.id}><td className="p-3">{new Date(log.createdAt).toLocaleString("he-IL")}</td><td className="p-3">{log.action}</td><td className="p-3">{log.user?.name || log.user?.email || "—"}</td><td className="p-3">{log.entityId || "—"}</td></tr>) : <tr><td colSpan={4} className="p-6 text-center">אין רשומות.</td></tr>}</tbody></table></div></div>;
}

