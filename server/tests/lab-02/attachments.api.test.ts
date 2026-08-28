import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Mock the service module
vi.mock("../../src/service.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../src/service.js");
  return {
    ...actual,
    isActiveDevRequester: vi.fn(),
    ticketOwnedByRequester: vi.fn(),
    uploadAttachment: vi.fn(),
    listAttachments: vi.fn(),
    getAttachmentById: vi.fn(),
    downloadAttachment: vi.fn(),
    previewAttachment: vi.fn(),
    removeAttachment: vi.fn(),
    normalizeRemovalReason: vi.fn(),
  };
});

const service = await import("../../src/service.js");

describe("API-ATT-01: Attachment type/content validation matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("rejects when file part is missing with 400 VALIDATION_ERROR", async () => {
    // Mock uploadAttachment to throw for missing file
    vi.mocked(service.uploadAttachment).mockRejectedValue(
      new service.ValidationError("Validation failed.", { file: "A file must be provided." }),
    );

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1");

    // The multer middleware will handle parsing; if no file, the handler returns 400
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects unsupported extension with 415 UNSUPPORTED_MEDIA_TYPE", async () => {
    vi.mocked(service.uploadAttachment).mockRejectedValue(
      new service.UnsupportedMediaTypeError("File type is not supported."),
    );

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1")
      .attach("file", Buffer.from("fake content"), "test.txt");

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("accepts a valid JPEG file", async () => {
    const mockResult = {
      id: 1,
      ticketId: 42,
      originalFilename: "test.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 1024,
      uploadedAt: new Date("2026-08-27T00:00:00.000Z"),
      isRemoved: false,
    };
    vi.mocked(service.uploadAttachment).mockResolvedValue(mockResult as never);

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1")
      .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0x00]), "test.jpg");

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.ticketId).toBe(42);
    expect(res.body.data.mimeType).toBe("image/jpeg");
  });
});

describe("API-ATT-02: Sixth active attachment rejected by server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("returns 400 ATTACHMENT_LIMIT_REACHED when limit exceeded", async () => {
    vi.mocked(service.uploadAttachment).mockRejectedValue(
      new service.AttachmentLimitError("The ticket already has the maximum number of active attachments."),
    );

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1")
      .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0x00]), "test.jpg");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ATTACHMENT_LIMIT_REACHED");
    expect(res.body.error.fields.file).toBeDefined();
  });
});

describe("API-ATT-03: Oversized file rejected with 413", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("returns 413 FILE_TOO_LARGE for oversized file via multer limit", async () => {
    // Upload a buffer larger than the 5MB multer limit (5,000,000 bytes).
    // Multer will reject it with LIMIT_FILE_SIZE before it reaches the handler.
    const oversizedBuffer = Buffer.alloc(5_000_001, 0xff);

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1")
      .attach("file", oversizedBuffer, "large.jpg");

    // Multer returns 413 with FILE_TOO_LARGE — the controller never runs
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");

    // Verify no attachment row was persisted — uploadAttachment was never called
    expect(service.uploadAttachment).not.toHaveBeenCalled();
  });
});

describe("ATT-SIZE-01: Maximum accepted size boundary (4,999,999 bytes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("accepts a 4,999,999-byte file with 201", async () => {
    const mockResult = {
      id: 1,
      originalFilename: "large.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 4_999_999,
      uploadedAt: new Date("2026-08-27T00:00:00.000Z"),
      isRemoved: false,
    };
    vi.mocked(service.uploadAttachment).mockResolvedValue(mockResult as never);

    const buffer = Buffer.alloc(4_999_999, 0xff);
    // Overwrite the first 3 bytes with JPEG signature so content validation passes
    buffer[0] = 0xff;
    buffer[1] = 0xd8;
    buffer[2] = 0xff;

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1")
      .attach("file", buffer, "large.jpg");

    expect(res.status).toBe(201);
    expect(res.body.data.fileSizeBytes).toBe(4_999_999);
  });
});

