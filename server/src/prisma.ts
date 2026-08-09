import { PrismaClient } from "@prisma/client";

// connect to the database only once, and reuse the same client instance across the app
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. Please configure server/.env (or the environment) before using Prisma.");
    }

    client = new PrismaClient({
      datasources: {
        db: { url },
      },
    });
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
