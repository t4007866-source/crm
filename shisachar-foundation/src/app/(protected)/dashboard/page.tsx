import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalCustomers, activeCustomers, totalLeads, openDeals] =
    await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { status: "ACTIVE" } }),
      prisma.lead.count(),
      prisma.deal.count({ where: { status: "OPEN" } }),
    ]);

  const kpis = [
    { label: "סך לקוחות", value: totalCustomers, color: "#172b4d" },
    { label: "לקוחות פעילים", value: activeCustomers, color: "#4caf50" },
    { label: "לידים פתוחים", value: totalLeads, color: "#e8a547" },
    { label: "עסקאות פתוחות", value: openDeals, color: "#4a90d9" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">לוח בקרה</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <div className="text-sm mb-1" style={{ color: "var(--muted)" }}>
              {kpi.label}
            </div>
            <div className="text-3xl font-bold font-mono" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <p style={{ color: "var(--muted)" }}>
          ברוך הבא למערכת שי סחר. בחר מודול מהתפריט כדי להתחיל.
        </p>
      </div>
    </div>
  );
}

