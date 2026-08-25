import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

describe("API-TKT-02-INT: Inactive/stale reference rejection (real DB)", () => {
  let requesterId: number;
  let activeCategoryId: number;
  let activeSystemId: number;
  let inactiveCategoryId: number | null = null;
  let inactiveSystemId: number | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();

    const requester = await prisma.devRequester.findFirst({ where: { isActive: true } });
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

    expect(requester).toBeTruthy();
    expect(category).toBeTruthy();
    expect(system).toBeTruthy();

    requesterId = requester!.id;
    activeCategoryId = category!.id;
    activeSystemId = system!.id;

    // Create an inactive category for testing
    const inactiveCat = await prisma.category.create({
      data: { name: "INT-TEST-INACTIVE-CATEGORY", isActive: false },
    });
    inactiveCategoryId = inactiveCat.id;

    // Create an inactive related system for testing
    const inactiveSys = await prisma.relatedSystem.create({
      data: { name: "INT-TEST-INACTIVE-SYSTEM", isActive: false },
    });
    inactiveSystemId = inactiveSys.id;
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    if (inactiveCategoryId) {
      await prisma.category.deleteMany({ where: { id: inactiveCategoryId } });
    }
    if (inactiveSystemId) {
      await prisma.relatedSystem.deleteMany({ where: { id: inactiveSystemId } });
    }
    await disconnectPrisma();
  });

  const validBody = {
    summary: "INT-TEST Valid summary text",
    description: "INT-TEST Valid description text for testing",
    requestedPriority: "MEDIUM",
  };

  itIfDb("rejects inactive category with 409 INACTIVE_REFERENCE (real DB)", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: inactiveCategoryId,
        relatedSystemId: activeSystemId,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  itIfDb("rejects inactive related system with 409 INACTIVE_REFERENCE (real DB)", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: inactiveSystemId,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  itIfDb("rejects nonexistent categoryId with 409 INACTIVE_REFERENCE (real DB)", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: 999999,
        relatedSystemId: activeSystemId,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  itIfDb("rejects nonexistent relatedSystemId with 409 INACTIVE_REFERENCE (real DB)", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: 999999,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
  });

  itIfDb("accepts valid create with active references (real DB)", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send({
        ...validBody,
        categoryId: activeCategoryId,
        relatedSystemId: activeSystemId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.data.currentStatus).toBe("NEW");

    // Clean up the created ticket
    const prisma = getPrisma();
    await prisma.ticket.deleteMany({
      where: { summary: validBody.summary },
    });
  });
});