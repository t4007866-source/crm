"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type PermissionMap = Record<string, string[]>;
type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  isBlocked: boolean;
  emailVerified?: string | null;
  lastLoginAt?: string | null;
  inviteExpiresAt?: string | null;
  createdAt?: string;
  permissions?: PermissionMap;
};

const roles = [
  ["ADMIN", "מנהל מערכת"], ["MANAGER", "מנהל"], ["SALES_REP", "נציג מכירות"],
  ["CUSTOMER_SERVICE", "שירות לקוחות"], ["DISPATCHER", "שיבוץ שירות"],
  ["TECHNICIAN", "טכנאי"], ["VIEWER", "צופה"],
] as const;
const moduleLabels: Record<string, string> = { dashboard: "לוח בקרה", customers: "לקוחות", orders: "הזמנות", inventory: "מלאי ושירותים", serviceCalendar: "יומן שירות והתקנות", serviceMap: "מפת שירות", tasks: "משימות", leads: "לידים נכנסים", automations: "אוטומציות", integrations: "אינטגרציות ו-API", reports: "דוחות", ai: "עוזר AI", access: "הרשאות וגישה", users: "ניהול משתמשים" };
const actionLabels: Record<string, string> = { view: "צפייה", create: "יצירה", edit: "עריכה", delete: "מחיקה", export: "ייצוא", approve: "אישור" };

function clonePermissions(value: unknown): PermissionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as PermissionMap).map(([key, actions]) => [key, Array.isArray(actions) ? [...actions] : []]));
}

function statusOf(user: User) {
  if (user.isBlocked) return "blocked";
  if (!user.emailVerified) return "pending";
  return user.isActive ? "active" : "inactive";
}

