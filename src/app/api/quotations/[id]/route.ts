import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";

// סוגי פריטים — מוגדרים כרשימת ערכים כדי שנוכל גם לבדוק חברות בזמן ריצה
const QuoteItemTypes = [
  "PRODUCT",
  "SERVICE",
  "UPGRADE",
  "PART",
  "LABOR",
  "DISCOUNT",
  "OTHER",
] as const;
type QuoteItemType = (typeof QuoteItemTypes)[number];

const isQuoteItemType = (v: string): v is QuoteItemType =>
  (QuoteItemTypes as readonly string[]).includes(v);

// ערכים מהממשק שאינם סוג פריט תקין ימופו ל־PRODUCT
const ALLOWED_ITEM_TYPES = new Set<string>(QuoteItemTypes);

// GET /api/quotations/[id] — הצעה מלאה כולל היסטוריה וגרסאות
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }
  try {
    const { id } = await params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        customer: { select: { id: true, name: true, phone: true } },
        items: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "הצעה לא נמצאה" }, { status: 404 });
    }

    return NextResponse.json({ quotation: quote });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "שגיאה בטעינת הצעה" },
      { status: 500 }
    );
  }
}

// PUT /api/quotations/[id] — עדכון פריטים / החלפת דגם / הנחה / סטטוס
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }
  try {
    const { id } = await params;

    // ברירת מחדל {} במקום null — body.status לא יפיל את השרת
    const body = await req.json().catch(() => ({}));

    const existing = await prisma.quote.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "הצעה לא נמצאה" }, { status: 404 });
    }

    // Prisma Client בסביבה הזו אינו מסונכרן עדיין עם כל שדות ה-schema.
    // נשתמש בתצוגת תאימות מקומית כדי למנוע שגיאות TypeScript עד generate מלא.
    const existingCompat = existing as any;

    // תאימות לטיפוס Prisma Client.
    const existingItems = existing.items as unknown as Array<{
      id: string;
      productId?: string | null;
      model?: string | null;
      unitPrice: number;
    }>;

    // שינוי סטטוס בלבד (DRAFT / SENT / VIEWED / ACCEPTED / DECLINED / EXPIRED)
    const statusValue = body.status
      ? String(body.status).toUpperCase()
      : null;
    const isValidStatus =
      statusValue &&
      (Object.values(QuoteStatus) as string[]).includes(statusValue);
    if (isValidStatus) {
      const data: any = { status: statusValue as QuoteStatus };
      if (statusValue === "SENT") data.sentAt = new Date();
      if (statusValue === "VIEWED") data.viewedAt = new Date();

      const updated = await prisma.quote.update({ where: { id }, data });

      // אישור הצעה על ליד — סימון quoteStatus על הליד
      if (statusValue === "ACCEPTED" && existingCompat.leadId) {
        await prisma.lead.update({
          where: { id: existingCompat.leadId },
          data: { quoteStatus: "ACCEPTED" } as any,
        });
      }

      return NextResponse.json({ quotation: updated });
    }

    // עדכון פריטים — כולל החלפת דגם
    // items: [{ id, productId, itemType, name, model, description, quantity, unitPrice, isOptional, recommended }]
    if (Array.isArray(body.items)) {
      const changes: any[] = [];

      // כל עדכון הפריטים רץ בטרנזקציה אחת —
      // או שהכול מתבצע (מחיקות + עדכונים + הוספות + היסטוריה + חישוב מחדש), או שכלום.
      // בגרסה הקודמת כשל באמצע הותיר את ההצעה במצב חלקי.
      const quotation = await prisma.$transaction(async (tx) => {
        // היסטוריית החלפות דגם ושינויי מחיר
        for (const incoming of body.items) {
          if (!incoming?.id) continue;
          const old = existingItems.find((i) => i.id === incoming.id);
          if (!old) continue;
          const modelChanged =
            incoming.productId != null && incoming.productId !== old.productId;
          const priceChanged =
            incoming.unitPrice != null &&
            Number(incoming.unitPrice) !== Number(old.unitPrice);

          if (modelChanged || priceChanged) {
            changes.push({
              quoteId: id,
              itemId: old.id,
              changeType: modelChanged ? "MODEL_SWAPPED" : "PRICE_CHANGED",
              oldProductId: old.productId,
              newProductId: incoming.productId || null,
              oldModel: old.model,
              newModel: incoming.model || null,
              oldPrice: Number(old.unitPrice),
              newPrice: Number(incoming.unitPrice ?? old.unitPrice),
              note: body.changeNote || null,
              createdById: body.createdById || null,
            });
          }
        }

        // מחיקת פריטים שהוסרו
        const keepIds = new Set(
          body.items.filter((i: any) => i?.id).map((i: any) => i.id)
        );
        const removed = existingItems.filter((i) => !keepIds.has(i.id));
        if (removed.length > 0) {
          await tx.quoteItem.deleteMany({
            where: { id: { in: removed.map((i) => i.id) } },
          });
          for (const r of removed) {
            changes.push({
              quoteId: id,
              itemId: r.id,
              changeType: "REMOVED",
              oldProductId: r.productId,
              oldModel: r.model,
              oldPrice: Number(r.unitPrice),
              createdById: body.createdById || null,
            });
          }
        }

        // עדכון / הוספה
        let sortIdx = 0;
        for (const incoming of body.items) {
          const qtyRaw = Number(incoming?.quantity ?? 1);
          const priceRaw = Number(incoming?.unitPrice ?? 0);
          // הגבלת קלט: מספר סופי ולא שלילי
          const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
          const price =
            Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : 0;

          const rawType = String(
            incoming?.itemType || "PRODUCT"
          ).toUpperCase();
          const itemType: QuoteItemType =
            ALLOWED_ITEM_TYPES.has(rawType) && isQuoteItemType(rawType)
              ? rawType
              : "PRODUCT";

          const itemData: any = {
            productId: incoming?.productId || null,
            itemType,
            name: incoming?.name || null,
            model: incoming?.model || null,
            description: incoming?.description || "",
            quantity: qty,
            unitPrice: price,
            total: qty * price,
            isOptional: Boolean(incoming?.isOptional),
            recommended: Boolean(incoming?.recommended),
            sortOrder: incoming?.sortOrder ?? sortIdx,
          };
          if (
            incoming?.id &&
            existingItems.some((i) => i.id === incoming.id)
          ) {
            await tx.quoteItem.update({
              where: { id: incoming.id },
              data: itemData,
            });
          } else {
            await tx.quoteItem.create({
              data: { ...itemData, quoteId: id },
            });
            changes.push({
              quoteId: id,
              itemId: incoming?.id || "new",
              changeType: "ADDED",
              newProductId: itemData.productId,
              newModel: itemData.model,
              newPrice: price,
              createdById: body.createdById || null,
            });
          }
          sortIdx++;
        }

        // שמירת היסטוריה — לא תפיל את העדכון הראשי אם המודל עדיין לא קיים
        // ב-Prisma Client שנוצר בסביבה הנוכחית. ה-schema.prisma כן כולל אותו.
        if (changes.length > 0) {
          const historyModel = (tx as any).quoteItemHistory;
          if (historyModel?.createMany) {
            await historyModel.createMany({ data: changes }).catch(() => {});
          }
        }

        // חישוב מחדש
        // Prisma Client בסביבה הנוכחית ישן יותר מה-schema ולכן הטיפוס שלו
        // לא מכיר עדיין את isOptional. השדה קיים בפועל ב-schema ובמסד.
        // שימוש ב-any כאן מבודד את חוסר הסנכרון בלי cast לא בטוח בין שני טיפוסים.
        const allItems: Array<{ total: number; isOptional?: boolean }> =
          await (tx.quoteItem as any).findMany({
            where: { quoteId: id },
          });
        const subtotal = allItems
          .filter((i) => !Boolean(i.isOptional))
          .reduce((s, i) => s + Number(i.total), 0);
        const discountRaw =
          body.discountPercent != null
            ? Number(body.discountPercent)
            : Number(existingCompat.discountPercent);
        const discountPercent = Number.isFinite(discountRaw)
          ? Math.min(Math.max(discountRaw, 0), 100)
          : 0;
        const vatRaw =
          body.vatPercent != null
            ? Number(body.vatPercent)
            : Number(existingCompat.vatPercent);
        const vatPercent = Number.isFinite(vatRaw)
          ? Math.min(Math.max(vatRaw, 0), 100)
          : 0;
        const afterDiscount = subtotal * (1 - discountPercent / 100);
        const tax = afterDiscount * (vatPercent / 100);
        const total = afterDiscount + tax;

        return tx.quote.update({
          where: { id },
          data: {
            subtotal,
            discountPercent,
            vatPercent,
            totalBeforeDiscount: subtotal,
            tax,
            total,
            notes: body.notes != null ? String(body.notes) : existingCompat.notes,
          } as any,
          include: { items: { orderBy: { id: "asc" } } },
        });
      });

      return NextResponse.json({ quotation });
    }

    return NextResponse.json(
      { error: "אין נתונים לעדכון" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "שגיאה בעדכון הצעה" },
      { status: 500 }
    );
  }
}

