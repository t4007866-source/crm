"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלחה",
  ACCEPTED: "אושרה",
  REJECTED: "נדחתה",
  EXPIRED: "פגה",
};

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/quotes/${id}`).then((r) => r.json());
    if (!res.quote) {
      setError(res.error || "הצעת מחיר לא נמצאה");
      return;
    }
    setQuote(res.quote);
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setStatus = async (status: string) => {
    setBusy(true);
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error || "עדכון נכשל");
      return;
    }
    setMessage(status === "SENT" ? "ההצעה סומנה כנשלחה" : "הסטטוס עודכן");
    load();
  };

  const convert = async () => {
    setBusy(true);
    const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "ההמרה נכשלה");
      return;
    }
    router.push(`/orders`);
  };

  if (error) {
    return (
      <div style={{ padding: 24 }} dir="rtl">
        <p style={{ color: "#b3261e" }}>{error}</p>
        <Link href="/quotes" style={{ color: "#C45A2A" }}>
          חזרה להצעות המחיר
        </Link>
      </div>
    );
  }

  if (!quote) {
    return (
      <div style={{ padding: 24 }} dir="rtl">
        <p style={{ color: "#8A8275" }}>טוען…</p>
      </div>
    );
  }

  const subtotal = quote.items.reduce((sum: number, i: any) => sum + i.lineTotal, 0);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }} dir="rtl">
      <Link href="/quotes" style={{ color: "#C45A2A", textDecoration: "none", fontSize: 14 }}>
        ← חזרה להצעות המחיר
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 16px", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 24, color: "#172B4D" }}>
          {quote.quoteNumber} — {quote.title}
        </h1>
        <span style={{ background: "#F4F0E8", border: "1px solid #E0D9C8", padding: "4px 12px", borderRadius: 999, fontWeight: 700, color: "#172B4D" }}>
          {STATUS_LABELS[quote.status] || quote.status}
        </span>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E0D9C8", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14, color: "#172B4D" }}>
          <div>
            <strong>לקוח:</strong>{" "}
            <Link href={`/customers/${quote.customerId}`} style={{ color: "#C45A2A" }}>
              {quote.customer?.name}
            </Link>
          </div>
          <div>
            <strong>תוקף עד:</strong> {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString("he-IL") : "—"}
          </div>
          <div>
            <strong>נוצר:</strong> {new Date(quote.createdAt).toLocaleDateString("he-IL")}
          </div>
          <div>
            <strong>נשלח:</strong> {quote.sentAt ? new Date(quote.sentAt).toLocaleDateString("he-IL") : "—"}
          </div>
          {quote.convertedOrderId && (
            <div>
              <strong>הומר להזמנה:</strong> כן
            </div>
          )}
        </div>
        {quote.notes && <p style={{ marginTop: 12, fontSize: 14, color: "#172B4D" }}>{quote.notes}</p>}
      </div>

      <div style={{ background: "#fff", border: "1px solid #E0D9C8", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "right" }}>
          <thead>
            <tr style={{ background: "#F4F0E8" }}>
              <th style={{ padding: 10 }}>סעיף</th>
              <th style={{ padding: 10 }}>כמות</th>
              <th style={{ padding: 10 }}>מחיר יחידה</th>
              <th style={{ padding: 10 }}>הנחה</th>
              <th style={{ padding: 10 }}>סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item: any) => (
              <tr key={item.id} style={{ borderTop: "1px solid #E0D9C8" }}>
                <td style={{ padding: 10 }}>{item.name}</td>
                <td style={{ padding: 10 }}>{item.quantity}</td>
                <td style={{ padding: 10 }}>₪{Number(item.unitPrice).toLocaleString()}</td>
                <td style={{ padding: 10 }}>₪{Number(item.discount || 0).toLocaleString()}</td>
                <td style={{ padding: 10 }}>₪{Number(item.lineTotal).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: "#172B4D", color: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <span>ביניים: ₪{subtotal.toLocaleString()}</span>
        <span>הנחה: ₪{Number(quote.discount || 0).toLocaleString()}</span>
        <strong>סה״כ כולל מע״מ: ₪{Number(quote.total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {quote.status === "DRAFT" && (
          <button onClick={() => setStatus("SENT")} disabled={busy} style={{ background: "#1565c0", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>
            סמן כנשלחה
          </button>
        )}
        {(quote.status === "SENT" || quote.status === "DRAFT") && !quote.convertedOrderId && (
          <button onClick={convert} disabled={busy} style={{ background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>
            אשר והמר להזמנה
          </button>
        )}
        {quote.status !== "REJECTED" && !quote.convertedOrderId && (
          <button onClick={() => setStatus("REJECTED")} disabled={busy} style={{ background: "#b3261e", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>
            סמן כנדחתה
          </button>
        )}
      </div>

      {message && <p style={{ marginTop: 12, color: "#C45A2A" }}>{message}</p>}
    </div>
  );
}

