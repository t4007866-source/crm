"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ExportBar from "@/components/ExportBar";

const stageLabels: Record<string, string> = { NEW: "חדש", CONTACTED: "נוצר קשר", QUALIFIED: "מוכשר", PROPOSAL: "הצעה נשלחה", NEGOTIATION: "משא ומתן", WON: "הומר / הזמנה", LOST: "לא רלוונטי" };
const sourceLabels: Record<string, string> = { WEBSITE: "טופס אתר", GMAIL: "אימייל", WHATSAPP: "WhatsApp", FACEBOOK: "Facebook", INSTAGRAM: "Instagram", REFERRAL: "הפניה", COLD_CALL: "טלפון", OTHER: "אחר" };
const stageOrder = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
const scoreFor = (lead: any) => lead.score ?? (lead.confidence === "HIGH" ? 86 : lead.confidence === "MEDIUM" ? 62 : 31);
const ageMinutes = (lead: any) => Math.max(0, Math.round((Date.now() - new Date(lead.createdAt).getTime()) / 60000));
const ageText = (minutes: number) => minutes < 60 ? `לפני ${minutes} דקות` : minutes < 1440 ? `לפני ${Math.floor(minutes / 60)} שעות` : `לפני ${Math.floor(minutes / 1440)} ימים`;

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [confidence, setConfidence] = useState("");
  const [view, setView] = useState<"queue" | "list" | "kanban">("queue");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyUnworked, setOnlyUnworked] = useState(false);
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);

  const reload = async () => {
    setLoading(true); setError("");
    try { const response = await fetch("/api/leads", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "לא ניתן לטעון לידים"); setLeads(data.leads || []); }
    catch (e) { setError(e instanceof Error ? e.message : "שגיאה בטעינת לידים"); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const text = `${lead.name} ${lead.phone || ""} ${lead.email || ""} ${lead.city || ""} ${lead.company || ""} ${JSON.stringify(lead.interests || "")}`.toLowerCase();
      return (!q || text.includes(q)) && (!stage || lead.stage === stage) && (!source || lead.source === source) && (!confidence || lead.confidence === confidence) && (!onlyUnworked || (lead.stage === "NEW" && !lead.contactAttemptsCount)) && (!onlyDuplicates || lead.possibleDuplicate);
    });
  }, [leads, query, stage, source, confidence, onlyUnworked, onlyDuplicates]);

  const stats = useMemo(() => ({
    today: leads.filter((l) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length,
    unworked: leads.filter((l) => l.stage === "NEW" && !l.contactAttemptsCount).length,
    hot: leads.filter((l) => scoreFor(l) >= 75 && l.stage !== "WON" && l.stage !== "LOST").length,
    waiting24: leads.filter((l) => ageMinutes(l) > 1440 && l.stage !== "WON" && l.stage !== "LOST").length,
    duplicates: leads.filter((l) => l.possibleDuplicate).length,
    avgResponse: leads.length ? Math.round(leads.reduce((sum, l) => sum + Math.min(ageMinutes(l), 1440), 0) / leads.length) : 0,
  }), [leads]);

  const selected = filtered.find((lead) => lead.id === selectedId) || filtered[0] || null;
  const exportColumns = [{ header: "שם ליד", key: "name" }, { header: "טלפון", key: "phone" }, { header: "עיר", key: "city" }, { header: "מקור", key: "source" }, { header: "שלב", key: "stage" }, { header: "איכות", key: "confidence" }, { header: "ציון", key: "score" }];
  const clearFilters = () => { setQuery(""); setStage(""); setSource(""); setConfidence(""); setOnlyUnworked(false); setOnlyDuplicates(false); };

  return <div dir="rtl" className="space-y-4">
    <div className="flex justify-between items-center gap-3 flex-wrap"><div><h1 className="text-2xl font-bold">מרכז קליטת לידים</h1><p className="text-sm" style={{ color: "var(--muted)" }}>קליטה, נירמול, תיעדוף, הקצאה והמרה — בלי לשנות את תהליך הליד הקיים</p></div><div className="flex gap-2"><Link href="/leads/new" className="btn-accent">+ ליד</Link><button type="button" className="btn-primary" onClick={reload}>רענן</button></div></div>
    {error && <div className="p-3 rounded bg-red-50 text-red-800">{error}</div>}

    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Kpi label="לידים חדשים היום" value={stats.today} onClick={() => { clearFilters(); setStage("NEW"); }} />
      <Kpi label="ללא טיפול" value={stats.unworked} tone="orange" onClick={() => { clearFilters(); setOnlyUnworked(true); }} />
      <Kpi label="לידים חמים" value={stats.hot} tone="orange" onClick={() => { clearFilters(); setConfidence("HIGH"); }} />
      <Kpi label="ממתינים מעל 24 שעות" value={stats.waiting24} tone="red" onClick={() => { clearFilters(); setStage("NEW"); }} />
      <Kpi label="כפילויות אפשריות" value={stats.duplicates} tone="purple" onClick={() => { clearFilters(); setOnlyDuplicates(true); }} />
      <Kpi label="זמן המתנה ממוצע" value={stats.avgResponse ? `${stats.avgResponse} דק׳` : "—"} />
    </div>

    <div className="card p-3 space-y-3 sticky top-0 z-10">
      <div className="flex gap-2 flex-wrap items-center"><input className="input-field flex-1 min-w-[220px]" placeholder="חיפוש שם / טלפון / אימייל / עיר" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="input-field w-auto" value={stage} onChange={(e) => setStage(e.target.value)}><option value="">כל הסטטוסים</option>{stageOrder.map((key) => <option key={key} value={key}>{stageLabels[key]}</option>)}</select><select className="input-field w-auto" value={source} onChange={(e) => setSource(e.target.value)}><option value="">כל המקורות</option>{Object.entries(sourceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select className="input-field w-auto" value={confidence} onChange={(e) => setConfidence(e.target.value)}><option value="">כל רמות האיכות</option><option value="HIGH">חם</option><option value="MEDIUM">בינוני</option><option value="LOW">קר</option></select><button type="button" className="px-3 py-2 rounded border text-sm" onClick={clearFilters}>נקה מסננים</button></div>
      <div className="flex justify-between items-center gap-2 flex-wrap"><div className="flex gap-2"><button type="button" onClick={() => setView("queue")} className={`px-3 py-1.5 rounded text-sm ${view === "queue" ? "bg-slate-900 text-white" : "border"}`}>תור עבודה</button><button type="button" onClick={() => setView("list")} className={`px-3 py-1.5 rounded text-sm ${view === "list" ? "bg-slate-900 text-white" : "border"}`}>רשימה</button><button type="button" onClick={() => setView("kanban")} className={`px-3 py-1.5 rounded text-sm ${view === "kanban" ? "bg-slate-900 text-white" : "border"}`}>Kanban</button><Link href="/service-map" className="px-3 py-1.5 rounded text-sm border">מפת לידים ולקוחות</Link></div><span className="text-sm" style={{ color: "var(--muted)" }}>{filtered.length} מתוך {leads.length} לידים</span></div>
    </div>

    <ExportBar title="לידים נכנסים" data={filtered.map((l) => ({ ...l, score: scoreFor(l), source: sourceLabels[l.source] || l.source, stage: stageLabels[l.stage] || l.stage }))} columns={exportColumns} printableId="leads-printable-table" />

    {view === "kanban" ? <Kanban leads={filtered} select={setSelectedId} /> : <div className="grid grid-cols-1 xl:grid-cols-5 gap-4"><div className="xl:col-span-3 space-y-3">{loading ? <div className="card p-10 text-center">טוען...</div> : filtered.length === 0 ? <div className="card p-10 text-center" style={{ color: "var(--muted)" }}>אין לידים תואמים</div> : filtered.map((lead) => <LeadCard key={lead.id} lead={lead} selected={selected?.id === lead.id} select={() => setSelectedId(lead.id)} />)}</div><LeadPreview lead={selected} /></div>}

    <div className="card overflow-hidden hidden"><table id="leads-printable-table"><tbody>{filtered.map((lead) => <tr key={lead.id}><td>{lead.name}</td><td>{lead.phone}</td><td>{lead.city}</td><td>{lead.source}</td><td>{lead.stage}</td><td>{lead.confidence}</td><td>{scoreFor(lead)}</td></tr>)}</tbody></table></div>
  </div>;
}

function Kpi({ label, value, tone = "blue", onClick }: { label: string; value: string | number; tone?: string; onClick?: () => void }) { const colors: Record<string, string> = { blue: "#1d4ed8", orange: "#c2410c", red: "#b91c1c", purple: "#7e22ce" }; return <button type="button" onClick={onClick} className="card p-4 text-right hover:shadow-md transition-shadow" style={{ borderTop: `3px solid ${colors[tone] || colors.blue}` }}><div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div><div className="text-2xl font-black mt-1">{value}</div>{onClick && <div className="text-xs mt-1" style={{ color: colors[tone] || colors.blue }}>לחץ להצגת הרשימה ←</div>}</button>; }

function LeadCard({ lead, selected, select }: { lead: any; selected: boolean; select: () => void }) { const score = scoreFor(lead); return <button type="button" onClick={select} className="card w-full p-4 text-right transition-shadow hover:shadow-md" style={{ borderRight: `4px solid ${score >= 75 ? "#ea580c" : score >= 50 ? "#2563eb" : "#94a3b8"}`, outline: selected ? "2px solid #1d4ed8" : undefined }}><div className="flex justify-between gap-3"><div><div className="font-bold text-lg">{lead.name}</div><div className="text-sm font-mono">{lead.phone || "ללא טלפון"} <span className="font-sans">· {lead.city || "ללא עיר"}</span></div><div className="text-sm mt-1" style={{ color: "var(--muted)" }}>{Array.isArray(lead.interests) ? lead.interests.join(", ") : "עניין לא צוין"} · {sourceLabels[lead.source] || lead.source}</div></div><div className="text-left"><div className="text-2xl font-black" style={{ color: score >= 75 ? "#c2410c" : "#1d4ed8" }}>{score}<span className="text-xs">/100</span></div><div className="text-xs">{lead.confidence === "HIGH" ? "חם" : lead.confidence === "MEDIUM" ? "בינוני" : "קר"}</div></div></div><div className="flex flex-wrap gap-2 items-center mt-3 text-xs"><span className="badge">{stageLabels[lead.stage] || lead.stage}</span><span>{ageText(ageMinutes(lead))}</span><span>{lead.assignedTo?.name || "ממתין להקצאה"}</span><span>{lead.contactAttemptsCount || 0} ניסיונות קשר</span>{lead.possibleDuplicate && <span className="badge bg-purple-100 text-purple-800">כפילות אפשרית</span>}</div><div className="flex gap-2 mt-3"><a href={`tel:${lead.phone || ""}`} onClick={(e) => e.stopPropagation()} className="px-2 py-1 rounded bg-slate-100 text-xs">התקשר</a><a href={`https://wa.me/${String(lead.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="px-2 py-1 rounded bg-green-100 text-xs">WhatsApp</a><Link href={`/leads/${lead.id}`} onClick={(e) => e.stopPropagation()} className="px-2 py-1 rounded bg-blue-100 text-xs">פתח ליד</Link></div></button>; }

function LeadPreview({ lead }: { lead: any }) { if (!lead) return <div className="card p-8 xl:col-span-2" style={{ color: "var(--muted)" }}>בחר ליד כדי לראות פרטים, פעילות ו־Follow-up.</div>; const score = scoreFor(lead); return <aside className="card p-5 xl:col-span-2 space-y-4 xl:sticky xl:top-24 self-start"><div className="flex justify-between items-start"><div><div className="text-xs" style={{ color: "var(--muted)" }}>תצוגת ליד</div><h2 className="text-2xl font-bold">{lead.name}</h2><div className="text-sm">{lead.phone || "ללא טלפון"} · {lead.email || "ללא אימייל"}</div></div><div className="text-center"><div className="text-3xl font-black text-orange-700">{score}</div><div className="text-xs">ציון איכות</div></div></div><div className="grid grid-cols-2 gap-3 text-sm"><Info label="סטטוס" value={stageLabels[lead.stage] || lead.stage} /><Info label="מקור" value={sourceLabels[lead.source] || lead.source} /><Info label="נציג" value={lead.assignedTo?.name || "ממתין להקצאה"} /><Info label="זמן המתנה" value={ageText(ageMinutes(lead))} /><Info label="עיר" value={lead.city || "—"} /><Info label="ניסיונות קשר" value={String(lead.contactAttemptsCount || 0)} /></div><div className="rounded-lg bg-slate-50 p-3 text-sm"><div className="font-bold mb-2">למה הציון?</div><div>+25 טלפון תקין</div><div>{lead.name?.trim().includes(" ") ? "+15 שם מלא" : "−15 חסר שם משפחה"}</div><div>{lead.email ? "+10 אימייל תקין" : "−10 חסר אימייל"}</div><div>{lead.city ? "+10 עיר קיימת" : "−10 חסרה עיר"}</div><div>{lead.interests ? "+15 מוצר/עניין זוהה" : "−15 לא זוהה עניין"}</div></div>{lead.possibleDuplicate && <div className="rounded-lg bg-purple-50 text-purple-900 p-3 text-sm">נמצאה התאמה אפשרית לפי טלפון. בדוק לפני יצירת לקוח נוסף.</div>}<div className="flex gap-2 flex-wrap"><a href={`tel:${lead.phone || ""}`} className="btn-primary">התקשר</a><a href={`https://wa.me/${String(lead.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-accent">WhatsApp</a><Link href={`/leads/${lead.id}`} className="btn-primary">פרטים, פעילות ו־Follow-up</Link></div>{lead.nextFollowUp && <div className="text-sm border-t pt-3">Follow-up הבא: {new Date(lead.nextFollowUp.scheduledAt).toLocaleString("he-IL")}</div>}</aside>; }

function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div><div className="font-medium">{value}</div></div>; }

function Kanban({ leads, select }: { leads: any[]; select: (id: string) => void }) { return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 gap-3 overflow-x-auto">{stageOrder.map((stage) => <div key={stage} className="card p-3 min-h-[260px]"><div className="font-bold border-b pb-2 mb-2">{stageLabels[stage]} <span className="text-xs" style={{ color: "var(--muted)" }}>({leads.filter((l) => l.stage === stage).length})</span></div><div className="space-y-2">{leads.filter((l) => l.stage === stage).map((lead) => <button type="button" key={lead.id} onClick={() => select(lead.id)} className="w-full text-right rounded border p-2 text-sm hover:bg-slate-50"><div className="font-semibold">{lead.name}</div><div className="text-xs">{lead.city || "—"} · {scoreFor(lead)}/100</div><div className="text-xs" style={{ color: "var(--muted)" }}>{sourceLabels[lead.source] || lead.source}</div></button>)}</div></div>)}</div>; }

