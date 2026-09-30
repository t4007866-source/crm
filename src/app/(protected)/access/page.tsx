"use client";
import { useEffect, useMemo, useState } from "react";

const labels: Record<string, string> = { dashboard: "לוח בקרה", customers: "לקוחות", orders: "הזמנות", inventory: "מלאי ושירותים", serviceCalendar: "יומן שירות והתקנות", serviceMap: "מפת שירות", fieldTech: "טכנאים", tasks: "משימות", leads: "לידים נכנסים", automations: "אוטומציות", integrations: "אינטגרציות ו-API", reports: "דוחות", ai: "עוזר AI", access: "הרשאות וגישה", users: "ניהול משתמשים", whatsapp: "WhatsApp" };
const actionLabels: Record<string, string> = { view: "צפייה", create: "יצירה", edit: "עריכה", delete: "מחיקה", export: "ייצוא", approve: "אישור", assign: "הקצאה", convert: "המרה", pause: "השהיה", manage: "ניהול", view_sensitive: "מידע רגיש", send_manual: "שליחה ידנית", send_automated: "שליחה אוטומטית", approve_template: "אישור תבנית" };
const scopeLabels: Record<string, string> = { ALL: "כל הנתונים", ASSIGNED: "רק נתונים שהוקצו", CREATED_BY: "נתונים שיצר", BRANCH: "נתוני הסניף", AREA: "נתוני האזור", TEAM: "נתוני הצוות" };
type PermissionMap = Record<string, string[]>;
type RolePermission = { key: string; actions: string[]; scope: string };

function normalizePermissions(raw: unknown): PermissionMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: PermissionMap = {};
  for (const [module, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) result[module] = value.filter((x): x is string => typeof x === "string");
    else if (value && typeof value === "object") result[module] = Object.entries(value as Record<string, unknown>).filter(([, enabled]) => enabled === true).map(([action]) => action);
  }
  return result;
}

