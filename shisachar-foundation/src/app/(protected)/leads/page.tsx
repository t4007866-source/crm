"use client";
import { useState, useEffect } from "react";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => {
        setLeads(d.leads || []);
        setLoading(false);
      });
  }, []);

  const confColor = (c: string) =>
    c === "HIGH" ? "#4caf50" : c === "MEDIUM" ? "#e8a547" : "#9e9e9e";

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">לידים</h1>
        <a href="/leads/new" className="btn-accent">ליד חדש</a>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "#fafaf7" }}>
              <th className="text-right p-3">שם</th>
              <th className="text-right p-3">חברה</th>
              <th className="text-right p-3">טלפון</th>
              <th className="text-right p-3">מקור</th>
              <th className="text-right p-3">שלב</th>
              <th className="text-right p-3">Confidence</th>
              <th className="text-right p-3">ערך</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center" style={{ color: "var(--muted)" }}>
                  טוען...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center" style={{ color: "var(--muted)" }}>
                  אין לידים
                </td>
              </tr>
            ) : (
              leads.map((l) => (
                <tr key={l.id} className="border-b hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
                  <td className="p-3 font-medium"><a href={`/leads/${l.id}`} className="hover:underline" style={{ color: "var(--rust)" }}>{l.name}</a></td>
                  <td className="p-3">{l.company || "—"}</td>
                  <td className="p-3 font-mono">{l.phone}</td>
                  <td className="p-3">{l.source}</td>
                  <td className="p-3">{l.stage}</td>
                  <td className="p-3">
                    <span
                      className="badge"
                      style={{ background: `${confColor(l.confidence)}20`, color: confColor(l.confidence) }}
                    >
                      {l.confidence}
                    </span>
                  </td>
                  <td className="p-3 font-mono">
                    {l.value ? `₪${l.value.toLocaleString()}` : "—"}
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



