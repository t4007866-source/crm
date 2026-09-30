# שי סחר — תיקון Build (קליטת לידים ציבורית)

## תוצאות הבדיקה
- prisma/schema.prisma שלך תקין (prisma validate ✅, prisma generate ✅) — לא שיניתי אותו.
- הבעיה הייתה בקוד: src/app/api/public/leads/route.ts לא תאם את הסכמה:
  1. Lead.name הוא שדה חובה ולא הועבר.
  2. source הועבר כמחרוזת חופשית במקום enum LeadSource.
  3. utmData לא עמד בטיפוס InputJsonValue.
- הקובץ המתוקן אומת מול הסכמה שלך בדיוק: tsc --noEmit עובר ללא שגיאות.

## איך לשלב
1. העתק את src/app/api/public/leads/route.ts במקום הקובץ הקיים בפרויקט שלך.
2. אם קיים קובץ src/lib/prisma.ts — ניתן להחליף בגרסה שכאן (תומך גם import { prisma } וגם import prisma default).
3. prisma/schema.prisma כאן זהה לשלך — אין חובה להחליף.

## אימות מקומי לפני Push (Windows PowerShell)
npm.cmd run build

## אחרי הצלחת Build
git add .
git commit -m "Fix public leads route to match schema v3"
git push
Vercel תבצע Build אוטומטי.

## משתנה נדרש
PUBLIC_API_KEY ב-Vercel (Production) — ואז Redeploy.
שימוש: הדר POST ל-/api/public/leads עם header x-api-key.
