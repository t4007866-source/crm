import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
async function guard(action = "view") { const s = await getServerSession(authOptions); if (!s) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) }; if (!can((s.user as any).role, "inventory", action)) return { error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) }; return { session: s }; }
export async function GET() { const g = await guard(); if (g.error) return g.error; const warehouses = await prisma.warehouse.findMany({ include: { inventory: { include: { product: true } } }, orderBy: { name: "asc" } }); return NextResponse.json({ warehouses }); }
export async function POST(req: NextRequest) { const g = await guard("create"); if (g.error) return g.error; const b = await req.json(); if (!b.name) return NextResponse.json({ error: "שם מחסן הוא שדה חובה" }, { status: 400 }); const warehouse = await prisma.warehouse.create({ data: { name: b.name, address: b.address || null, phone: b.phone || null, managerName: b.managerName || null } }); return NextResponse.json({ warehouse }, { status: 201 }); }

