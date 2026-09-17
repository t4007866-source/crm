# שי סחר CRM — Foundation v3

מערכת שירות מלאה: לקוחות, לידים, Pipeline, פעילות, הרשאות, יומן מערכת.

## הצעד הראשון — אל תדלג

1. ודא ש־Node.js מותקן: `node -v` (מומלץ 18+)
2. התקן חבילות: `npm install`
3. צור קובץ `.env` (העתק מ־`.env.example`) עם `DATABASE_URL` אמיתי מ־Neon
4. צור טבלאות: `npm run db:push`
5. טען נתוני דמו: `npm run db:seed`
6. הפעל: `npm run dev` → http://localhost:3000/login

## פרטי כניסה

| תפקיד | אימייל | סיסמה |
|-------|--------|-------|
| מנהל | admin@shisachar.co.il | ChangeMe!2026 |
| צוות | manager@shisachar.co.il | Demo!2026 |
| מכירות | sales@shisachar.co.il | Demo!2026 |

## בדיקת תקינות

```bash
npm run verify   # prisma validate + next build
```

## מודולים ב-Foundation

- לוח בקרה (/dashboard)
- לקוחות (/customers)
- לידים (/leads)
- Pipeline (/pipeline)
- פעילות (/activity)
- יומן מערכת (/audit)
- משתמשים (/users)
- הגדרות (/settings)

## שכבות עתידיות

1. Core CRM (זה) — לקוחות, לידים, Pipeline
2. שירות — קריאות, טכנאים, יומן, מפה, מסלולים
3. אוטומציות — תזכורות סננים, אישורי WhatsApp, מעקב
4. פלטפורמה — מלאי, מסמכים, אינטגרציות, פורטל

