"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const statusLabel: Record<string, string> = {
  LEAD: "ליד",
  PROSPECT: "פרוספקט",
  ACTIVE: "פעיל",
  CHURNED: "עזב",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/customers${params}`);
    const data = await res.json();
    setCustomers(data.customers || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">לקוחות</h1>
        <Link href="/customers/new" className="btn-accent">
          לקוח חדש
        </Link>
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="חיפוש לפי שם, טלפון, אימייל..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchCustomers()}
          className="input-field"
          style={{ width: 300 }}
        />
        <button onClick={fetchCustomers} className="btn-primary">
          חיפוש
        </button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "#fafaf7" }}>
              <th className="text-right p-3">שם</th>
              <th className="text-right p-3">חברה</th>
              <th className="text-right p-3">טלפון</th>
              <th className="text-right p-3">עיר</th>
              <th className="text-right p-3">סטטוס</th>
              <th className="text-right p-3">תאריך</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center" style={{ color: "var(--muted)" }}>
                  טוען...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center" style={{ color: "var(--muted)" }}>
                  אין לקוחות
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
                  <td className="p-3">
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--rust)" }}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="p-3">{c.company || "—"}</td>
                  <td className="p-3 font-mono">{c.phone}</td>
                  <td className="p-3">{c.city || "—"}</td>
                  <td className="p-3">
                    <span className={`badge badge-${c.status.toLowerCase()}`}>
                      {statusLabel[c.status] || c.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs" style={{ color: "var(--muted)" }}>
                    {new Date(c.createdAt).toLocaleDateString("he-IL")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