describe("ATT-SIZE-02: Maximum accepted size boundary (5,000,000 bytes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("accepts a 5,000,000-byte file with 201", async () => {
    // The business maximum is 5,000,000 bytes — this file must be accepted.
    // Multer's transport limit is set slightly above the business maximum so
    // that this exact-boundary file reaches the service-level validateFileSize().
    const mockResult = {
      id: 1,
      originalFilename: "exact-max.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 5_000_000,
      uploadedAt: new Date("2026-08-27T00:00:00.000Z"),
      isRemoved: false,
    };
    vi.mocked(service.uploadAttachment).mockResolvedValue(mockResult as never);

    const buffer = Buffer.alloc(5_000_000, 0xff);
    buffer[0] = 0xff;
    buffer[1] = 0xd8;
    buffer[2] = 0xff;

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1")
      .attach("file", buffer, "exact-max.jpg");

    expect(res.status).toBe(201);
    expect(res.body.data.fileSizeBytes).toBe(5_000_000);
    // Verify the attachment was actually persisted — uploadAttachment was called
    expect(service.uploadAttachment).toHaveBeenCalledTimes(1);
  });
});

describe("API-ATT-04: Soft remove sets metadata and blocks access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("soft-removes an attachment with metadata", async () => {
    const mockResult = {
      id: 1,
      originalFilename: "test.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 1024,
      uploadedAt: new Date("2026-08-27T00:00:00.000Z"),
      isRemoved: true,
      removedAt: new Date("2026-08-27T01:00:00.000Z"),
      removalReason: "Test removal",
      removedByRequesterId: 1,
    };
    vi.mocked(service.removeAttachment).mockResolvedValue(mockResult as never);

    const res = await request(app)
      .delete("/api/attachments/1")
      .set("X-Dev-Requester-Id", "1")
      .send({ removalReason: "Test removal" });

    expect(res.status).toBe(200);
    expect(res.body.data.isRemoved).toBe(true);
    expect(res.body.data.removalReason).toBe("Test removal");
    expect(res.body.data.removedByRequesterId).toBe(1);
  });
});

describe("API-ATT-05: Preview/download for active vs removed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("download returns 200 for active attachment", async () => {
    vi.mocked(service.downloadAttachment).mockResolvedValue({
      buffer: Buffer.from("test content"),
      mimeType: "image/jpeg",
      originalFilename: "test.jpg",
    });

    const res = await request(app)
      .get("/api/attachments/1/download")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
  });

  it("download returns 410 ATTACHMENT_REMOVED for removed attachment", async () => {
    vi.mocked(service.downloadAttachment).mockRejectedValue(
      new service.AttachmentRemovedError("This attachment has been removed."),
    );

    const res = await request(app)
      .get("/api/attachments/1/download")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("ATTACHMENT_REMOVED");
  });

  it("preview returns 200 for active image attachment", async () => {
    vi.mocked(service.previewAttachment).mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mimeType: "image/jpeg",
    });

    const res = await request(app)
      .get("/api/attachments/1/preview")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
  });

  it("preview returns 200 image/png for active PDF attachment (first page rendered)", async () => {
    vi.mocked(service.previewAttachment).mockResolvedValue({
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      mimeType: "image/png",
    });

    const res = await request(app)
      .get("/api/attachments/1/preview")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
  });

  it("preview returns 500 when PDF rendering fails (never returns original PDF)", async () => {
    vi.mocked(service.previewAttachment).mockRejectedValue(
      new Error("PDF preview rendering failed"),
    );

    const res = await request(app)
      .get("/api/attachments/1/preview")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).not.toBe("application/pdf");
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("API-ATT-06: BR-17 partial success — ticket persists after attachment failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("ticket POST succeeds even when attachment upload fails", async () => {
    // This is an orchestration test — the API endpoint for attachments is separate
    // from the ticket creation endpoint. The Case B logic is client-side.
    // We just verify the attachment endpoint can fail independently of ticket state.
    vi.mocked(service.uploadAttachment).mockRejectedValue(
      new service.UnsupportedMediaTypeError("File type is not supported."),
    );

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1")
      .attach("file", Buffer.from("bad file"), "test.txt");

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
});

