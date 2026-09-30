# שדרוג מודול האוטומציות — שלב 1

השדרוג מוסיף שכבת אוטומציות בטוחה מעל המודולים הקיימים, בלי לבצע פעולות עסקיות ישירות בתוך הטריגר.

## מה נוסף

- מצבי עבודה: `DRAFT`, `TEST_PREVIEW`, `ACTIVE`, `PAUSED`.
- תהליך: Trigger → תנאים → פעולות → אישור/ביצוע → Audit Log.
- תבניות התחלתיות ללידים, שירות, החלפת סננים ומלאי.
- מסך ניטור עם ריצות, הצלחות, כשלים, טיוטות והמתנות לאישור.
- Preview בטוח: לא שולח WhatsApp, לא משנה מלאי ולא משנה סטטוסים.
- `idempotencyKey` ייחודי למניעת הרצות כפולות.
- רישום `AutomationVersion` לכל שמירה.
- רישום `AuditLog` ליצירה, עריכה, הפעלה, השהיה ו-Preview.
- הפעלת אוטומציה מוגבלת ל-Admin/Manager.

## API חדש

- `GET/POST/PUT /api/automations`
- `GET/POST /api/automations/runs`

## פריסת הסכמה

לאחר גיבוי בסיס הנתונים, הרץ מול Neon:

```bash
npx prisma db push
npx prisma generate
```

בפרודקשן יש להגדיר `DATABASE_URL`, `NEXTAUTH_SECRET` ו-`NEXTAUTH_URL` ב-Vercel. אין להעלות `.env` ל-GitHub.

## המשך מומלץ

השלב הבא הוא Approval Inbox אמיתי, ולאחריו worker/cron שמבצע רק פעולות מאושרות דרך שירותי הדומיין הקיימים — ללא עקיפת הרשאות, מניעת כפילויות או Audit Log.

