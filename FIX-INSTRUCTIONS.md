# שי סחר — תיקון שגיאת QuoteItemType (אומת Build ✅)

## התוצאה של הבדיקה בגרסה זו
- prisma validate ✅
- prisma generate ✅ (ה-Client מייצר את QuoteItemType)
- next build ✅ BUILD_EXIT=0 — כל המסלולים עברו, כולל /quotations/[id]

## שורש הבעיה
הקוד ב-src/app/api/quotations/[id]/route.ts מייבא:
    import { QuoteStatus, QuoteItemType } from "@prisma/client";
אבל קובץ prisma/schema.prisma שנמצא כרגע ב-GitHub ישן,
ואינו מכיל את enum QuoteItemType. ה-Client שנוצר ב-Vercel
לכן אינו מייצא את ה-enum — וה-Build נכשל.

## הפתרון — להעלות ל-GitHub את כל תוכן התיקייה הזו
חובה להעלות במיוחד:
  prisma/schema.prisma      ← זה הקובץ הקריטי
  src/app/api/quotations/   ← כל התיקייה
  src/app/(protected)/quotes/ ו-quotation/ (אם קיימות)

אל תעלו: .env / .env.local / node_modules / .next

## אחרי העלאה
1. Vercel → Deployments → Redeploy (אם לא התחיל אוטומטית)
2. אם הסכמה השתנתה מול Neon — מהמחשב:
   npx.cmd prisma db push
   npx.cmd prisma generate

## בדיקה מקומית לפני Push (Windows)
npm.cmd install
npx.cmd prisma generate
npm.cmd run build
