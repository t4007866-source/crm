import { hash } from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prismaClient = new PrismaClient();

async function main() {
  console.log("=== שי סחר CRM — Seed מתחיל ===\n");

  const adminPassword = await hash("ChangeMe!2026", 12);
  const demoPassword = await hash("Demo!2026", 12);

  // משתמשים
  const admin = await prismaClient.user.upsert({
    where: { email: "admin@shisachar.co.il" },
    update: {},
    create: {
      email: "admin@shisachar.co.il",
      name: "מנהל ראשי",
      phone: "050-0000000",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isActive: true,
      emailVerified: new Date(),
    },
  });
  console.log("✓ מנהל ראשי:", admin.email);

  await prismaClient.user.upsert({
    where: { email: "manager@shisachar.co.il" },
    update: {},
    create: {
      email: "manager@shisachar.co.il",
      name: "מנהל צוות",
      passwordHash: demoPassword,
      role: Role.MANAGER,
      isActive: true,
      emailVerified: new Date(),
    },
  });
  console.log("✓ מנהל צוות");

  await prismaClient.user.upsert({
    where: { email: "sales@shisachar.co.il" },
    update: {},
    create: {
      email: "sales@shisachar.co.il",
      name: "נציג מכירות",
      passwordHash: demoPassword,
      role: Role.SALES_REP,
      isActive: true,
      emailVerified: new Date(),
    },
  });
  console.log("✓ נציג מכירות");

  // לקוחות דמו (8)
  const customers = [
    { name: "דני כהן", company: "כהן תעשיות בע\"מ", phone: "052-1234567", email: "dani@cohen.co.il", city: "תל אביב", status: "ACTIVE", source: "REFERRAL", lat: 32.0853, lng: 34.7818 },
    { name: "רותי לוי", company: "לוי שיווק", phone: "054-7654321", email: "ruti@levi.co.il", city: "חיפה", status: "PROSPECT", source: "WEBSITE", lat: 32.794, lng: 34.989 },
    { name: "אבי מזרחי", company: "מזרחי הנדסה", phone: "050-9876543", email: "avi@miz.co.il", city: "באר שבע", status: "ACTIVE", source: "FACEBOOK", lat: 31.2518, lng: 34.7913 },
    { name: "מירב שפירא", company: "שפירא אחזקות", phone: "053-3456789", email: "mirav@sh.co.il", city: "ירושלים", status: "LEAD", source: "WHATSAPP", lat: 31.7683, lng: 35.2137 },
    { name: "עומר אברהם", company: "אברהם בע\"מ", phone: "052-1112233", email: "omer@av.co.il", city: "נתניה", status: "ACTIVE", source: "INSTAGRAM", lat: 32.3215, lng: 34.8532 },
    { name: "שירה דגן", company: "דגן טכנולוגיות", phone: "054-5556677", email: "shira@dagan.co.il", city: "רעננה", status: "PROSPECT", source: "COLD_CALL", lat: 32.184, lng: 34.871 },
    { name: "יוסי ביטון", company: "ביטון שירותים", phone: "050-7778899", email: "yossi@bit.co.il", city: "אשדוד", status: "CHURNED", source: "REFERRAL", lat: 31.8044, lng: 34.6553 },
    { name: "נועה רוזן", company: "רוזן מים", phone: "053-2223344", email: "noa@rosen.co.il", city: "כפר סבא", status: "LEAD", source: "WEBSITE", lat: 32.175, lng: 34.906 },
  ];

  for (const c of customers) {
    await prismaClient.customer.upsert({
      where: { phone: c.phone },
      update: {},
      create: { ...c, createdById: admin.id } as any,
    });
  }
  console.log("✓ 8 לקוחות דמו");

  // לידים דמו (4)
  const leads = [
    { name: "ליאת גולן", company: "גולן בע\"מ", phone: "052-4445566", source: "WEBSITE", stage: "NEW", confidence: "HIGH", value: 15000 },
    { name: "ארז חן", company: "חן הנדסה", phone: "054-8889900", source: "FACEBOOK", stage: "CONTACTED", confidence: "MEDIUM", value: 8500 },
    { name: "תמר אלון", company: "אלון תעשיות", phone: "050-3334455", source: "INSTAGRAM", stage: "QUALIFIED", confidence: "HIGH", value: 25000 },
    { name: "רון חדד", company: "חדד שיווק", phone: "052-6667788", source: "REFERRAL", stage: "PROPOSAL", confidence: "HIGH", value: 32000 },
  ];

  for (const l of leads) {
    await prismaClient.lead.create({
      data: { ...l, assignedToId: admin.id } as any,
    });
  }
  console.log("✓ 4 לידים דמו");

  console.log("\n=== Seed הושלם ===\n");
  console.log("מנהל:   admin@shisachar.co.il / ChangeMe!2026");
  console.log("צוות:   manager@shisachar.co.il / Demo!2026");
  console.log("מכירות: sales@shisachar.co.il / Demo!2026");
}

main()
  .catch((e) => {
    console.error("שגיאה:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaClient.$disconnect();
  });