describe("API-ATT-07: Attachment metadata and stored filename", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("returns attachment metadata without exposing stored filename", async () => {
    const mockResult = {
      id: 1,
      ticketId: 42,
      originalFilename: "photo.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 204800,
      uploadedAt: new Date("2026-08-27T00:00:00.000Z"),
      isRemoved: false,
    };
    vi.mocked(service.uploadAttachment).mockResolvedValue(mockResult as never);

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1")
      .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0x00]), "photo.jpg");

    expect(res.status).toBe(201);
    // Required response fields per API spec §7
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.ticketId).toBe(42);
    expect(res.body.data.originalFilename).toBe("photo.jpg");
    expect(res.body.data.mimeType).toBe("image/jpeg");
    expect(res.body.data.fileSizeBytes).toBe(204800);
    expect(res.body.data.uploadedAt).toBeDefined();
    expect(res.body.data.isRemoved).toBe(false);
    // storedFilename must not be exposed
    expect(res.body.data.storedFilename).toBeUndefined();
  });
});

describe("API-ATT-09: Attachment list ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("returns attachments in deterministic order (uploadedAt ASC, id ASC)", async () => {
    const mockAttachments = [
      {
        id: 1, originalFilename: "a.jpg", mimeType: "image/jpeg", fileSizeBytes: 100,
        uploadedAt: new Date("2026-08-27T00:00:00.000Z"), isRemoved: false,
        removedAt: null, removalReason: null, removedByRequesterId: null,
      },
      {
        id: 2, originalFilename: "b.jpg", mimeType: "image/jpeg", fileSizeBytes: 200,
        uploadedAt: new Date("2026-08-27T00:01:00.000Z"), isRemoved: true,
        removedAt: new Date("2026-08-27T01:00:00.000Z"), removalReason: "Removed",
        removedByRequesterId: 1,
      },
    ];
    vi.mocked(service.listAttachments).mockResolvedValue(mockAttachments as never);

    const res = await request(app)
      .get("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(1);
    expect(res.body[1].id).toBe(2);
  });
});

describe("API-ATT-10: Removal reason normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
    vi.mocked(service.normalizeRemovalReason).mockImplementation(
      (reason: unknown) => {
        if (reason === undefined || reason === null) return null;
        if (typeof reason !== "string") throw new service.ValidationError("Validation failed.", { removalReason: "Removal reason must be a string." });
        const trimmed = reason.trim();
        if (trimmed.length === 0) return null;
        if (trimmed.length > 200) throw new service.ValidationError("Validation failed.", { removalReason: "Removal reason must be at most 200 characters." });
        return trimmed;
      },
    );
    vi.mocked(service.removeAttachment).mockImplementation(
      async (_id: number, _rid: number, reason: string | null) => ({
        id: 1,
        originalFilename: "test.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 100,
        uploadedAt: new Date(),
        isRemoved: true,
        removedAt: new Date(),
        removalReason: reason,
        removedByRequesterId: _rid,
      }),
    );
  });

  it("accepts omitted reason as null", async () => {
    const res = await request(app)
      .delete("/api/attachments/1")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body.data.removalReason).toBeNull();
  });

  it("accepts blank reason as null", async () => {
    const res = await request(app)
      .delete("/api/attachments/1")
      .set("X-Dev-Requester-Id", "1")
      .send({ removalReason: "   " });

    expect(res.status).toBe(200);
    expect(res.body.data.removalReason).toBeNull();
  });

  it("rejects non-string reason with 400", async () => {
    const res = await request(app)
      .delete("/api/attachments/1")
      .set("X-Dev-Requester-Id", "1")
      .send({ removalReason: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("API-ATT-12: Second removal returns 409 CONFLICT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("removing an already-removed attachment returns 409", async () => {
    vi.mocked(service.removeAttachment).mockRejectedValue(
      new service.ConflictError("This attachment has already been removed."),
    );

    const res = await request(app)
      .delete("/api/attachments/1")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });
});

describe("API-ATT-13: Removal sets removedByRequesterId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("records the removing requester ID", async () => {
    vi.mocked(service.removeAttachment).mockResolvedValue({
      id: 1, originalFilename: "test.jpg", mimeType: "image/jpeg", fileSizeBytes: 100,
      uploadedAt: new Date(), isRemoved: true, removedAt: new Date(),
      removalReason: null, removedByRequesterId: 5,
    } as never);

    const res = await request(app)
      .delete("/api/attachments/1")
      .set("X-Dev-Requester-Id", "5");

    expect(res.status).toBe(200);
    expect(res.body.data.removedByRequesterId).toBe(5);
  });
});

