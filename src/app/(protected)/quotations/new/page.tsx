"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type QuoteItemDraft = {
  key: string;
  productId: string | null;
  itemType: "PRODUCT" | "SERVICE" | "UPGRADE";
  name: string;
  model: string;
  description: string;
  quantity: number;
  unitPrice: number;
  isOptional: boolean;
  recommended: boolean;
};

const fmtILS = (n: number) =>
  `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

export default function NewQuotationPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [swapTarget, setSwapTarget] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [title, setTitle] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [vatPercent, setVatPercent] = useState(18);
  const [validDays, setValidDays] = useState(30);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState<QuoteItemDraft[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/products").catch(() => null),
        ]);
        const cData = await cRes.json();
        const list = Array.isArray(cData) ? cData : cData.customers || [];
        setCustomers(list);
        if (pRes && pRes.ok) {
          const pData = await pRes.json();
          setProducts(
            Array.isArray(pData) ? pData : pData.products || []
          );
        }
      } catch {}
    })();
  }, []);

  // כשבוחרים ליד — ממלאים לקוח אם קיים
  function onLeadChange(value: string) {
    setLeadId(value);
  }

  function addItem(isOptional = false, itemType: QuoteItemDraft["itemType"] = "PRODUCT") {
    setItems((prev) => [
      ...prev,
      {
        key: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productId: null,
        itemType,
        name: "",
        model: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        isOptional,
        recommended: false,
      },
    ]);
  }

  function updateItem(key: string, patch: Partial<QuoteItemDraft>) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...patch } : i))
    );
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  // החלפת דגם מהקטלוג
  function applyModel(key: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateItem(key, {
      productId,
      name: p.name,
      model: p.sku,
      description: p.description || "",
      unitPrice: p.salePrice || 0,
    });
    setSwapTarget(null);
  }

  const mainItems = items.filter((i) => !i.isOptional);
  const optionalItems = items.filter((i) => i.isOptional);
  const subtotal = mainItems.reduce(
    (s, i) => s + i.quantity * i.unitPrice,
    0
  );
  const afterDiscount = subtotal * (1 - discountPercent / 100);
  const vat = afterDiscount * (vatPercent / 100);
  const total = afterDiscount + vat;
  const optionalTotal = optionalItems.reduce(
    (s, i) => s + i.quantity * i.unitPrice,
    0
  );

  async function save() {
    if (!customerId || !title || mainItems.length === 0) {
      setError("נדרש: לקוח, כותרת ולפחות פריט אחד");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          leadId: leadId || undefined,
          title,
          discountPercent,
          vatPercent,
          validDays,
          notes,
          items: items.map((i) => ({
            productId: i.productId,
            itemType: i.itemType,
            name: i.name,
            model: i.model,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            isOptional: i.isOptional,
            recommended: i.recommended,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בשמירה");
      router.push(`/quotations/${data.quotation.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#172B4D" }}>
        הצעת מחיר חדשה
      </h1>

      {/* פרטים כלליים */}
      <Section title="פרטי ההצעה">
        <Row>
          <Field label="לקוח">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={input}
            >
              <option value="">— בחר לקוח —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `— ${c.phone}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="מקושר לליד (אופציונלי)">
            <select
              value={leadId}
              onChange={(e) => onLeadChange(e.target.value)}
              style={input}
            >
              <option value="">— ללא —</option>
              {/* לידים נטענים מהחיפוש המקושר */}
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.phone ? `— ${l.phone}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </Row>
        <Field label="כותרת ההצעה">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="לדוגמה: מערכת סינון לבית פרטי בהרצליה"
            style={input}
          />
        </Field>
        <Row>
          <Field label="הנחה (%)">
            <input
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              style={input}
            />
          </Field>
          <Field label="מע״מ (%)">
            <input
              type="number"
              value={vatPercent}
              onChange={(e) => setVatPercent(Number(e.target.value))}
              style={input}
            />
          </Field>
          <Field label="תוקף (ימים)">
            <input
              type="number"
              value={validDays}
              onChange={(e) => setValidDays(Number(e.target.value))}
              style={input}
            />
          </Field>
        </Row>
      </Section>

      {/* פריטים ראשיים */}
      <Section
        title="פריטים ראשיים"
        action={
          <button onClick={() => addItem(false)} style={btnSecondary}>
            + הוסף פריט
          </button>
        }
      >
        {mainItems.length === 0 && (
          <p style={{ color: "#8a8378", fontSize: 14 }}>
            טרם נוספו פריטים. לחץ ״הוסף פריט״ או בחר מהקטלוג.
          </p>
        )}
        {mainItems.map((item) => (
          <ItemCard
            key={item.key}
            item={item}
            products={products}
            swapTarget={swapTarget}
            setSwapTarget={setSwapTarget}
            onUpdate={updateItem}
            onRemove={removeItem}
            onApplyModel={applyModel}
          />
        ))}
      </Section>

      {/* שיפורים אופציונליים */}
      <Section
        title="── שיפורים אופציונליים ──"
        action={
          <button onClick={() => addItem(true, "UPGRADE")} style={btnSecondary}>
            + הוסף שיפור
          </button>
        }
      >
        {optionalItems.length === 0 && (
          <p style={{ color: "#8a8378", fontSize: 14 }}>
            הוסף שיפורים שהלקוח יוכל לבחור — כגון סנן משודרג, הרחבת אחריות,
            התקנה מהירה.
          </p>
        )}
        {optionalItems.map((item) => (
          <ItemCard
            key={item.key}
            item={item}
            products={products}
            swapTarget={swapTarget}
            setSwapTarget={setSwapTarget}
            onUpdate={updateItem}
            onRemove={removeItem}
            onApplyModel={applyModel}
          />
        ))}
      </Section>

      {/* הערות */}
      <Section title="הערות">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ ...input, resize: "vertical" }}
          placeholder="תנאים, הערות ללקוח…"
        />
      </Section>

      {/* סיכום */}
      <div
        style={{
          background: "#F4F0E8",
          border: "1px solid #E0D9C8",
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
        }}
      >
        <SummaryRow label="סה״כ לפני הנחה" value={fmtILS(subtotal)} />
        {discountPercent > 0 && (
          <SummaryRow
            label={`הנחה (${discountPercent}%)`}
            value={`-${fmtILS(subtotal - afterDiscount)}`}
          />
        )}
        <SummaryRow label={`מע״מ (${vatPercent}%)`} value={fmtILS(vat)} />
        <SummaryRow label="סה״כ לתשלום" value={fmtILS(total)} strong />
        {optionalTotal > 0 && (
          <SummaryRow
            label={`שיפורים אופציונליים (בנפרד)`}
            value={fmtILS(optionalTotal)}
          />
        )}
      </div>

      {error && <p style={{ color: "#C45A2A", marginTop: 12 }}>{error}</p>}

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "שומר…" : "שמור הצעה"}
        </button>
        <button
          onClick={() => router.back()}
          style={{ ...btnSecondary, background: "transparent" }}
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

