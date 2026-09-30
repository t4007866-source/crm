"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { name: string; productId: string; sku: string; kind: string; quantity: number; unitPrice: number; discount: number };

const emptyItem: Item = { name: "", productId: "", sku: "", kind: "PRODUCT", quantity: 1, unitPrice: 0, discount: 0 };

export default function NewQuotePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({ customerId: "", title: "", discount: 0, vatRate: 0.17, validUntil: "", notes: "", internalNotes: "" });
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/customers").then((r) => r.json()), fetch("/api/inventory/products").then((r) => r.json())])
      .then(([c, p]) => {
        setCustomers(c.customers || []);
        setProducts(p.products || []);
      })
      .catch(() => {});
  }, []);

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice - i.discount, 0);
  const afterDiscount = Math.max(subtotal - Number(form.discount || 0), 0);
  const vat = afterDiscount * Number(form.vatRate || 0);
  const total = afterDiscount + vat;

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const pickProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    updateItem(idx, {
      productId,
      name: p ? p.name : "",
      sku: p ? p.sku || "" : "",
      unitPrice: p ? Number(p.price || 0) : 0,
      kind: p ? p.kind || "PRODUCT" : "PRODUCT",
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customerId || !form.title) {
      setError("בחר לקוח והזן כותרת");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, items }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "שמירה נכשלה");
      return;
    }
    router.push(`/quotes/${data.quote.id}`);
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }} dir="rtl">
      <h1 style={{ fontSize: 24, color: "#172B4D", marginBottom: 16 }}>הצעת מחיר חדשה</h1>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #E0D9C8", borderRadius: 12, padding: 16 }}>
          <h2 style={{ color: "#172B4D", marginBottom: 12 }}>פרטי ההצעה</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              לקוח *
              <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required style={{ width: "100%", padding: 8, border: "1px solid #E0D9C8", borderRadius: 8, marginTop: 4 }}>
                <option value="">— בחר לקוח —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              כותרת *
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="לדוגמה: התקנת מערכת סינון" style={{ width: "100%", padding: 8, border: "1px solid #E0D9C8", borderRadius: 8, marginTop: 4 }} />
            </label>
            <label>
              תוקף עד
              <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} style={{ width: "100%", padding: 8, border: "1px solid #E0D9C8", borderRadius: 8, marginTop: 4 }} />
            </label>
            <label>
              מע״מ
              <select value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })} style={{ width: "100%", padding: 8, border: "1px solid #E0D9C8", borderRadius: 8, marginTop: 4 }}>
                <option value={0.17}>17%</option>
                <option value={0}>0% (פטור)</option>
              </select>
            </label>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E0D9C8", borderRadius: 12, padding: 16 }}>
          <h2 style={{ color: "#172B4D", marginBottom: 12 }}>סעיפים</h2>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 70px 90px 80px 36px", gap: 8, marginBottom: 8, alignItems: "end" }}>
              <div>
                <select value={item.productId} onChange={(e) => pickProduct(idx, e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #E0D9C8", borderRadius: 8, marginBottom: 4 }}>
                  <option value="">— מוצר מהקטלוג / חופשי —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input value={item.name} onChange={(e) => updateItem(idx, { name: e.target.value })} placeholder="שם הסעיף" style={{ width: "100%", padding: 8, border: "1px solid #E0D9C8", borderRadius: 8 }} />
              </div>
              <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} placeholder="כמות" style={{ padding: 8, border: "1px solid #E0D9C8", borderRadius: 8 }} />
              <input type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} placeholder="מחיר" style={{ padding: 8, border: "1px solid #E0D9C8", borderRadius: 8 }} />
              <input type="number" min={0} step="0.01" value={item.discount} onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })} placeholder="הנחה" style={{ padding: 8, border: "1px solid #E0D9C8", borderRadius: 8 }} />
              <span style={{ color: "#172B4D", fontWeight: 600 }}>₪{(item.quantity * item.unitPrice - item.discount).toLocaleString()}</span>
              <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} style={{ border: "1px solid #E0D9C8", background: "#fff", borderRadius: 8, cursor: "pointer", color: "#b3261e" }}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setItems((prev) => [...prev, { ...emptyItem }])} style={{ border: "1px solid #E0D9C8", background: "#F4F0E8", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>
            + הוסף סעיף
          </button>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E0D9C8", borderRadius: 12, padding: 16 }}>
          <label>
            הערות ללקוח
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} style={{ width: "100%", padding: 8, border: "1px solid #E0D9C8", borderRadius: 8, marginTop: 4 }} />
          </label>
          <label style={{ display: "block", marginTop: 12 }}>
            הערות פנימיות
            <textarea value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} rows={2} style={{ width: "100%", padding: 8, border: "1px solid #E0D9C8", borderRadius: 8, marginTop: 4 }} />
          </label>
        </div>

        <div style={{ background: "#172B4D", color: "#fff", borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 20 }}>
            <span>ביניים: ₪{subtotal.toLocaleString()}</span>
            <span>
              הנחה:
              <input type="number" min={0} step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} style={{ width: 90, marginRight: 6, padding: 4, borderRadius: 6, border: "none" }} />
            </span>
            <span>מע״מ: ₪{vat.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <strong>סה״כ: ₪{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          </div>
          <button type="submit" disabled={saving} style={{ background: "#C45A2A", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 700, cursor: "pointer" }}>
            {saving ? "שומר…" : "שמור הצעה"}
          </button>
        </div>

        {error && <p style={{ color: "#b3261e" }}>{error}</p>}
      </form>
    </div>
  );
}

