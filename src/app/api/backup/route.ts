import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "לא מורשה" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "הרשאה נדרשת: ADMIN" }, { status: 403 });
  }

  try {
    const backupData = {
      version: "3.0.0",
      exportedAt: new Date().toISOString(),
      exportedBy: session.user?.email,
      data: {
        users: await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true } }),
        customers: await prisma.customer.findMany(),
        leads: await prisma.lead.findMany(),
        orders: await prisma.order.findMany({ include: { items: true } }),
        inventory: await prisma.inventoryItem.findMany(),
        serviceCalls: await prisma.serviceCall.findMany(),
        appointments: await prisma.appointment.findMany(),
        tasks: await prisma.task.findMany(),
        automations: await prisma.automation.findMany(),
      }
    };

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="shisachar_backup_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "שגיאה ביצירת גיבוי", details: error.message }, { status: 500 });
  }
}

