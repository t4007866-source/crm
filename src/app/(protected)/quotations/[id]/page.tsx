"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלח",
  VIEWED: "נצפה",
  ACCEPTED: "אושר",
  DECLINED: "נדחה",
  EXPIRED: "פג תוקף",
};

const fmtILS = (n: number) =>
  `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [q, setQ] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בטעינה");
      setQ(data.quotation);
      setHistory(data.quotation?.itemHistory || []);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await fetch(`/api/quotations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createNewVersion() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) router.push(`/quotations/${data.quotation.id}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p dir="rtl" style={{ padding: 24 }}>טוען…</p>;
  if (error || !q)
    return (
      <p dir="rtl" style={{ padding: 24, color: "#C45A2A" }}>
        {error || "הצעה לא נמצאה"}
      </p>
    );

  const mainItems = q.items.filter((i: any) => !i.isOptional);
  const optionalItems = q.items.filter((i: any) => i.isOptional);

  return (
    <div dir="rtl" style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#172B4D" }}>
            {q.number} <span style={{ color: "#8a8378", fontSize: 16 }}>v{q.version}</span>
          </h1>
          <p style={{ color: "#5c564a" }}>
            {q.title} · {q.customer?.name}
            {q.lead && (
              <>
                {" · ליד: "}
                <Link href={`/leads/${q.lead.id}`}>{q.lead.name}</Link>
              </>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {q.status === "DRAFT" && (
            <button onClick={() => setStatus("SENT")} disabled={busy} style={btnPrimary}>
              סמן כנשלח
            </button>
          )}
          {q.status === "SENT" && (
            <>
              <button onClick={() => setStatus("VIEWED")} disabled={busy} style={btnSecondary}>
                סמן כנצפה
              </button>
              <button onClick={() => setStatus("ACCEPTED")} disabled={busy} style={btnAccept}>
                אושר ✓
              </button>
              <button onClick={() => setStatus("DECLINED")} disabled={busy} style={btnSecondary}>
                נדחה
              </button>
            </>
          )}
          <button onClick={createNewVersion} disabled={busy} style={btnSecondary}>
            צור גרסה חדשה (v{q.version + 1})
          </button>
        </div>
      </div>

      {/* פריטים ראשיים */}
      <h2 style={h2}>פריטים</h2>
      <div style={{ background: "#fff", border: "1px solid #E0D9C8", borderRadius: 12 }}>
        {mainItems.map((item: any) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderBottom: "1px solid #F4F0E8",
              fontSize: 14,
            }}
          >
            <span>
              {item.name || item.description}
              {item.model && (
                <span style={{ color: "#8a8378" }}> — {item.model}</span>
              )}
            </span>
            <span>
              {item.quantity} × {fmtILS(item.unitPrice)} ={" "}
              <b>{fmtILS(item.total)}</b>
            </span>
          </div>
        ))}
      </div>

      {/* שיפורים אופציונליים */}
      {optionalItems.length > 0 && (
        <>
          <h2 style={h2}>── שיפורים אופציונליים ──</h2>
          <div style={{ background: "#fdf9f3", border: "1px solid #E0D9C8", borderRadius: 12 }}>
            {optionalItems.map((item: any) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderBottom: "1px solid #F4F0E8",
                  fontSize: 14,
                }}
              >
                <span>
                  {item.recommended && <span title="מומלץ">★ </span>}
                  {item.name || item.description}
                  {item.model && (
                    <span style={{ color: "#8a8378" }}> — {item.model}</span>
                  )}
                </span>
                <span>+{fmtILS(item.total)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* סיכום */}
      <div style={{ background: "#F4F0E8", border: "1px solid #E0D9C8", borderRadius: 12, padding: 16, marginTop: 16 }}>
        <SumRow label="סה״כ לפני הנחה" value={fmtILS(q.totalBeforeDiscount)} />
        {q.discountPercent > 0 && (
          <SumRow label={`הנחה (${q.discountPercent}%)`} value={`-${fmtILS(q.totalBeforeDiscount - (q.total - q.tax))}`} />
        )}
        <SumRow label={`מע״מ (${q.vatPercent}%)`} value={fmtILS(q.tax)} />
        <SumRow label="סה״כ לתשלום" value={fmtILS(q.total)} strong />
        <p style={{ fontSize: 13, color: "#8a8378", marginTop: 8 }}>
          תוקף:{" "}
          {q.validUntil ? new Date(q.validUntil).toLocaleDateString("he-IL") : "—"}
          {q.sentAt && ` · נשלח: ${new Date(q.sentAt).toLocaleDateString("he-IL")}`}
        </p>
      </div>

      {/* היסטוריית שינויים */}
      {history.length > 0 && (
        <>
          <h2 style={h2}>היסטוריית שינויים</h2>
          <div style={{ background: "#fff", border: "1px solid #E0D9C8", borderRadius: 12 }}>
            {history.map((h: any) => (
              <div key={h.id} style={{ padding: "8px 16px", borderBottom: "1px solid #F4F0E8", fontSize: 13 }}>
                <b>{changeLabel(h.changeType)}</b>{" "}
                {h.changeType === "MODEL_SWAPPED" && (
                  <span>
                    {h.oldModel || "—"} → {h.newModel || "—"} (
                    {fmtILS(h.oldPrice || 0)} → {fmtILS(h.newPrice || 0)})
                  </span>
                )}
                {h.changeType === "PRICE_CHANGED" && (
                  <span>
                    {fmtILS(h.oldPrice || 0)} → {fmtILS(h.newPrice || 0)}
                  </span>
                )}
                <span style={{ color: "#8a8378" }}>
                  {" "}
                  · {new Date(h.createdAt).toLocaleString("he-IL")}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function changeLabel(t: string) {
  switch (t) {
    case "MODEL_SWAPPED":
      return "החלפת דגם";
    case "PRICE_CHANGED":
      return "שינוי מחיר";
    case "ADDED":
      return "פריט נוסף";
    case "REMOVED":
      return "פריט הוסר";
    default:
      return t;
  }
}

function SumRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        fontSize: strong ? 18 : 14,
        fontWeight: strong ? 700 : 400,
        color: "#172B4D",
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const h2: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#172B4D",
  margin: "24px 0 8px",
};
const btnPrimary: React.CSSProperties = {
  background: "#C45A2A",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
};
const btnAccept: React.CSSProperties = {
  background: "#2e7d32",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "#F4F0E8",
  color: "#172B4D",
  border: "1px solid #E0D9C8",
  padding: "10px 18px",
  borderRadius: 8,
  cursor: "pointer",
};

