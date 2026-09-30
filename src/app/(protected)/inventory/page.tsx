"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ExportBar from "@/components/ExportBar";

const links = [["products", "מוצרים"], ["services", "שירותים"], ["warehouses", "מחסנים"], ["movements", "תנועות מלאי"], ["low-stock", "מלאי נמוך"], ["suppliers", "ספקים"], ["pricing", "מחירונים"]];
export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]); const [products, setProducts] = useState<any[]>([]); const [tab, setTab] = useState("stock"); const [error, setError] = useState("");
  const load = () => Promise.all([fetch("/api/inventory").then(r => r.json()), fetch("/api/inventory/products").then(r => r.json())]).then(([a, b]) => { setItems(a.items || []); setProducts(b.products || []); }).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);
  const low = items.filter(i => Number(i.quantityOnHand) - Number(i.quantityReserved) <= Number(i.reorderPoint || i.product?.reorderPoint || 0));
  const out = items.filter(i => Number(i.quantityOnHand) - Number(i.quantityReserved) <= 0);
  const value = items.reduce((s, i) => s + Number(i.quantityOnHand || 0) * Number(i.product?.costPrice || 0), 0);
  const exportColumns = [{ header: "שם מוצר", key: "productName" }, { header: "מק״ט", key: "sku" }, { header: "מחסן", key: "warehouseName" }, { header: "זמין", key: "available" }, { header: "נקודת הזמנה", key: "reorderPoint" }];
  const exportData = (tab === "low" ? low : items).map(i => ({ ...i, productName: i.product?.name || "", sku: i.product?.sku || "", warehouseName: i.warehouse?.name || "", available: Number(i.quantityOnHand || 0) - Number(i.quantityReserved || 0), reorderPoint: i.reorderPoint || i.product?.reorderPoint || 0 }));
  return <div className="space-y-5"><div className="flex justify-between items-center"><div><h1 className="text-2xl font-bold">מלאי ושירותים</h1><p className="text-sm" style={{ color: "var(--muted)" }}>קטלוג, מחסנים, תנועות, עלויות ורווחיות</p></div><Link href="/inventory/products" className="btn-accent">מוצר/שירות חדש</Link></div>{error && <div className="p-3 rounded bg-red-50 text-red-700">{error}</div>}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4"><Kpi title="סה״כ מוצרים" value={products.length} /><Kpi title="שווי מלאי" value={`₪${value.toLocaleString("he-IL")}`} /><Kpi title="מלאי נמוך" value={low.length} /><Kpi title="מוצרים שאזלו" value={out.length} /><Kpi title="שורות מלאי" value={items.length} /></div>
    <div className="card p-3 flex gap-2 flex-wrap">{links.map(([href, label]) => <Link key={href} href={`/inventory/${href}`} className="px-3 py-2 rounded border hover:bg-black/5">{label}</Link>)}</div>
    <ExportBar title="מצב מלאי" data={exportData} columns={exportColumns} printableId="inventory-printable-table" />
    <div className="card p-2 flex gap-2"><button onClick={() => setTab("stock")} className="px-4 py-2 rounded" style={{ background: tab === "stock" ? "var(--ink)" : "transparent", color: tab === "stock" ? "#fff" : "var(--muted)" }}>מלאי לפי מחסן</button><button onClick={() => setTab("low")} className="px-4 py-2 rounded" style={{ background: tab === "low" ? "var(--ink)" : "transparent", color: tab === "low" ? "#fff" : "var(--muted)" }}>מלאי נמוך</button></div>
    <div className="card overflow-hidden"><table id="inventory-printable-table" className="w-full text-sm"><thead><tr className="border-b"><th className="p-3 text-right">מוצר</th><th className="p-3 text-right">מק״ט</th><th className="p-3 text-right">מחסן</th><th className="p-3 text-right">בפועל</th><th className="p-3 text-right">שמור</th><th className="p-3 text-right">זמין</th><th className="p-3 text-right">סף</th></tr></thead><tbody>{(tab === "low" ? low : items).map(i => <tr key={i.id} className="border-b"><td className="p-3">{i.product?.name}</td><td className="p-3 font-mono">{i.product?.sku}</td><td className="p-3">{i.warehouse?.name}</td><td className="p-3">{i.quantityOnHand}</td><td className="p-3">{i.quantityReserved}</td><td className="p-3 font-bold">{Number(i.quantityOnHand) - Number(i.quantityReserved)}</td><td className="p-3">{i.reorderPoint || i.product?.reorderPoint || 0}</td></tr>)}</tbody></table>{!items.length && <p className="p-8 text-center" style={{ color: "var(--muted)" }}>עדיין לא נוצרו פריטי מלאי.</p>}</div></div>;
}
function Kpi({ title, value }: { title: string; value: string | number }) { return <div className="card p-4"><div className="text-sm" style={{ color: "var(--muted)" }}>{title}</div><div className="text-2xl font-bold mt-2">{value}</div></div>; }

