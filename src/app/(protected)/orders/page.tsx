"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import ExportBar from "@/components/ExportBar";

type Order = any;

const emptyForm = {
  customerId: "",
  title: "",
  type: "SERVICE",
  total: "",
  discount: "",
  paymentStatus: "PENDING",
  paymentMethod: "",
  deliveryDate: "",
  scheduledAt: "",
  notes: "",
};

function toDateInput(value: string | Date | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function toDateTimeInput(value: string | Date | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [o, a] = await Promise.all([
      fetch("/api/orders").then((r) => r.json()),
      fetch("/api/order-calendar").then((r) => r.json()),
    ]);
    setOrders(o.orders || []);
    setAppointments(a.appointments || []);
  };

  useEffect(() => { load(); }, []);

  const move = async (id: string, scheduledAt: string) => {
    const response = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt }),
    });
    setMessage(response.ok ? "מועד ההזמנה עודכן והיומן סונכרן" : "לא ניתן לעדכן מועד");
    await load();
  };

  const remove = async (order: Order) => {
    if (!window.confirm(`למחוק את הזמנה ${order.orderNumber}? פעולה זו אינה הפיכה.`)) return;
    const response = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "לא ניתן למחוק את ההזמנה");
      return;
    }
    setMessage(`הזמנה ${order.orderNumber} נמחקה`);
    await load();
  };

  const exportColumns = [
    { header: "מספר הזמנה", key: "orderNumber" },
    { header: "לקוח", key: "customerName" },
    { header: "סטטוס", key: "status" },
    { header: "סכום (₪)", key: "total" },
    { header: "מועד מתוכנן", key: "scheduledAt" },
  ];

  const exportData = orders.map((o) => ({
    ...o,
    customerName: o.customer?.name || "",
    scheduledAt: o.scheduledAt ? new Date(o.scheduledAt).toLocaleString("he-IL") : "לא נקבע",
  }));

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">הזמנות</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>רשימת הזמנות, תזמון ויומן שירות והתקנות</p>
        </div>
        <button className="btn-accent" onClick={() => { setShowNew(!showNew); setEditingOrder(null); }}>הזמנה חדשה</button>
      </div>

      {message && <div className="p-3 rounded" style={{ background: "#e8f5e9", color: "#2e7d32" }}>{message}</div>}
      {showNew && <NewOrder onSaved={async () => { setShowNew(false); await load(); }} />}
      {editingOrder && <EditOrder order={editingOrder} onSaved={async () => { setEditingOrder(null); await load(); }} onCancel={() => setEditingOrder(null)} />}

      <ExportBar title="הזמנות ושירות" data={exportData} columns={exportColumns} printableId="orders-printable-table" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="card overflow-hidden">
          <div className="p-4 font-bold">רשימת הזמנות</div>
          <div className="overflow-x-auto">
            <table id="orders-printable-table" className="w-full text-sm">
              <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="text-right p-3">מספר</th><th className="text-right p-3">לקוח</th><th className="text-right p-3">סטטוס</th><th className="text-right p-3">סכום</th><th className="text-right p-3">מועד</th><th className="text-right p-3">פעולות</th>
              </tr></thead>
              <tbody>{orders.map((o) => <tr key={o.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="p-3 font-mono">{o.orderNumber}</td>
                <td className="p-3"><Link href={`/customers/${o.customerId}`} style={{ color: "var(--rust)" }}>{o.customer?.name || "—"}</Link></td>
                <td className="p-3">{o.status}</td>
                <td className="p-3 font-mono">₪{Number(o.total || 0).toLocaleString()}</td>
                <td className="p-3">{o.scheduledAt ? new Date(o.scheduledAt).toLocaleString("he-IL") : "לא נקבע"}</td>
                <td className="p-3"><div className="flex gap-2 whitespace-nowrap">
                  <button className="text-sm underline" onClick={() => { setEditingOrder(o); setShowNew(false); }}>עריכה</button>
                  <button className="text-sm underline" style={{ color: "#c62828" }} onClick={() => remove(o)}>מחיקה</button>
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
          {!orders.length && <div className="p-8 text-center" style={{ color: "var(--muted)" }}>אין הזמנות</div>}
        </section>

        <section className="card p-4">
          <div className="font-bold mb-3">יומן הזמנות — גרירה לשינוי מועד</div>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>גרור כרטיס הזמנה ליום/שעה אחרת. השינוי נשמר גם בהזמנה וגם ביומן.</p>
          <div className="grid grid-cols-5 gap-2">{Array.from({ length: 5 }).map((_, i) => {
            const d = new Date(); d.setDate(d.getDate() + i); const key = d.toISOString().slice(0, 10);
            return <div key={key} className="border rounded min-h-48 p-2" style={{ borderColor: "var(--border)" }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData("orderId"); if (id) move(id, `${key}T09:00:00`); }}>
              <div className="text-xs font-bold mb-2">{d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric" })}</div>
              {appointments.filter((a) => a.startAtUtc?.slice(0, 10) === key).map((a) => <div key={a.id} draggable onDragStart={(e) => e.dataTransfer.setData("orderId", a.orderId)} className="p-2 rounded mb-2 text-xs cursor-grab" style={{ background: "#e8f0fe" }}><strong>{a.order?.orderNumber}</strong><br />{a.customer?.name}<br />{new Date(a.startAtUtc).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>)}
            </div>;
          })}</div>
        </section>
      </div>
    </div>
  );
}

function OrderForm({ initial, submitLabel, onSaved, onCancel, orderId }: { initial: typeof emptyForm; submitLabel: string; onSaved: () => void; onCancel?: () => void; orderId?: string }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/customers").then((r) => r.json()).then((d) => setCustomers(d.customers || [])); }, []);
  const set = (key: keyof typeof emptyForm, value: string) => setF((old) => ({ ...old, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError("");
    const response = await fetch(orderId ? `/api/orders/${orderId}` : "/api/orders", { method: orderId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, total: Number(f.total || 0), discount: Number(f.discount || 0), scheduledAt: f.scheduledAt || null, deliveryDate: f.deliveryDate || null }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "שגיאה בשמירת ההזמנה"); return; }
    onSaved();
  };
  return <section className="card p-5"><div className="flex justify-between items-center mb-3"><h2 className="font-bold">{submitLabel}</h2>{onCancel && <button className="text-sm underline" onClick={onCancel}>ביטול</button>}</div>{error && <p className="mb-2" style={{ color: "#c62828" }}>{error}</p>}<form onSubmit={submit} className="grid grid-cols-2 gap-3"><select className="input-field" value={f.customerId} onChange={(e) => set("customerId", e.target.value)} required disabled={Boolean(orderId)}><option value="">בחר לקוח</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select><input className="input-field" placeholder="כותרת הזמנה" value={f.title} onChange={(e) => set("title", e.target.value)} required /><select className="input-field" value={f.type} onChange={(e) => set("type", e.target.value)}><option value="SERVICE">שירות</option><option value="INSTALLATION">התקנה</option><option value="FILTER_REPLACEMENT">החלפת סננים</option></select><input className="input-field" type="number" placeholder="סכום" value={f.total} onChange={(e) => set("total", e.target.value)} /><input className="input-field" type="number" placeholder="הנחה" value={f.discount} onChange={(e) => set("discount", e.target.value)} /><select className="input-field" value={f.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}><option value="PENDING">ממתין לתשלום</option><option value="PAID">שולם</option><option value="PARTIAL">שולם חלקית</option><option value="FAILED">נכשל</option></select><input className="input-field" placeholder="אמצעי תשלום" value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} /><input className="input-field" type="datetime-local" value={f.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} /><input className="input-field" type="date" value={f.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} /><textarea className="input-field col-span-2" placeholder="הערות" value={f.notes} onChange={(e) => set("notes", e.target.value)} /><div className="col-span-2 flex gap-2"><button className="btn-accent" type="submit">{submitLabel}</button>{onCancel && <button className="btn-secondary" type="button" onClick={onCancel}>ביטול</button>}</div></form></section>;
}

function NewOrder({ onSaved }: { onSaved: () => void }) { return <OrderForm initial={emptyForm} submitLabel="יצירת הזמנה" onSaved={onSaved} />; }

function EditOrder({ order, onSaved, onCancel }: { order: Order; onSaved: () => void; onCancel: () => void }) {
  const initial = { customerId: order.customerId || "", title: order.title || "", type: order.type || "SERVICE", total: String(order.total ?? ""), discount: String(order.discount ?? ""), paymentStatus: order.paymentStatus || "PENDING", paymentMethod: order.paymentMethod || "", deliveryDate: toDateInput(order.deliveryDate), scheduledAt: toDateTimeInput(order.scheduledAt), notes: order.notes || "" };
  return <OrderForm initial={initial} submitLabel="שמירת שינויים" orderId={order.id} onSaved={onSaved} onCancel={onCancel} />;
}

