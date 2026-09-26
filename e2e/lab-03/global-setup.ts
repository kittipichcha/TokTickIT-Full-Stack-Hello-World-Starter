import lab2GlobalSetup from "../lab-02/global-setup";
import { createRequire } from "node:module";
import path from "node:path";
import { PASSWORD, USERS } from "./helpers";

const serverRequire = createRequire(path.resolve(__dirname, "../../server/package.json"));

/** Require a disposable database before either Lab 2 or Lab 3 fixtures can write. */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Set E2E_DATABASE_URL to a disposable PostgreSQL database before running Playwright.");
  }
  process.env.DATABASE_URL = databaseUrl;
  await lab2GlobalSetup();

  const { PrismaClient } = serverRequire("@prisma/client") as { PrismaClient: new () => {
    user: { upsert: (args: unknown) => Promise<unknown> };
    $disconnect: () => Promise<void>;
  } };
  const bcrypt = serverRequire("bcrypt") as { hash: (password: string, rounds: number) => Promise<string> };
  const prisma = new PrismaClient();
  try {
    for (const [key, account] of Object.entries(USERS)) {
      const password = key === "forced" ? "ForcedStart123!abc" : PASSWORD;
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.upsert({
        where: { email: account.email },
        update: {
          name: account.name,
          role: account.role,
          passwordHash,
          isActive: true,
          mustChangePassword: key === "forced",
        },
        create: {
          email: account.email,
          name: account.name,
          role: account.role,
          passwordHash,
          isActive: true,
          mustChangePassword: key === "forced",
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