// POST /api/quotations/[id] — יצירת גרסה חדשה (v2) מבלי לדרוס את המקור
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const sourceRaw = await prisma.quote.findUnique({
      where: { id },
      include: { items: true },
    });
    const source = sourceRaw as any;
    if (!source) {
      return NextResponse.json({ error: "הצעה לא נמצאה" }, { status: 404 });
    }

    // אותה שכבת תאימות נדרשת גם ליצירת גרסה חדשה.
    const sourceCompat = source as any;

    // שמירת צילום מצב של הגרסה הנוכחית — המרה ל-JSON תקין (ללא אובייקטי Date)
    await (prisma as any).quoteVersion.create({
      data: {
        quoteId: sourceCompat.id,
        version: sourceCompat.version,
        snapshot: JSON.parse(
          JSON.stringify(source, (_k, v) =>
            v instanceof Date ? v.toISOString() : v
          )
        ),
        note: body.note || `צילום v${sourceCompat.version} לפני יצירת גרסה חדשה`,
        createdById: body.createdById || null,
      } as any,
    });

    // גרסה חדשה — העתקה מלאה
    const newVersion = sourceCompat.version + 1;
    const year = new Date().getFullYear();

    // מספור עם הגנה מפני כפילויות (רייס):
    // בגרסה הקודמת הבדיקה בוצעה פעם אחת בלבד — כשל unique היה מפיל את הבקשה.
    const count = await prisma.quote.count();
    let number = `QT-${year}-${String(count + 1).padStart(4, "0")}-v${newVersion}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = await prisma.quote.findUnique({ where: { number } });
      if (!taken) break;
      number = `QT-${year}-${String(count + 1).padStart(4, "0")}-v${newVersion}-${Date.now().toString(36)}${attempt > 0 ? `-${attempt}` : ""}`;
    }

    const copy = await prisma.quote.create({
      data: {
        number,
        customerId: sourceCompat.customerId,
        leadId: sourceCompat.leadId,
        title: sourceCompat.title,
        status: "DRAFT",
        version: newVersion,
        parentQuoteId: sourceCompat.id,
        subtotal: sourceCompat.subtotal,
        discountPercent: sourceCompat.discountPercent,
        tax: sourceCompat.tax,
        vatPercent: sourceCompat.vatPercent,
        totalBeforeDiscount: sourceCompat.totalBeforeDiscount,
        total: sourceCompat.total,
        currency: sourceCompat.currency,
        validUntil: sourceCompat.validUntil,
        notes: sourceCompat.notes,
        createdById: body.createdById || sourceCompat.createdById,
        items: {
          create: (sourceCompat.items as any[])
            .slice()
            .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
            .map((i, idx) => ({
              productId: i.productId ?? null,
              itemType: i.itemType ?? "PRODUCT",
              name: i.name ?? null,
              model: i.model ?? null,
              description: i.description ?? "",
              quantity: Number(i.quantity ?? 1),
              unitPrice: Number(i.unitPrice ?? 0),
              total: Number(i.total ?? 0),
              isOptional: Boolean(i.isOptional),
              recommended: Boolean(i.recommended),
              sortOrder: i.sortOrder ?? idx,
            })),
        },
      } as any,
      include: { items: true },
    });

    return NextResponse.json({ quotation: copy }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "שגיאה ביצירת גרסה חדשה" },
      { status: 500 }
    );
  }
}

