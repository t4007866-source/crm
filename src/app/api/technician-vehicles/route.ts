import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Temporary endpoint until TechnicianVehicle is added to prisma/schema.prisma.
 * Do not call prisma.technicianVehicle here unless the model exists in the
 * Prisma schema and Prisma Client has been regenerated.
 */
function unavailableResponse() {
  return NextResponse.json(
    {
      error:
        "ניהול כלי רכב לטכנאים אינו זמין עדיין: חסר המודל TechnicianVehicle בסכמת Prisma",
      code: "TECHNICIAN_VEHICLE_MODEL_MISSING",
    },
    { status: 501 },
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  return unavailableResponse();
}

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  return unavailableResponse();
}

