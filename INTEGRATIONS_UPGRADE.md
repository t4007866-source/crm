# מרכז אינטגרציות — שי סחר

הגרסה הזו מוסיפה שכבת אינטגרציות שאינה משנה את מודולי הלקוחות, הלידים, ההזמנות, השירות, המפה והיומנים הקיימים.

## מסכים

- `/integrations` — מרכז חיבורים, Logs, שגיאות ו־API/Webhooks.
- `/integrations/email-mapping` — פרופילי מיפוי לפי דומיין או שולח, תצוגה מקדימה ונרמול.
- `/integrations/health` — בריאות וזמני תגובה.

## כתובות API

- `GET/POST/PATCH/DELETE /api/integrations/connections` — חיבורים עם הגדרות מוצפנות.
- `GET/POST /api/integrations/health` — בדיקות בריאות.
- `GET /api/integrations/errors` — תקלות הדורשות טיפול.
- `POST /api/webhooks/:key` — Webhooks נכנסים עם חתימה, Idempotency ותור.
- `GET/POST /api/v1/leads` — API חיצוני עם API Key והרשאות `leads:read`, `leads:create`.
- `GET/POST/DELETE /api/v1/keys` — ניהול מפתחות API; הסוד מוצג פעם אחת בלבד.

## משתני סביבה חדשים

- `INTEGRATION_ENCRYPTION_KEY` — מפתח הצפנת AES-256-GCM להגדרות ספקים.
- `EMAIL_INGEST_SECRET` — סוד קליטת אימיילים.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — מפתח מפה ציבורי מוגבל לדומיין.
- `GOOGLE_ROUTES_API_KEY` — מפתח Routes בצד השרת.

## פריסה

1. הגדר את משתני הסביבה ב־Vercel (Production, Preview ו־Development לפי הצורך).
2. הרץ מול Neon: `npx prisma db push`.
3. פרוס מחדש ב־Vercel.

אין להכניס `.env` ל־GitHub. Logs מחזירים רק מזהים, סטטוסים ו־4 ספרות אחרונות; Tokens, סיסמאות ו־Connection Strings אינם מוצגים.

