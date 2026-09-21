/**
 * Playwright global setup for the Lab 2 E2E suite (Issue #37 — authenticated identity).
 *
 * Lab 2 E2E specs drove the removed Dev-Requester selector. They now log in through
 * the real Login screen, so the suite needs two active Requester accounts that can
 * reach the application shell (i.e. `mustChangePassword = false`).
 *
 * The seeded Requesters all start with `mustChangePassword = true` (frozen §13
 * decision 13), so this fixture creates/updates two dedicated E2E accounts with a
 * known test-only password and clears the password-change gate. It is idempotent and
 * non-destructive to the seeded application data (it only touches its own accounts).
 *
 * Credentials are test-only constants (see `helpers.ts`); no real secret is used.
 */

import { createRequire } from "module";
import path from "path";
import { E2E_REQUESTER_A, E2E_REQUESTER_B } from "./helpers";

// Resolve Prisma/bcrypt/dotenv from the server workspace (the root workspace does not
// depend on them). `createRequire` anchors resolution at `server/package.json`.
const serverRequire = createRequire(path.resolve(__dirname, "../../server/package.json"));

// Load the server's local .env so DATABASE_URL is available to the fixture.
const dotenv = serverRequire("dotenv") as { config: (opts: { path: string }) => void };
dotenv.config({ path: path.resolve(__dirname, "../../server/.env") });

const { PrismaClient } = serverRequire("@prisma/client") as typeof import("@prisma/client");
const bcrypt = serverRequire("bcrypt") as typeof import("bcrypt");

async function ensureRequester(
  prisma: InstanceType<typeof PrismaClient>,
  account: { email: string; password: string; name: string },
): Promise<void> {
  const passwordHash = await bcrypt.hash(account.password, 10);
  const data = {
    name: account.name,
    role: "REQUESTER" as const,
    passwordHash,
    isActive: true,
    mustChangePassword: false,
  };
  await prisma.user.upsert({
    where: { email: account.email },
    update: data,
    create: { email: account.email, ...data },
  });
}

export default async function globalSetup(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await ensureRequester(prisma, E2E_REQUESTER_A);
    await ensureRequester(prisma, E2E_REQUESTER_B);
  } finally {
    await prisma.$disconnect();
  }
}
