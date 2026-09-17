export default function SettingsPage() {
  const rows = [
    { label: "Framework", value: "Next.js 15 + React 19" },
    { label: "Database", value: "PostgreSQL (Neon / Supabase)" },
    { label: "ORM", value: "Prisma 5" },
    { label: "Auth", value: "NextAuth v4 + bcrypt" },
    { label: "Styling", value: "Tailwind CSS" },
    { label: "Deployment", value: "Vercel" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">הגדרות</h1>
      <div className="card p-5">
        <h2 className="font-bold mb-3">ארכיטקטורת המערכת</h2>
        <div className="text-sm space-y-2" style={{ color: "var(--muted)" }}>
          <p><strong>שכבה 1 Core CRM:</strong> ✅ לקוחות, לידים, Pipeline, הרשאות</p>
          <p><strong>שכבה 2 שירות:</strong> 🔜 קריאות, טכנאים, יומן, מפה</p>
          <p><strong>שכבה 3 אוטומציות:</strong> 🔜 תזכורות, WhatsApp, מעקב</p>
          <p><strong>שכבה 4 פלטפורמה:</strong> 🔜 מלאי, מסמכים, אינטגרציות</p>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-bold mb-3">טכנולוגיות</h2>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="p-2 font-medium">{r.label}</td>
                <td className="p-2">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

