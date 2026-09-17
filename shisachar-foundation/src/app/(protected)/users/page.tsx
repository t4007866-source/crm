"use client";
import { useState, useEffect } from "react";

const allowedRoles = ["MANAGER", "SALES_REP", "CUSTOMER_SERVICE", "DISPATCHER", "TECHNICIAN", "VIEWER"];

export default function UsersPage() {
  const [data, setData] = useState<any>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "SALES_REP" });
  const [inviteMsg, setInviteMsg] = useState("");

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((d) => setData(d));
  }, []);

  const canManage = data?.allowedModules?.includes("users") ?? false;

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });
    const d = await res.json();
    setInviteMsg(d.error || d.message);
    if (res.ok) setInviteOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">משתמשים</h1>
        {canManage && (
          <button onClick={() => setInviteOpen(!inviteOpen)} className="btn-accent">
            הזמן משתמש
          </button>
        )}
      </div>

      {inviteOpen && (
        <div className="card p-5">
          <h2 className="font-bold mb-3">הזמנת משתמש חדש</h2>
          {inviteMsg && (
            <div className="mb-3 p-2 rounded text-sm" style={{ background: "#e3f2fd", color: "#0d47a1" }}>
              {inviteMsg}
            </div>
          )}
          <form onSubmit={sendInvite} className="grid sm:grid-cols-3 gap-3">
            <input className="input-field" placeholder="אימייל *" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required />
            <input className="input-field" placeholder="שם" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} />
            <select className="input-field" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}>
              {allowedRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="sm:col-span-3 flex gap-2">
              <button type="submit" className="btn-primary">שלח הזמנה</button>
              <button type="button" className="btn-primary" style={{ background: "#9e9e9e" }} onClick={() => setInviteOpen(false)}>ביטול</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "#fafaf7" }}>
              <th className="text-right p-3">שם</th>
              <th className="text-right p-3">אימייל</th>
              <th className="text-right p-3">תפקיד</th>
              <th className="text-right p-3">פעיל</th>
              <th className="text-right p-3">כניסה אחרונה</th>
            </tr>
          </thead>
          <tbody>
            {data?.users?.map((u: any) => (
              <tr key={u.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">{u.isActive ? "כן" : "לא"}</td>
                <td className="p-3 text-xs" style={{ color: "var(--muted)" }}>
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("he-IL") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

