import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    take: 30,
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">יומן מערכת</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "#fafaf7" }}>
              <th className="text-right p-3">זמן</th>
              <th className="text-right p-3">משתמש</th>
              <th className="text-right p-3">פעולה</th>
              <th className="text-right p-3">רשומה</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center" style={{ color: "var(--muted)" }}>
                  אין רשומות
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="p-3 text-xs" style={{ color: "var(--muted)" }}>
                    {new Date(log.createdAt).toLocaleString("he-IL")}
                  </td>
                  <td className="p-3">{log.user?.name || "—"}</td>
                  <td className="p-3">{log.action}</td>
                  <td className="p-3">
                    {log.entity} {log.entityId ? `(${log.entityId})` : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

