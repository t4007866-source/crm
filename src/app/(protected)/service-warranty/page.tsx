"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Filter = "ALL" | "ACTIVE" | "EXPIRED" | "MISSING" | "DUE_SOON" | "OVERDUE";

const labels: Record<string, string> = {
  ACTIVE: "בתוקף",
  EXPIRED: "פג תוקף",
  MISSING: "לא הוגדרה",
  DUE_SOON: "קרוב לביצוע",
  OVERDUE: "באיחור",
  PLANNED: "מתוכנן",
  NOT_SET: "לא הוגדר",
  RENEW_SOON: "חידוש קרוב",
  NO_END_DATE: "ללא תאריך סיום",
};

const badgeClass: Record<string, string> = {
  ACTIVE: "badge-active",
  EXPIRED: "badge-churned",
  MISSING: "badge-lead",
  DUE_SOON: "badge-prospect",
  OVERDUE: "badge-churned",
  PLANNED: "badge-active",
  RENEW_SOON: "badge-prospect",
};

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "—";
}

function Kpi({ title, value, tone }: { title: string; value: number; tone?: string }) {
  return <div className="card p-4"><div className="text-sm" style={{ color: "var(--muted)" }}>{title}</div><div className="text-2xl font-bold mt-2" style={{ color: tone }}>{value}</div></div>;
}

