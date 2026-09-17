// Prisma client singleton — מונע חיבורים מרובים ב־dev hot-reload
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// תומך גם בייבוא בשם וגם בייבוא ברירת־מחדל.
export { prisma };
export default prisma;

