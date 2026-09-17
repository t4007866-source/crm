import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  try {
    const vehicles = await prisma.technicianVehicle.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("Failed to load technician vehicles:", error);
    return NextResponse.json(
      { error: "אירעה שגיאה בטעינת כלי הרכב" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const technicianId = String(body.technicianId || "").trim();
    const name = String(body.name || "").trim();
    const licensePlate = body.licensePlate
      ? String(body.licensePlate).trim()
      : null;

    if (!technicianId || !name) {
      return NextResponse.json(
        { error: "טכנאי ושם רכב הם חובה" },
        { status: 400 }
      );
    }

    const vehicle = await prisma.technicianVehicle.upsert({
      where: { technicianId },
      update: {
        name,
        licensePlate,
      },
      create: {
        technicianId,
        name,
        licensePlate,
      },
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error("Failed to save technician vehicle:", error);
    return NextResponse.json(
      { error: "אירעה שגיאה בשמירת כלי הרכב" },
      { status: 500 }
    );
  }
}