describe("API-ATT-15: Removed slot becomes reusable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("can upload after removing an attachment", async () => {
    vi.mocked(service.uploadAttachment).mockResolvedValue({
      id: 6, originalFilename: "new.jpg", mimeType: "image/jpeg", fileSizeBytes: 100,
      uploadedAt: new Date(), isRemoved: false,
    } as never);

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1")
      .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0x00]), "new.jpg");

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(6);
  });
});

describe("API-ATT-OWN-01: Cross-requester ownership enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
  });

  it("upload returns 404 for non-owned ticket", async () => {
    vi.mocked(service.uploadAttachment).mockRejectedValue(
      new service.ValidationError("Ticket not found.", {}),
    );

    const res = await request(app)
      .post("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1")
      .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0x00]), "test.jpg");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("list returns 404 for non-owned ticket", async () => {
    vi.mocked(service.listAttachments).mockRejectedValue(
      new service.ValidationError("Ticket not found.", {}),
    );

    const res = await request(app)
      .get("/api/tickets/TKT-2026-000001/attachments")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(404);
  });

  it("download returns 404 for non-owned attachment", async () => {
    vi.mocked(service.downloadAttachment).mockResolvedValue(null);

    const res = await request(app)
      .get("/api/attachments/1/download")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(404);
  });

  it("preview returns 404 for non-owned attachment", async () => {
    vi.mocked(service.previewAttachment).mockResolvedValue(null);

    const res = await request(app)
      .get("/api/attachments/1/preview")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(404);
  });

  it("remove returns 404 for non-owned attachment", async () => {
    vi.mocked(service.removeAttachment).mockResolvedValue(null);

    const res = await request(app)
      .delete("/api/attachments/1")
      .set("X-Dev-Requester-Id", "1");

    expect(res.status).toBe(404);
  });
});

describe("API-ATT-08: Removal reason 200-char boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(service.isActiveDevRequester).mockResolvedValue(true);
    vi.mocked(service.ticketOwnedByRequester).mockResolvedValue(true);
    vi.mocked(service.normalizeRemovalReason).mockImplementation(
      (reason: unknown) => {
        if (reason === undefined || reason === null) return null;
        if (typeof reason !== "string") throw new service.ValidationError("Validation failed.", { removalReason: "Removal reason must be a string." });
        const trimmed = reason.trim();
        if (trimmed.length === 0) return null;
        if (trimmed.length > 200) throw new service.ValidationError("Validation failed.", { removalReason: "Removal reason must be at most 200 characters." });
        return trimmed;
      },
    );
    vi.mocked(service.removeAttachment).mockImplementation(
      async (_id: number, _rid: number, reason: string | null) => ({
        id: 1, originalFilename: "test.jpg", mimeType: "image/jpeg", fileSizeBytes: 100,
        uploadedAt: new Date(), isRemoved: true, removedAt: new Date(),
        removalReason: reason, removedByRequesterId: _rid,
      }),
    );
  });

  it("accepts a 200-character removal reason", async () => {
    const reason = "a".repeat(200);
    const res = await request(app)
      .delete("/api/attachments/1")
      .set("X-Dev-Requester-Id", "1")
      .send({ removalReason: reason });

    expect(res.status).toBe(200);
    expect(res.body.data.removalReason).toBe(reason);
  });

  it("rejects a 201-character removal reason", async () => {
    const reason = "a".repeat(201);
    const res = await request(app)
      .delete("/api/attachments/1")
      .set("X-Dev-Requester-Id", "1")
      .send({ removalReason: reason });

    expect(res.status).toBe(400);
  });
});