export default function WarrantyServicePage() {
  const [data, setData] = useState<any>({ warrantyItems: [], insuranceItems: [], summary: {} });
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"systems" | "insurance">("systems");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/warranty-service")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "לא ניתן לטעון את נתוני האחריות והשירות");
        setData(body);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "שגיאה בטעינת הנתונים"))
      .finally(() => setLoading(false));
  }, []);

  const systems = useMemo(() => data.warrantyItems.filter((item: any) => {
    const text = `${item.customer?.name || ""} ${item.customer?.phone || ""} ${item.customer?.city || ""} ${item.systemType || ""} ${item.model || ""}`.toLowerCase();
    const matchesQuery = !query || text.includes(query.toLowerCase());
    const matchesFilter = filter === "ALL" || item.warrantyStatus === filter || item.serviceStatus === filter;
    return matchesQuery && matchesFilter;
  }), [data.warrantyItems, filter, query]);

  const insurance = useMemo(() => data.insuranceItems.filter((item: any) => {
    const text = `${item.name || ""} ${item.phone || ""} ${item.city || ""} ${item.serviceInsurancePlan || ""}`.toLowerCase();
    return !query || text.includes(query.toLowerCase());
  }), [data.insuranceItems, query]);

  const s = data.summary || {};
  return <div className="max-w-7xl mx-auto space-y-5" dir="rtl">
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <div><h1 className="text-2xl font-bold">אחריות ושירות</h1><p className="text-sm" style={{ color: "var(--muted)" }}>ניהול אחריות יצרן, אחריות שירות, תכניות שירות והחלפות סננים</p></div>
      <div className="flex gap-2"><Link href="/service-calendar" className="btn-primary">יומן שירות</Link><Link href="/customers" className="btn-accent">לקוחות</Link></div>
    </div>

    {error && <div className="p-3 rounded" style={{ background: "#ffebee", color: "#b42318" }}>{error}</div>}
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      <Kpi title="מערכות" value={s.totalSystems || 0} />
      <Kpi title="אחריות בתוקף" value={s.activeWarranties || 0} tone="#2e7d32" />
      <Kpi title="אחריות שפגה" value={s.expiredWarranties || 0} tone="#b42318" />
      <Kpi title="חסרה אחריות" value={s.missingWarranty || 0} tone="#795548" />
      <Kpi title="סננים בקרוב" value={s.filterDueSoon || 0} tone="#c77700" />
      <Kpi title="סננים באיחור" value={s.filterOverdue || 0} tone="#b42318" />
      <Kpi title="תכניות שירות" value={s.insuredCustomers || 0} tone="#3f7cac" />
      <Kpi title="קריאות פתוחות" value={s.openCalls || 0} tone="#7657d9" />
    </div>

    <div className="card p-3 flex flex-wrap gap-2 items-center">
      <input className="input-field" style={{ minWidth: 260 }} placeholder="חיפוש לקוח, טלפון, דגם או עיר" value={query} onChange={(e) => setQuery(e.target.value)} />
      <select className="input-field" style={{ width: 190 }} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
        <option value="ALL">כל הסטטוסים</option><option value="ACTIVE">אחריות בתוקף</option><option value="EXPIRED">אחריות שפגה</option><option value="MISSING">אחריות חסרה</option><option value="DUE_SOON">סננים בקרוב</option><option value="OVERDUE">סננים באיחור</option>
      </select>
      <div className="mr-auto flex rounded border overflow-hidden" style={{ borderColor: "var(--border)" }}><button className="px-3 py-2 text-sm" style={{ background: tab === "systems" ? "var(--ink)" : "white", color: tab === "systems" ? "white" : "var(--ink)" }} onClick={() => setTab("systems")}>מערכות ואחריות</button><button className="px-3 py-2 text-sm" style={{ background: tab === "insurance" ? "var(--ink)" : "white", color: tab === "insurance" ? "white" : "var(--ink)" }} onClick={() => setTab("insurance")}>תכניות שירות</button></div>
    </div>

    {loading ? <div className="card p-8 text-center">טוען נתוני אחריות ושירות...</div> : tab === "systems" ? <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b" style={{ borderColor: "var(--border)", background: "#fafaf7" }}><th className="p-3 text-right">לקוח</th><th className="p-3 text-right">מערכת</th><th className="p-3 text-right">אחריות יצרן</th><th className="p-3 text-right">אחריות שירות</th><th className="p-3 text-right">החלפת סננים</th><th className="p-3 text-right">פעולות</th></tr></thead><tbody>{systems.map((item: any) => <tr key={item.id} className="border-b" style={{ borderColor: "var(--border)" }}><td className="p-3"><Link href={`/customers/${item.customer.id}`} className="font-medium hover:underline" style={{ color: "var(--rust)" }}>{item.customer.name}</Link><div className="text-xs" style={{ color: "var(--muted)" }}>{item.customer.city || ""} · {item.customer.phone}</div></td><td className="p-3"><strong>{item.systemType}</strong><div className="text-xs">{item.model}{item.serialNumber ? ` · ${item.serialNumber}` : ""}</div></td><td className="p-3"><span className={`badge ${badgeClass[item.manufacturerDays !== null && item.manufacturerDays >= 0 ? "ACTIVE" : item.manufacturerWarrantyUntil ? "EXPIRED" : "MISSING"]}`}>{item.manufacturerWarrantyUntil ? `${labels[item.manufacturerDays !== null && item.manufacturerDays >= 0 ? "ACTIVE" : "EXPIRED"]} עד ${date(item.manufacturerWarrantyUntil)}` : labels.MISSING}</span></td><td className="p-3"><span className={`badge ${badgeClass[item.warrantyStatus]}`}>{labels[item.warrantyStatus]}{item.warrantyUntil ? ` · ${date(item.warrantyUntil)}` : ""}</span></td><td className="p-3"><span className={`badge ${badgeClass[item.serviceStatus] || ""}`}>{labels[item.serviceStatus]}{item.nextFilterChangeDate ? ` · ${date(item.nextFilterChangeDate)}` : ""}</span></td><td className="p-3"><Link href={`/customers/${item.customer.id}`} className="underline">כרטיס לקוח</Link><span className="mx-2">·</span><Link href="/service-calendar" className="underline">יומן שירות</Link></td></tr>)}</tbody></table>{!systems.length && <p className="p-8 text-center" style={{ color: "var(--muted)" }}>לא נמצאו מערכות לפי הסינון</p>}</div> : <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b" style={{ borderColor: "var(--border)", background: "#fafaf7" }}><th className="p-3 text-right">לקוח</th><th className="p-3 text-right">תכנית</th><th className="p-3 text-right">תאריכים</th><th className="p-3 text-right">מחיר חודשי</th><th className="p-3 text-right">סטטוס</th><th className="p-3 text-right">פעולה</th></tr></thead><tbody>{insurance.map((item: any) => <tr key={item.id} className="border-b" style={{ borderColor: "var(--border)" }}><td className="p-3"><Link href={`/customers/${item.id}`} className="font-medium hover:underline" style={{ color: "var(--rust)" }}>{item.name}</Link><div className="text-xs" style={{ color: "var(--muted)" }}>{item.city || ""} · {item.phone}</div></td><td className="p-3">{item.serviceInsurancePlan || "תכנית שירות"}</td><td className="p-3">{date(item.serviceInsuranceStartDate)} — {date(item.serviceInsuranceEndDate)}</td><td className="p-3">{item.serviceInsuranceMonthlyPrice == null ? "—" : `₪${Number(item.serviceInsuranceMonthlyPrice).toLocaleString("he-IL")}`}</td><td className="p-3"><span className={`badge ${badgeClass[item.status] || ""}`}>{labels[item.status]}</span></td><td className="p-3"><Link href={`/customers/${item.id}`} className="underline">עריכת תכנית</Link></td></tr>)}</tbody></table>{!insurance.length && <p className="p-8 text-center" style={{ color: "var(--muted)" }}>לא נמצאו תכניות שירות</p>}</div>}
  </div>;
}