export default function UsersPage() {
  const [data, setData] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", role: "VIEWER" });
  const [editPermissions, setEditPermissions] = useState<PermissionMap>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<{ email: string; password: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", phone: "", role: "VIEWER", isActive: true, temporaryPassword: "" });

  const load = async () => {
    const response = await fetch("/api/users", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "לא ניתן לטעון משתמשים");
    setData(json);
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const filteredUsers = useMemo(() => {
    const users: User[] = data?.users || [];
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesText = !needle || `${user.name} ${user.email} ${user.phone || ""}`.toLowerCase().includes(needle);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesStatus = statusFilter === "ALL" || statusOf(user) === statusFilter;
      return matchesText && matchesRole && matchesStatus;
    });
  }, [data, query, roleFilter, statusFilter]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setCreateForm({ name: "", email: "", phone: "", role: "VIEWER", isActive: true, temporaryPassword: "" });
    setMessage(""); setError(""); setTemporaryPassword(null);
  };

  const createUser = async (event: FormEvent) => {
    event.preventDefault(); setMessage(""); setError("");
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const json = await response.json();
    if (!response.ok) { setError(json.error || "לא ניתן ליצור משתמש"); return; }
    setCreating(false);
    setTemporaryPassword({ email: json.user.email, password: json.temporaryPassword });
    setMessage("המשתמש נוצר, והסיסמה הזמנית מוצגת פעם אחת בלבד. הפעולה נרשמה ב-Audit Log.");
    await load();
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setEditForm({ name: user.name, email: user.email, phone: user.phone || "", role: user.role });
    setEditPermissions(clonePermissions(user.permissions));
    setMessage(""); setError(""); setTemporaryPassword(null);
  };

  const togglePermission = (module: string, action: string) => {
    const current = editPermissions[module] || [];
    setEditPermissions({ ...editPermissions, [module]: current.includes(action) ? current.filter((item) => item !== action) : [...current, action] });
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault(); setMessage(""); setError("");
    const response = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing?.id, ...editForm, permissions: editPermissions }) });
    const json = await response.json();
    if (!response.ok) { setError(json.error || "לא ניתן לשמור את השינויים"); return; }
    setEditing(null); setMessage("פרטי המשתמש וההרשאות עודכנו ונרשמו ב-Audit Log"); await load();
  };

  const updateUser = async (user: User, patch: any, success: string) => {
    setMessage(""); setError("");
    const response = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, ...patch }) });
    const json = await response.json();
    if (!response.ok) { setError(json.error || "הפעולה נכשלה"); return; }
    setMessage(success); await load();
  };

  const approve = (user: User) => updateUser(user, { approve: true, isActive: true, isBlocked: false }, "המשתמש אושר והופעל");
  const toggleActive = (user: User) => updateUser(user, { isActive: !user.isActive }, user.isActive ? "המשתמש הושבת" : "המשתמש הופעל");
  const toggleBlocked = (user: User) => updateUser(user, { isBlocked: !user.isBlocked }, user.isBlocked ? "חסימת המשתמש הוסרה" : "המשתמש נחסם");

  const resetPassword = async (user: User) => {
    if (!window.confirm(`לאפס את הסיסמה של ${user.name}?\n\nתיווצר סיסמה זמנית חדשה ותוצג לך פעם אחת.`)) return;
    setMessage(""); setError("");
    const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id }) });
    const json = await response.json();
    if (!response.ok) { setError(json.error || "לא ניתן לאפס סיסמה"); return; }
    setTemporaryPassword({ email: user.email, password: json.temporaryPassword });
    setMessage("הסיסמה אופסה. שמור או מסור אותה בערוץ מאובטח."); await load();
  };

  const removeUser = async (user: User) => {
    if (!window.confirm(`למחוק את ${user.name}?\n\nהמחיקה היא השבתה וחסימה בטוחה. ההיסטוריה תישמר והמשתמש לא יוכל להתחבר.`)) return;
    setMessage(""); setError("");
    const response = await fetch("/api/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id }) });
    const json = await response.json();
    if (!response.ok) { setError(json.error || "לא ניתן להשבית את המשתמש"); return; }
    setMessage(json.message || "המשתמש הושבת והפעולה נרשמה"); await load();
  };

  if (error && !data) return <div className="card p-6"><h1 className="text-xl font-bold">שגיאה</h1><p className="mt-2">{error}</p></div>;
  if (!data) return <div className="p-8 text-center">טוען משתמשים...</div>;

  return <div className="space-y-4" dir="rtl">
    <div className="flex justify-between items-center gap-4"><div><h1 className="text-2xl font-bold">ניהול משתמשים</h1><p className="text-sm" style={{ color: "var(--muted)" }}>חיפוש, הרשאות, אישורים ופעולות אבטחה. כל שינוי מתועד ב-Audit Log.</p><a href="/users/audit-log" className="text-sm underline">פתיחת יומן ביקורת</a></div>{data.canManage && <button className="btn-primary" onClick={openCreate}>＋ הוסף משתמש</button>}</div>
    {message && <div className="p-3 rounded" style={{ background: "#e8f5e9", color: "#2e7d32" }}>{message}</div>}
    {error && <div className="p-3 rounded" style={{ background: "#ffebee", color: "#c62828" }}>{error}</div>}
    {temporaryPassword && <div className="card p-4" style={{ background: "#fff8e1", border: "1px solid #ffe082" }}><h3 className="font-bold">סיסמה זמנית — הצג אותה למשתמש בערוץ מאובטח</h3><div className="mt-2 font-mono text-sm">{temporaryPassword.email} · {temporaryPassword.password}</div></div>}

    {creating && data.canManage && <div className="card p-5"><div className="flex justify-between items-center mb-4"><div><h2 className="font-bold text-lg">הוספת משתמש</h2><p className="text-xs" style={{ color: "var(--muted)" }}>התפקיד יקבל את הרשאות ברירת המחדל של ה-RBAC הקיים.</p></div><button type="button" onClick={() => setCreating(false)}>סגור</button></div><form onSubmit={createUser} className="space-y-4"><div className="grid md:grid-cols-3 gap-3"><input className="input-field" placeholder="שם מלא" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required /><input className="input-field" type="email" placeholder="אימייל" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required /><input className="input-field" placeholder="טלפון" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} /><select className="input-field" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="input-field" value={createForm.isActive ? "active" : "inactive"} onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.value === "active" })}><option value="active">פעיל</option><option value="inactive">מושבת</option></select><input className="input-field" type="text" minLength={8} placeholder="סיסמה זמנית — ריק = יצירה אוטומטית" value={createForm.temporaryPassword} onChange={(e) => setCreateForm({ ...createForm, temporaryPassword: e.target.value })} /></div><p className="text-xs" style={{ color: "var(--muted)" }}>הסיסמה נשמרת במסד כ-hash ואינה נשמרת ב-Audit Log. היא תוצג לאדמין פעם אחת לאחר היצירה.</p><button className="btn-primary">צור משתמש</button></form></div>}

    <div className="card p-4"><div className="grid md:grid-cols-4 gap-3"><input className="input-field" placeholder="חיפוש לפי שם, אימייל או טלפון" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="input-field" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="ALL">כל התפקידים</option>{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">כל הסטטוסים</option><option value="active">פעיל</option><option value="pending">ממתין לאישור</option><option value="inactive">מושבת</option><option value="blocked">חסום</option></select><div className="flex items-center text-sm" style={{ color: "var(--muted)" }}>מציג {filteredUsers.length} מתוך {data.users.length}</div></div></div>

    {editing && data.canManage && <div className="card p-5"><div className="flex justify-between items-center mb-4"><div><h2 className="font-bold text-lg">עריכת משתמש</h2><p className="text-xs" style={{ color: "var(--muted)" }}>{editing.email}</p></div><button type="button" onClick={() => setEditing(null)}>סגור</button></div><form onSubmit={saveEdit} className="space-y-4"><div className="grid md:grid-cols-4 gap-3"><input className="input-field" placeholder="שם מלא" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /><input className="input-field" type="email" placeholder="אימייל" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required /><input className="input-field" placeholder="טלפון" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /><select className="input-field" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><h3 className="font-bold mb-2">הרשאות מותאמות אישית</h3><div className="overflow-auto border rounded"><table className="w-full text-sm min-w-[720px]"><thead><tr className="border-b"><th className="text-right p-2">מודול</th>{data.actions.map((action: string) => <th key={action} className="p-2">{actionLabels[action] || action}</th>)}</tr></thead><tbody>{data.modules.map((module: string) => <tr key={module} className="border-b"><td className="p-2 font-medium">{moduleLabels[module] || module}</td>{data.actions.map((action: string) => <td key={action} className="text-center p-2"><input type="checkbox" checked={(editPermissions[module] || []).includes(action)} onChange={() => togglePermission(module, action)} /></td>)}</tr>)}</tbody></table></div></div><button className="btn-primary">שמור פרטי משתמש והרשאות</button></form></div>}

    <div className="card overflow-auto"><table className="w-full text-sm min-w-[1250px]"><thead><tr className="border-b" style={{ background: "#fafaf7" }}><th className="text-right p-3">שם</th><th className="text-right p-3">אימייל</th><th className="text-right p-3">תפקיד</th><th className="text-right p-3">סטטוס</th><th className="text-right p-3">אישור</th><th className="text-right p-3">כניסה אחרונה</th><th className="text-right p-3">פעולות</th></tr></thead><tbody>{filteredUsers.length === 0 ? <tr><td colSpan={7} className="p-8 text-center">לא נמצאו משתמשים</td></tr> : filteredUsers.map((user: User) => <tr key={user.id} className="border-b"><td className="p-3 font-medium">{user.name}</td><td className="p-3">{user.email}</td><td className="p-3">{roles.find(([value]) => value === user.role)?.[1] || user.role}</td><td className="p-3">{statusOf(user) === "blocked" ? "חסום" : statusOf(user) === "pending" ? "ממתין לאישור" : user.isActive ? "פעיל" : "מושבת"}</td><td className="p-3">{user.emailVerified ? "מאושר" : data.canManage ? <button className="btn-primary" onClick={() => approve(user)}>אשר משתמש</button> : "ממתין"}</td><td className="p-3 text-xs">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("he-IL") : "—"}</td><td className="p-3"><div className="flex gap-2 flex-wrap">{data.canManage && <><button className="btn-primary" onClick={() => openEdit(user)}>עריכה</button><button className="btn-primary" onClick={() => toggleActive(user)}>{user.isActive ? "השבת" : "הפעל"}</button><button className="btn-primary" onClick={() => toggleBlocked(user)}>{user.isBlocked ? "בטל חסימה" : "חסום"}</button><button className="btn-primary" onClick={() => resetPassword(user)}>אפס סיסמה</button><button className="btn-primary" style={{ background: "#b42318" }} onClick={() => removeUser(user)}>מחיקה בטוחה</button></>}</div></td></tr>)}</tbody></table></div>
  </div>;
}










