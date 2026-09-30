# מודול הצעות מחיר — שי סחר CRM

## מה נוסף
1. **schema.prisma** — סכמה מעודכנת (החלף את הקובץ הקיים ב-prisma/schema.prisma):
   - Quote מורחב: leadId, version, parentQuoteId, discountPercent, vatPercent, totalBeforeDiscount, sentAt, viewedAt
   - QuoteItem מורחב: productId, itemType, name, model, isOptional, recommended, sortOrder
   - QuoteItemHistory — היסטוריית החלפות דגם ומחירים
   - QuoteVersion — צילומי גרסאות (v1, v2...)
   - QuoteStatus + VIEWED, enum QuoteItemType חדש

2. **src/app/api/quotations/route.ts** — GET רשימה + POST יצירה (עם חישוב הנחה/מע"מ)
3. **src/app/api/quotations/[id]/route.ts** — GET פרטים, PUT עדכון פריטים/החלפת דגם/סטטוס, POST יצירת גרסה חדשה
4. **src/app/(protected)/quotations/page.tsx** — רשימת הצעות עם סינון סטטוס
5. **src/app/(protected)/quotations/new/page.tsx** — בונה הצעה: קטלוג, החלפת דגם (↑שדרוג/↓הוזלה), שיפורים אופציונליים, סיכום דינמי
6. **src/app/(protected)/quotations/[id]/page.tsx** — כרטיס הצעה: סטטוסים, היסטוריית שינויים, יצירת גרסה

## התקנה (ב-C:\shisachar-crm)
1. העתק את prisma/schema.prisma במקום הקיים
2. העתק את תיקיית src לתוך src הקיים (מיזוג)
3. ב-PowerShell:
   npx.cmd prisma db push
   npx.cmd prisma generate
   npm.cmd run build

## הערות
- הדף 'new' קורא ל-/api/products (הקטלוג הקיים) ול-/api/customers. אם הנתיב שונה אצלך — עדכן בשורות ה-fetch.
- הנחה מעל 20% דורשת אישור אדמין — החוק ימומש בשלב הבא ב-PUT/POST.
- אישור הצעה מסומן גם על הליד המקושר (quoteStatus=ACCEPTED).
