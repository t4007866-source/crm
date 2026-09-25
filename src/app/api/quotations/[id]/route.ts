import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";

// סוגי פריטים מותרים — מונע ערכים לא תקינים מהממשק
const ALLOWED_ITEM_TYPES = new Set([
  "PRODUCT",
  "SERVICE",
  "PART",
  "LABOR",
  "DISCOUNT",
  "OTHER",
]);

// GET /api/quotations/[id] — הצעה מלאה כולל היסטוריה וגרסאות
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quotation = await prisma.quote.findUnique({
      where: { id },
      include: {
        customer: true,
        lead: true,
        createdBy: { select: { id: true, name: true } },
        items: { orderBy: { sortOrder: "asc" } },
        itemHistory: { orderBy: { createdAt: "desc" } },
        snapshots: { orderBy: { version: "desc" } },
        versions: {
          // רק שדות שקיימים בוודאות במודל QuoteVersion — מונע שגיאת 500 שקטה
          select: { id: true, version: true, note: true, createdAt: true },
          orderBy: { version: "desc" },
        },
      },
    });
    if (!quotation) {
      return NextResponse.json({ error: "הצעה לא נמצאה" }, { status: 404 });
    }
    return NextResponse.json({ quotation });
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
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const existing = await prisma.quote.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "הצעה לא נמצאה" }, { status: 404 });
    }

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
      if (statusValue === "ACCEPTED" && existing.leadId) {
        await prisma.lead
          .update({
            where: { id: existing.leadId },
            data: {
              quoteStatus: "ACCEPTED",
              quoteSentAt: existing.sentAt ?? undefined,
            },
          })
          .catch(() => {});
      }
      return NextResponse.json({ quotation: updated });
    }

    // עדכון פריטים — כולל החלפת דגם
    // items: [{ id, productId, itemType, name, model, description, quantity, unitPrice, isOptional, recommended }]
    if (Array.isArray(body.items)) {
      const changes: any[] = [];

      // היסטוריית החלפות דגם
      for (const incoming of body.items) {
        if (!incoming?.id) continue;
        const old = existing.items.find((i) => i.id === incoming.id);
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
      const removed = existing.items.filter((i) => !keepIds.has(i.id));
      if (removed.length > 0) {
        await prisma.quoteItem.deleteMany({
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
        const qty = Number.isFinite(qtyRaw) ? qtyRaw : 1;
        const price = Number.isFinite(priceRaw) ? priceRaw : 0;

        // תיקון: הקוד הקודם ביצע Object.values("PRODUCT") שמפרק את המחרוזת
        // לאותיות בודדות — מה שגרם לכל פריט להישמר כ-PRODUCT.
        const rawType = String(incoming?.itemType || "PRODUCT").toUpperCase();
        const itemType = ALLOWED_ITEM_TYPES.has(rawType)
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
        if (incoming?.id && existing.items.some((i) => i.id === incoming.id)) {
          await prisma.quoteItem.update({
            where: { id: incoming.id },
            data: itemData,
          });
        } else {
          await prisma.quoteItem.create({
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

      // שמירת היסטוריה — לא תפיל את העדכון הראשי אם נכשלת (למשל FK)
      if (changes.length > 0) {
        await prisma.quoteItemHistory
          .createMany({ data: changes })
          .catch(() => {});
      }

      // חישוב מחדש
      const allItems = await prisma.quoteItem.findMany({ where: { quoteId: id } });
      const subtotal = allItems
        .filter((i) => !i.isOptional)
        .reduce((s, i) => s + Number(i.total), 0);
      const discountRaw =
        body.discountPercent != null
          ? Number(body.discountPercent)
          : Number(existing.discountPercent);
      const discountPercent = Number.isFinite(discountRaw) ? discountRaw : 0;
      const vatRaw =
        body.vatPercent != null
          ? Number(body.vatPercent)
          : Number(existing.vatPercent);
      const vatPercent = Number.isFinite(vatRaw) ? vatRaw : 0;
      const afterDiscount = subtotal * (1 - discountPercent / 100);
      const tax = afterDiscount * (vatPercent / 100);
      const total = afterDiscount + tax;

      const updated = await prisma.quote.update({
        where: { id },
        data: {
          subtotal,
          discountPercent,
          vatPercent,
          totalBeforeDiscount: subtotal,
          tax,
          total,
          notes: body.notes != null ? body.notes : existing.notes,
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });

      return NextResponse.json({ quotation: updated });
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
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const source = await prisma.quote.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!source) {
      return NextResponse.json({ error: "הצעה לא נמצאה" }, { status: 404 });
    }

    // שמירת צילום מצב של הגרסה הנוכחית — המרה ל-JSON תקין (ללא אובייקטי Date)
    await prisma.quoteVersion.create({
      data: {
        quoteId: source.id,
        version: source.version,
        snapshot: JSON.parse(
          JSON.stringify(source, (_k, v) =>
            v instanceof Date ? v.toISOString() : v
          )
        ),
        note: body.note || `צילום v${source.version} לפני יצירת גרסה חדשה`,
        createdById: body.createdById || null,
      },
    });

    // גרסה חדשה — העתקה מלאה
    const newVersion = source.version + 1;
    const year = new Date().getFullYear();

    // מספור עם הגנה מפני כפילויות (רייס)
    const count = await prisma.quote.count();
    let number = `QT-${year}-${String(count + 1).padStart(4, "0")}-v${newVersion}`;
    const numberTaken = await prisma.quote.findUnique({ where: { number } });
    if (numberTaken) {
      // התנגשות — מוסיפים סיומת ייחודית
      number = `QT-${year}-${String(count + 1).padStart(4, "0")}-v${newVersion}-${Date.now().toString(36)}`;
    }

    const copy = await prisma.quote.create({
      data: {
        number,
        customerId: source.customerId,
        leadId: source.leadId,
        title: source.title,
        status: "DRAFT",
        version: newVersion,
        parentQuoteId: source.id,
        subtotal: source.subtotal,
        discountPercent: source.discountPercent,
        tax: source.tax,
        vatPercent: source.vatPercent,
        totalBeforeDiscount: source.totalBeforeDiscount,
        total: source.total,
        currency: source.currency,
        validUntil: source.validUntil,
        notes: source.notes,
        createdById: body.createdById || source.createdById,
        items: {
          create: source.items.map((i, idx) => ({
            productId: i.productId,
            itemType: i.itemType,
            name: i.name,
            model: i.model,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
            isOptional: i.isOptional,
            recommended: i.recommended,
            sortOrder: i.sortOrder ?? idx,
          })),
        },
      },
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

