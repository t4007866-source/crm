import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const activities = await prisma.activity.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">פעילות</h1>
      <div className="card p-5">
        {activities.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>אין פעילות עדיין</p>
        ) : (
          <ul className="space-y-2">
            {activities.map((a) => (
              <li key={a.id} className="text-sm border-b pb-2" style={{ borderColor: "var(--border)" }}>
                <div className="font-medium">{a.subject}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {a.type} • {a.customer?.name || "—"} •{" "}
                  {new Date(a.createdAt).toLocaleString("he-IL")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

