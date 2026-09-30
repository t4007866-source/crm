"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלח",
  VIEWED: "נצפה",
  ACCEPTED: "אושר",
  DECLINED: "נדחה",
  EXPIRED: "פג תוקף",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#8a8378",
  SENT: "#172B4D",
  VIEWED: "#4a6fa5",
  ACCEPTED: "#2e7d32",
  DECLINED: "#C45A2A",
  EXPIRED: "#9e9e9e",
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/quotations${statusFilter ? `?status=${statusFilter}` : ""}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בטעינה");
      setQuotations(data.quotations || []);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const fmtILS = (n: number) =>
    `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

  return (
    <div dir="rtl" style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#172B4D" }}>
            הצעות מחיר
          </h1>
          <p style={{ color: "#8a8378", fontSize: 14 }}>
            {quotations.length} הצעות
          </p>
        </div>
        <Link
          href="/quotations/new"
          style={{
            background: "#C45A2A",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          + הצעה חדשה
        </Link>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
        {[["", "הכל"], ...Object.entries(STATUS_LABELS)].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setStatusFilter(v)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid #E0D9C8",
              background: statusFilter === v ? "#172B4D" : "transparent",
              color: statusFilter === v ? "#fff" : "#5c564a",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p>טוען…</p>}
      {error && (
        <p style={{ color: "#C45A2A" }}>שגיאה: {error}</p>
      )}

      {!loading && !error && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #E0D9C8",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F4F0E8", textAlign: "right" }}>
                <th style={th}>מספר</th>
                <th style={th}>לקוח</th>
                <th style={th}>כותרת</th>
                <th style={th}>גרסה</th>
                <th style={th}>סה"כ</th>
                <th style={th}>סטטוס</th>
                <th style={th}>תוקף</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q.id} style={{ borderTop: "1px solid #E0D9C8" }}>
                  <td style={td}>
                    <Link
                      href={`/quotations/${q.id}`}
                      style={{ color: "#172B4D", fontWeight: 600 }}
                    >
                      {q.number}
                    </Link>
                  </td>
                  <td style={td}>{q.customer?.name}</td>
                  <td style={td}>{q.title}</td>
                  <td style={td}>v{q.version}</td>
                  <td style={td}>{fmtILS(q.total)}</td>
                  <td style={td}>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "#fff",
                        background: STATUS_COLORS[q.status] || "#888",
                      }}
                    >
                      {STATUS_LABELS[q.status] || q.status}
                    </span>
                  </td>
                  <td style={td}>
                    {q.validUntil
                      ? new Date(q.validUntil).toLocaleDateString("he-IL")
                      : "—"}
                  </td>
                </tr>
              ))}
              {quotations.length === 0 && (
                <tr>
                  <td style={td} colSpan={7}>
                    אין הצעות מחיר עדיין
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 600,
  color: "#5c564a",
};
const td: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 14,
  color: "#172B4D",
};

