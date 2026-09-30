"use client";

import React, { useState } from "react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const downloadBackup = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("שגיאה ביצירת גיבוי");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shisachar_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage("הגיבוי הורד בהצלחה! הקובץ כולל את כל הנתונים במסד.");
    } catch (err: any) {
      setMessage("נכשלה הורדת הגיבוי: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const rows = [
    { label: "פלטפורמה", value: "שי סחר — מערכת ניהול חכמה 3.0" },
    { label: "Framework", value: "Next.js 15 + React 19" },
    { label: "Database", value: "PostgreSQL (Neon / Supabase)" },
    { label: "ORM", value: "Prisma 5" },
    { label: "Auth", value: "NextAuth v4 + bcrypt" },
    { label: "Export & Backup", value: "Excel (XLSX), PDF (jsPDF), JSON (Backup API)" },
    { label: "Deployment", value: "Vercel / Linux Server" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="text-sm text-muted-foreground">הגדרות מערכת וגיבויים</div>
          <h1 className="text-3xl font-black">הגדרות ותחזוקה</h1>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>💾</span> גיבוי נתונים מלא
        </h2>
        <p className="text-sm text-muted-foreground">
          ניתן לייצא קובץ גיבוי בפורמט JSON הכולל את כל רשומות המערכת: לקוחות, לידים, הזמנות, מלאי, קריאות שירות, יומנים, משימות ואוטומציות.
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={downloadBackup}
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
          >
            {loading ? "מכין גיבוי..." : "📥 הורד גיבוי נתונים מלא (JSON)"}
          </button>
        </div>
        {message && <div className="text-sm font-semibold p-3 rounded-xl bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200">{message}</div>}
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>⚙️</span> ארכיטקטורת המערכת
        </h2>
        <div className="text-sm space-y-2 text-muted-foreground">
          <p><strong>שכבה 1 Core CRM:</strong> ✅ לקוחות, לידים, Pipeline, ניהול משתמשים והרשאות</p>
          <p><strong>שכבה 2 שירות ותפעול:</strong> ✅ קריאות שירות, יומן שירות והתקנות, מפת שירות</p>
          <p><strong>שכבה 3 אוטומציות ותקשורת:</strong> ✅ תזכורות סננים, אינטגרציית אימייל, פרופילי חילוץ</p>
          <p><strong>שכבה 4 ייצוא וגיבוי:</strong> ✅ הדפסה, ייצוא ל־PDF, ייצוא ל־Excel וגיבוי נתונים מלא בכל המודולים</p>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-xl font-bold">מפרט טכני</h2>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border">
                <td className="py-2.5 font-medium">{r.label}</td>
                <td className="py-2.5 text-muted-foreground">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

