# שכבת הרשאות תוספתית — שי סחר

השדרוג שומר על `Role`, `User.permissions`, `src/lib/permissions.ts`, נתיבי ה-API והתפקידים הקיימים. הוא מוסיף שכבות חדשות בלי למחוק או להחליף מידע קיים.

## מה נוסף

- קטלוג הרשאות מפורט לפי `module.action`, כולל לקוחות, לידים, הזמנות, מלאי, שירות, דוחות, WhatsApp ואוטומציות.
- `PermissionDefinition` — קטלוג הרשאות במסד הנתונים.
- `CustomRole` ו-`CustomRolePermission` — תפקידים מותאמים עם פעולות, scope, תנאים וכללי שדות.
- `UserRoleAssignment` — הקצאת תפקיד מותאם למשתמש, עם תאריך תפוגה אפשרי.
- `TemporaryPermission` — הרשאה זמנית עם התחלה, סיום, סיבה ומעניק.
- `src/lib/access-control.ts` — `hasPermission`, `canAccessRecord`, `canViewField`, scope והרשאות זמניות.
- מסך `/access` הורחב ליצירת תפקידים מותאמים והקצאתם, לצד מסך ההרשאות הישן.
- API מנהל מאובטח:
  - `GET/POST/PATCH/DELETE /api/access/roles`
  - `GET/POST/DELETE /api/access/temporary`
- פעולות השינוי נרשמות ב-`AuditLog` הקיים.
- `prisma/seed.ts` יוצר את קטלוג ההרשאות ב-upsert, בלי לשנות משתמשים קיימים.

## הפעלה

1. פרוס את הקוד כרגיל.
2. מול מסד הנתונים הקיים הרץ:

```bash
npx prisma db push
npx prisma generate
```

3. אם משתמשים ב-seed, אפשר להריץ אותו שוב; הרשאות הקטלוג עושות upsert והמשתמשים הקיימים נשמרים.

## תאימות לאחור

אם למשתמש אין תפקיד מותאם או הרשאה חדשה, `hasPermission` חוזר להרשאות המובנות ב-`src/lib/permissions.ts` ול-`User.permissions`. התפקידים המובנים לא שונו.

## שלב המשך מומלץ

להוסיף קריאות `hasPermission` ו-`canAccessRecord` לכל Route עסקי, לפי סדר סיכון: ייצוא, מחיקה, שינוי הרשאות, WhatsApp/אוטומציות, פיננסים, ולאחר מכן שאר פעולות הקריאה והעריכה.

