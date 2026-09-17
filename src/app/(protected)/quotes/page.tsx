"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ExportBar from "@/components/ExportBar";

type Quote = any;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלחה",
  ACCEPTED: "אושרה",
  REJECTED: "נדחתה",
  EXPIRED: "פגה",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#8A8275",
  SENT: "#1565c0",
  ACCEPTED: "#2e7d32",
  REJECTED: "#b3261e",
  EXPIRED: "#C45A2A",
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const res = await fetch(`/api/quotes?${params.toString()}`).then((r) => r.json());
    setQuotes(res.quotes || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const exportColumns = [
    { header: "מספר", key: "quoteNumber" },
    { header: "כותרת", key: "title" },
    { header: "לקוח", key: "customerName" },
    { header: "סה״כ (₪)", key: "total" },
    { header: "סטטוס", key: "statusLabel" },
    { header: "תוקף עד", key: "validUntil" },
  ];
  const exportData = quotes.map((quote: Quote) => ({
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    customerName: quote.customer?.name || "",
    total: quote.total,
    statusLabel: STATUS_LABELS[quote.status] || quote.status,
    validUntil: quote.validUntil ? new Date(quote.validUntil).toLocaleDateString("he-IL") : "",
  }));

  return (
    <div style={{ padding: 24 }} dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 24, color: "#172B4D" }}>הצעות מחיר</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ExportBar title="הצעות מחיר" data={exportData} columns={exportColumns} printableId="quotes-printable-table" />
          <Link
            href="/quotes/new"
            style={{ background: "#C45A2A", color: "#fff", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}
          >
            + הצעת מחיר חדשה
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {[["", "הכל"], ["DRAFT", "טיוטה"], ["SENT", "נשלחה"], ["ACCEPTED", "אושרה"], ["REJECTED", "נדחתה"], ["EXPIRED", "פגה"]].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #E0D9C8",
              background: status === value ? "#172B4D" : "#F4F0E8",
              color: status === value ? "#fff" : "#8A8275",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {label}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="חיפוש לפי מספר, כותרת או לקוח"
          style={{ border: "1px solid #E0D9C8", borderRadius: 8, padding: "6px 12px", background: "#fff", minWidth: 220 }}
        />
        <button onClick={load} style={{ border: "1px solid #E0D9C8", borderRadius: 8, padding: "6px 14px", background: "#fff", cursor: "pointer" }}>
          חפש
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#8A8275" }}>טוען…</p>
      ) : quotes.length === 0 ? (
        <p style={{ color: "#8A8275" }}>אין הצעות מחיר להצגה.</p>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E0D9C8", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#F4F0E8", textAlign: "right" }}>
                <th style={{ padding: 12 }}>מספר</th>
                <th style={{ padding: 12 }}>כותרת</th>
                <th style={{ padding: 12 }}>לקוח</th>
                <th style={{ padding: 12 }}>סה"כ</th>
                <th style={{ padding: 12 }}>סטטוס</th>
                <th style={{ padding: 12 }}>תוקף עד</th>
                <th style={{ padding: 12 }}>נוצר</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} style={{ borderTop: "1px solid #E0D9C8" }}>
                  <td style={{ padding: 12 }}>
                    <Link href={`/quotes/${quote.id}`} style={{ color: "#C45A2A", fontWeight: 600, textDecoration: "none" }}>
                      {quote.quoteNumber}
                    </Link>
                  </td>
                  <td style={{ padding: 12 }}>
                    <Link href={`/quotes/${quote.id}`} style={{ color: "#172B4D", textDecoration: "none" }}>
                      {quote.title}
                    </Link>
                  </td>
                  <td style={{ padding: 12 }}>{quote.customer?.name}</td>
                  <td style={{ padding: 12 }}>₪{Number(quote.total || 0).toLocaleString()}</td>
                  <td style={{ padding: 12 }}>
                    <span
                      style={{
                        background: `${STATUS_COLORS[quote.status] || "#8A8275"}18`,
                        color: STATUS_COLORS[quote.status] || "#8A8275",
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {STATUS_LABELS[quote.status] || quote.status}
                    </span>
                  </td>
                  <td style={{ padding: 12 }}>{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString("he-IL") : "—"}</td>
                  <td style={{ padding: 12 }}>{new Date(quote.createdAt).toLocaleDateString("he-IL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}