/* ═══════════ כרטיס פריט ═══════════ */

function ItemCard({
  item,
  products,
  swapTarget,
  setSwapTarget,
  onUpdate,
  onRemove,
  onApplyModel,
}: any) {
  const catProducts = products.filter((p: any) => p.isActive !== false);
  return (
    <div
      style={{
        border: "1px solid #E0D9C8",
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        background: item.isOptional ? "#fdf9f3" : "#fff",
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={item.productId || ""}
          onChange={(e) => onApplyModel(item.key, e.target.value)}
          style={{ ...input, flex: 2, minWidth: 160 }}
        >
          <option value="">— בחר מהקטלוג —</option>
          {catProducts.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.sku ? `(${p.sku})` : ""} — {fmtILS(p.salePrice)}
            </option>
          ))}
        </select>
        <input
          value={item.description}
          onChange={(e) => onUpdate(item.key, { description: e.target.value })}
          placeholder="תיאור חופשי"
          style={{ ...input, flex: 2, minWidth: 160 }}
        />
        <input
          type="number"
          value={item.quantity}
          min={1}
          onChange={(e) => onUpdate(item.key, { quantity: Number(e.target.value) })}
          style={{ ...input, width: 70 }}
          title="כמות"
        />
        <input
          type="number"
          value={item.unitPrice}
          onChange={(e) => onUpdate(item.key, { unitPrice: Number(e.target.value) })}
          style={{ ...input, width: 100 }}
          title="מחיר יחידה"
        />
        <button
          onClick={() =>
            setSwapTarget(swapTarget === item.key ? null : item.key)
          }
          style={{ ...btnSecondary, background: "transparent" }}
          title="החלף דגם"
        >
          החלף דגם ▾
        </button>
        <button
          onClick={() => onUpdate(item.key, { recommended: !item.recommended })}
          style={{
            ...btnSecondary,
            background: item.recommended ? "#2e7d32" : "transparent",
            color: item.recommended ? "#fff" : "#5c564a",
          }}
          title="סמן כשיפור מומלץ"
        >
          ★
        </button>
        <button
          onClick={() => onRemove(item.key)}
          style={{ ...btnSecondary, color: "#C45A2A" }}
          title="הסר"
        >
          ✕
        </button>
      </div>

      {/* רשימת דגמים להחלפה */}
      {swapTarget === item.key && (
        <div
          style={{
            marginTop: 8,
            border: "1px solid #E0D9C8",
            borderRadius: 8,
            background: "#fff",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {catProducts.length === 0 && (
            <p style={{ padding: 10, fontSize: 13, color: "#8a8378" }}>
              הקטלוג ריק או ש־/api/products לא זמין
            </p>
          )}
          {catProducts.map((p: any) => {
            const more = p.salePrice > item.unitPrice;
            const less = p.salePrice < item.unitPrice;
            return (
              <button
                key={p.id}
                onClick={() => onApplyModel(item.key, p.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 12px",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #F4F0E8",
                  cursor: "pointer",
                  textAlign: "right",
                  fontSize: 14,
                }}
              >
                <span>
                  {p.name} {p.sku ? `— ${p.sku}` : ""}
                </span>
                <span>
                  {fmtILS(p.salePrice)}{" "}
                  {more && <span style={{ color: "#2e7d32" }}>↑ שדרוג</span>}
                  {less && <span style={{ color: "#C45A2A" }}>↓ הוזלה</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 13, color: "#8a8378" }}>
        סה״כ שורה: {fmtILS(item.quantity * item.unitPrice)}
        {item.isOptional && " · אופציונלי"}
        {item.recommended && " · מומלץ"}
      </div>
    </div>
  );
}

/* ═══════════ רכיבים ═══════════ */

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#172B4D" }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{children}</div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, minWidth: 180, marginBottom: 8 }}>
      <label style={{ fontSize: 13, color: "#5c564a", display: "block", marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
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

const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #E0D9C8",
  borderRadius: 8,
  fontSize: 14,
  background: "#fff",
  color: "#172B4D",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  background: "#C45A2A",
  color: "#fff",
  border: "none",
  padding: "12px 24px",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 15,
};

const btnSecondary: React.CSSProperties = {
  background: "#F4F0E8",
  color: "#172B4D",
  border: "1px solid #E0D9C8",
  padding: "8px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
};

