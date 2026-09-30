"use client";

import { use, useEffect, useState } from "react";

const roleLabels: Record<string, string> = { ADMIN: "מנהל מערכת", MANAGER: "מנהל", SALES_REP: "נציג מכירות", CUSTOMER_SERVICE: "שירות לקוחות", DISPATCHER: "שיבוץ שירות", TECHNICIAN: "טכנאי", VIEWER: "צופה" };
const actionLabels: Record<string, string> = { CREATE_USER: "יצירת משתמש", UPDATE_USER: "עדכון משתמש", UPDATE_USER_PERMISSIONS: "עדכון הרשאות", APPROVE_USER: "אישור משתמש", RESET_USER_PASSWORD: "איפוס סיסמה", DELETE_USER_SOFT: "השבתה בטוחה" };

type Profile = { id: string; name: string; email: string; phone?: string | null; role: string; isActive: boolean; isBlocked: boolean; emailVerified?: string | null; inviteExpiresAt?: string | null; lastLoginAt?: string | null; createdAt: string; updatedAt: string; permissions?: Record<string, string[]>; auditLogs: any[]; assignedTasks: any[]; technicianAppointments: any[] };

function status(user: Profile) { if (user.isBlocked) return "חסום"; if (!user.emailVerified) return "ממתין לאישור"; return user.isActive ? "פעיל" : "מושבת"; }
function date(value?: string | null) { return value ? new Date(value).toLocaleString("he-IL") : "—"; }

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("details");

  useEffect(() => { fetch(`/api/users/${id}`, { cache: "no-store" }).then(async (r) => { const json = await r.json(); if (!r.ok) throw new Error(json.error || "לא ניתן לטעון פרופיל"); setUser(json.user); }).catch((e) => setError(e.message)); }, [id]);

  if (error) return <div className="card p-6" dir="rtl"><h1 className="text-xl font-bold">שגיאה</h1><p className="mt-2">{error}</p></div>;
  if (!user) return <div className="p-8 text-center" dir="rtl">טוען פרופיל...</div>;

  return <div className="space-y-4" dir="rtl">
    <div className="flex items-center justify-between gap-4"><div><a href="/users" className="text-sm underline">← חזרה לניהול משתמשים</a><h1 className="text-2xl font-bold mt-2">{user.name}</h1><p style={{ color: "var(--muted)" }}>{user.email} · {roleLabels[user.role] || user.role}</p></div><span className="px-3 py-2 rounded" style={{ background: user.isBlocked ? "#ffebee" : user.isActive ? "#e8f5e9" : "#f4f0e8" }}>{status(user)}</span></div>
    <div className="card p-2 flex gap-2 flex-wrap">{[["details", "פרטים אישיים"], ["permissions", "תפקידים והרשאות"], ["activity", "פעילות"], ["tasks", "משימות"], ["calendar", "יומן"], ["security", "התחברויות ואבטחה"]].map(([value, label]) => <button key={value} className={tab === value ? "btn-primary" : "px-3 py-2 rounded"} onClick={() => setTab(value)}>{label}</button>)}</div>
    {tab === "details" && <div className="card p-5 grid md:grid-cols-3 gap-4"><div><b>שם מלא</b><p>{user.name}</p></div><div><b>אימייל</b><p>{user.email}</p></div><div><b>טלפון</b><p>{user.phone || "—"}</p></div><div><b>תפקיד</b><p>{roleLabels[user.role] || user.role}</p></div><div><b>סטטוס</b><p>{status(user)}</p></div><div><b>נוצר בתאריך</b><p>{date(user.createdAt)}</p></div><div><b>התחברות אחרונה</b><p>{date(user.lastLoginAt)}</p></div><div><b>אימות אימייל</b><p>{user.emailVerified ? date(user.emailVerified) : "טרם אומת"}</p></div><div><b>הזמנה בתוקף עד</b><p>{date(user.inviteExpiresAt)}</p></div></div>}
    {tab === "permissions" && <div className="card p-5"><h2 className="font-bold mb-3">הרשאות פעילות</h2>{Object.entries(user.permissions || {}).filter(([, actions]) => actions.length).map(([module, actions]) => <div key={module} className="border-b py-2"><b>{module}</b><span className="mr-3 text-sm">{actions.join(", ")}</span></div>)}{!Object.values(user.permissions || {}).some((x) => x.length) && <p>לא הוגדרו הרשאות מותאמות אישית.</p>}</div>}
    {tab === "activity" && <div className="card p-5"><h2 className="font-bold mb-3">פעילות ו-Audit Log</h2>{user.auditLogs.length ? <div className="space-y-3">{user.auditLogs.map((log) => <div key={log.id} className="border-b pb-2"><b>{actionLabels[log.action] || log.action}</b><span className="mr-3 text-sm" style={{ color: "var(--muted)" }}>{date(log.createdAt)}</span></div>)}</div> : <p>אין פעילות מתועדת.</p>}</div>}
    {tab === "tasks" && <div className="card p-5"><h2 className="font-bold mb-3">משימות שהוקצו</h2>{user.assignedTasks.length ? <div className="space-y-2">{user.assignedTasks.map((task) => <div key={task.id} className="border-b py-2"><b>{task.title || task.name || "משימה"}</b><span className="mr-3 text-sm">{task.status || ""}</span></div>)}</div> : <p>אין משימות.</p>}</div>}
    {tab === "calendar" && <div className="card p-5"><h2 className="font-bold mb-3">יומן טכנאי</h2>{user.technicianAppointments.length ? <div className="space-y-2">{user.technicianAppointments.map((item) => <div key={item.id} className="border-b py-2"><b>{item.title || item.type || "פגישה"}</b><span className="mr-3 text-sm">{date(item.startAtUtc || item.startsAt)}</span></div>)}</div> : <p>אין אירועים ביומן.</p>}</div>}
    {tab === "security" && <div className="card p-5"><h2 className="font-bold mb-3">התחברויות ואבטחה</h2><p>התחברות אחרונה: {date(user.lastLoginAt)}</p><p>מצב החשבון: {status(user)}</p><p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>תיעוד כתובת IP, מכשיר ו-Sessions יתווסף כאשר מנגנון ה-Sessions המלא יופעל.</p></div>}
  </div>;
}






