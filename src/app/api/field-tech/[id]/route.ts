import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const user = session.user as any;
  const { id } = await params;
  const body = await req.json();
  const before = await prisma.serviceCall.findUnique({ where: { id }, include: { customer: true, installedSystem: true } });
  if (!before) return NextResponse.json({ error: "קריאה לא נמצאה" }, { status: 404 });
  const canSeeAll = ["ADMIN", "MANAGER", "DISPATCHER"].includes(user.role);
  if (!canSeeAll && before.technicianId !== user.id) return NextResponse.json({ error: "אין הרשאה לקריאה זו" }, { status: 403 });

  const completed = body.status === "COMPLETED";
  const parts = Array.isArray(body.partsUsed) ? body.partsUsed : undefined;
  const nextDate = body.nextFilterChangeDate ? new Date(body.nextFilterChangeDate) : undefined;
  const updated = await prisma.$transaction(async (tx) => {
    const call = await tx.serviceCall.update({ where: { id }, data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.treatmentNotes !== undefined ? { treatmentNotes: body.treatmentNotes || null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      ...(parts !== undefined ? { partsUsed: parts } : {}),
      ...(body.inspectionChecklist !== undefined ? { inspectionChecklist: body.inspectionChecklist } : {}),
      ...(body.beforePhotos !== undefined ? { beforePhotos: body.beforePhotos } : {}),
      ...(body.afterPhotos !== undefined ? { afterPhotos: body.afterPhotos } : {}),
      ...(body.signatureDataUrl !== undefined ? { signatureDataUrl: body.signatureDataUrl || null } : {}),
      ...(body.pressureReading !== undefined ? { pressureReading: body.pressureReading || null } : {}),
      ...(body.leakCheck !== undefined ? { leakCheck: body.leakCheck === null ? null : Boolean(body.leakCheck) } : {}),
      ...(completed ? { completedAt: before.completedAt || new Date() } : {}),
    }, include: { customer: true, installedSystem: true, technician: { select: { id: true, name: true, phone: true } } } });

    if (completed && before.status !== "COMPLETED" && parts?.length) {
      for (const part of parts) {
        if (!part.productId || !part.quantity || !part.warehouseId) continue;
        const item = await tx.inventoryItem.findUnique({ where: { productId_warehouseId: { productId: part.productId, warehouseId: part.warehouseId } } });
        if (!item || item.quantityOnHand - item.quantityReserved < Number(part.quantity)) throw new Error(`אין מלאי מספיק עבור ${part.name || part.productId}`);
        await tx.inventoryItem.update({ where: { id: item.id }, data: { quantityOnHand: { decrement: Number(part.quantity) } } });
        await tx.stockMovement.create({ data: { productId: part.productId, warehouseId: part.warehouseId, type: "CONSUMPTION", quantity: Number(part.quantity), reference: call.callNumber, note: "צריכה מקריאת שירות", createdById: user.id } });
      }
    }

    if (completed) {
      await tx.activity.create({ data: { customerId: before.customerId, userId: user.id, type: "SYSTEM", subject: `${call.callNumber} — ${call.type} הושלם`, description: [call.treatmentNotes, call.pressureReading ? `לחץ: ${call.pressureReading}` : null, call.leakCheck === false ? "נמצאה נזילה" : call.leakCheck === true ? "בדיקת נזילות תקינה" : null, parts?.length ? `חלפים: ${JSON.stringify(parts)}` : null].filter(Boolean).join("\n") } });
      if (nextDate && call.installedSystemId) await tx.installedSystem.update({ where: { id: call.installedSystemId }, data: { nextFilterChangeDate: nextDate, ...(body.equipment ? { model: body.equipment.model || undefined, serialNumber: body.equipment.serialNumber || undefined, technicianTips: body.equipment.technicianTips || undefined } : {}) } });
    }
    await tx.auditLog.create({ data: { userId: user.id, action: completed && before.status !== "COMPLETED" ? "FIELD_CLOSEOUT" : "FIELD_EDIT", entity: "ServiceCall", entityId: id, before: before as any, after: call as any } });
    return call;
  });
  return NextResponse.json({ call: updated });
}

