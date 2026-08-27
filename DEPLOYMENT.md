# שי סחר CRM — פריסה ל-Vercel

## מה כלול
- אפליקציית Next.js עם Prisma/PostgreSQL
- CRM לקוחות ולידים
- מפת שירות עם Google Maps
- API למפת השירות
- קובץ `.env.example` ללא סודות

## הפעלה מקומית
1. העתקו `.env.example` ל-`.env.local`.
2. מלאו את `DATABASE_URL`, `NEXTAUTH_SECRET` ואת מפתח Google Maps.
3. הריצו:

```bash
npm install
npx prisma generate
npx prisma db push
npm run build
npm run dev
```

## משתני סביבה ב-Vercel
ב־Project → Settings → Environment Variables הוסיפו:

```text
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

סמנו Production, Preview ו-Development, ולאחר מכן בצעו Redeploy.

## Google Maps
ב־Google Cloud:
- הפעילו Maps JavaScript API.
- קשרו Billing לפרויקט.
- הגבילו את מפתח הדפדפן ל־HTTP referrers:
  - `http://localhost:3000/*`
  - `https://YOUR-PROJECT.vercel.app/*`
- הגבילו את המפתח ל־Maps JavaScript API (ול־Places/Geocoding אם נדרש).

## חשוב
- אין להעלות `.env` או `.env.local` ל-GitHub.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` חשוף לדפדפן ולכן חייב להיות מוגבל ב-Google Cloud.
- המפה מציגה לקוחות שיש להם `lat` ו־`lng`.

