import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
async function guard(action = "view") { const s = await getServerSession(authOptions); if (!s) return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) }; if (!can((s.user as any).role, "inventory", action)) return { error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) }; return { session: s }; }
export async function GET() { const g = await guard(); if (g.error) return g.error; const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } }); return NextResponse.json({ suppliers }); }
export async function POST(req: NextRequest) { const g = await guard("create"); if (g.error) return g.error; const b = await req.json(); if (!b.name) return NextResponse.json({ error: "שם ספק הוא שדה חובה" }, { status: 400 }); const supplier = await prisma.supplier.create({ data: { name: String(b.name).trim(), taxId: b.taxId || null, phone: b.phone || null, email: b.email || null, address: b.address || null, contactName: b.contactName || null, paymentTerms: b.paymentTerms || null, leadTimeDays: b.leadTimeDays ? Number(b.leadTimeDays) : null, rating: b.rating ? Number(b.rating) : null } }); return NextResponse.json({ supplier }, { status: 201 }); }