export default function AccessPage() {
  const [data, setData] = useState<any>(null);
  const [userId, setUserId] = useState("");
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState<any>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");

  const loadAdvanced = () => fetch("/api/access/roles").then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "לא ניתן לטעון תפקידים"); return d; }).then(setAdvanced).catch((e) => setError(e.message));
  useEffect(() => {
    fetch("/api/access").then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "לא ניתן לטעון הרשאות"); return d; }).then((d) => { setData(d); if (d.users?.[0]) selectUser(d.users[0], d); }).catch((e) => setError(e.message));
    loadAdvanced();
  }, []);

  const selectUser = (user: any, source = data) => { if (!user) return; const custom = normalizePermissions(user.permissions); setUserId(user.id); setPermissions(Object.keys(custom).length ? custom : normalizePermissions(source?.roles?.[user.role])); };
  const toggle = (module: string, action: string) => { const current = permissions[module] || []; setPermissions({ ...permissions, [module]: current.includes(action) ? current.filter((x) => x !== action) : [...current, action] }); };
  const save = async () => { const r = await fetch("/api/access", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, permissions }) }); const d = await r.json(); setMessage(r.ok ? "ההרשאות נשמרו" : d.error || "שגיאה בשמירה"); };

  const upsertRolePermission = (key: string, action: string, scope = "ALL") => {
    setRolePermissions((current) => { const existing = current.find((p) => p.key === key); if (!existing) return [...current, { key, actions: [action], scope }]; const actions = existing.actions.includes(action) ? existing.actions.filter((a) => a !== action) : [...existing.actions, action]; return actions.length ? current.map((p) => p.key === key ? { ...p, actions } : p) : current.filter((p) => p.key !== key); });
  };
  const createRole = async () => { const r = await fetch("/api/access/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: roleName, description: roleDescription, permissions: rolePermissions }) }); const d = await r.json(); if (!r.ok) return setMessage(d.error || "שגיאה ביצירת תפקיד"); setMessage("התפקיד נוצר"); setRoleName(""); setRoleDescription(""); setRolePermissions([]); loadAdvanced(); };
  const assignRole = async () => { const r = await fetch("/api/access/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "assign", userId: assignUserId, customRoleId: assignRoleId }) }); const d = await r.json(); setMessage(r.ok ? "התפקיד הוקצה למשתמש" : d.error || "שגיאה בהקצאה"); loadAdvanced(); };
  const selected = data?.users?.find((u: any) => u.id === userId);
  const selectedRole = advanced?.roles?.find((r: any) => r.id === selectedRoleId);
  const roleCatalog = useMemo(() => advanced?.catalog || [], [advanced]);

  if (error && !data) return <div className="card p-6"><h1 className="text-xl font-bold">שגיאה בטעינת הרשאות</h1><p className="mt-2">{error}</p></div>;
  if (!data) return <div className="p-8 text-center">טוען הרשאות...</div>;
  return <div className="space-y-6" dir="rtl">
    <div><h1 className="text-2xl font-bold">הרשאות וגישה</h1><p className="text-sm" style={{ color: "var(--muted)" }}>שכבת הרשאות תוספתית: ההרשאות והתפקידים הקיימים נשמרים ותפקידים חדשים מתווספים מעליהם.</p></div>
    {message && <div className="p-3 rounded" style={{ background: "#e8f5e9", color: "#2e7d32" }}>{message}</div>}
    <div className="card p-4"><h2 className="font-bold mb-3">הרשאות לפי פעולה — משתמש קיים</h2><label className="text-sm">בחר משתמש<select className="input-field max-w-md" value={userId} onChange={(e) => selectUser(data.users.find((u: any) => u.id === e.target.value))}>{data.users.map((u: any) => <option key={u.id} value={u.id}>{u.name} · {u.email} · {u.role}</option>)}</select></label><div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>תפקיד ברירת מחדל: {selected?.role} · הרשאות מותאמות גוברות על ברירת המחדל</div></div>
    <div className="card overflow-auto"><table className="w-full text-sm min-w-[900px]"><thead><tr className="border-b" style={{ borderColor: "var(--border)" }}><th className="text-right p-3">מודול</th>{data.actions.map((a: string) => <th key={a} className="p-3">{actionLabels[a] || a}</th>)}</tr></thead><tbody>{data.modules.map((m: string) => <tr key={m} className="border-b" style={{ borderColor: "var(--border)" }}><td className="p-3 font-medium">{labels[m] || m}</td>{data.actions.map((a: string) => <td key={a} className="text-center p-3"><input type="checkbox" checked={!!permissions[m]?.includes(a)} onChange={() => toggle(m, a)} /></td>)}</tr>)}</tbody></table></div><button onClick={save} className="btn-accent">שמור הרשאות משתמש</button>
    <div className="card p-5 space-y-4"><div><h2 className="text-xl font-bold">תפקידים מותאמים אישית</h2><p className="text-sm" style={{ color: "var(--muted)" }}>צור תפקיד נוסף בלי לשנות את ADMIN, MANAGER, SALES_REP, CUSTOMER_SERVICE, DISPATCHER, TECHNICIAN או VIEWER.</p></div><div className="grid md:grid-cols-2 gap-3"><input className="input-field" placeholder="שם תפקיד, למשל טכנאי בכיר" value={roleName} onChange={(e) => setRoleName(e.target.value)} /><input className="input-field" placeholder="תיאור קצר" value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} /></div><div className="grid md:grid-cols-2 gap-3">{roleCatalog.map(([module, actions]: [string, readonly string[]]) => <div key={module} className="border rounded-xl p-3" style={{ borderColor: "var(--border)" }}><div className="font-medium mb-2">{labels[module] || module}</div><div className="flex flex-wrap gap-2">{actions.map((action) => { const p = rolePermissions.find((x) => x.key === `${module}.${action}`); return <label key={action} className="text-xs flex items-center gap-1"><input type="checkbox" checked={!!p?.actions.includes(action)} onChange={() => upsertRolePermission(`${module}.${action}`, action)} />{actionLabels[action] || action}</label>; })}</div>{rolePermissions.some((p) => p.key.startsWith(`${module}.`)) && <select className="input-field mt-2 text-xs" value={rolePermissions.find((p) => p.key.startsWith(`${module}.`))?.scope || "ALL"} onChange={(e) => setRolePermissions(rolePermissions.map((p) => p.key.startsWith(`${module}.`) ? { ...p, scope: e.target.value } : p))}>{Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}</div>)}</div><button onClick={createRole} disabled={!roleName.trim() || !rolePermissions.length} className="btn-accent disabled:opacity-50">צור תפקיד</button></div>
    <div className="card p-5 space-y-4"><h2 className="text-xl font-bold">הקצאת תפקיד והרשאה זמנית</h2><div className="grid md:grid-cols-3 gap-3"><select className="input-field" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}><option value="">בחר משתמש</option>{advanced?.users?.map((u: any) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}</select><select className="input-field" value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)}><option value="">בחר תפקיד מותאם</option>{advanced?.roles?.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><button onClick={assignRole} disabled={!assignUserId || !assignRoleId} className="btn-accent disabled:opacity-50">הקצה תפקיד</button></div><div className="text-sm" style={{ color: "var(--muted)" }}>הרשאות זמניות ו־Audit Log זמינים דרך API מאובטח: <code>/api/access/temporary</code>. כל הקצאה נרשמת ביומן הפעילות.</div></div>
    {advanced?.roles?.length > 0 && <div className="card p-5"><h2 className="font-bold mb-3">תפקידים שנוצרו</h2><select className="input-field max-w-md" value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}><option value="">בחר תפקיד להצגה</option>{advanced.roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>{selectedRole && <div className="mt-3 grid md:grid-cols-2 gap-2 text-sm">{selectedRole.permissions.map((p: any) => <div key={p.permission.key} className="border rounded p-2" style={{ borderColor: "var(--border)" }}>{p.permission.key} · {(p.actions as string[]).map((a) => actionLabels[a] || a).join(", ")} · {scopeLabels[p.scope] || p.scope}</div>)}</div>}</div>}
  </div>;
}

