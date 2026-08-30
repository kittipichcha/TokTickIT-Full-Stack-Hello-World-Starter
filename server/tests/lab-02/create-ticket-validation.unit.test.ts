import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ValidationError,
  validateCreateTicketInput,
  type CreateTicketInput,
} from "../../src/service.js";

const validInput: CreateTicketInput = {
  categoryId: 1,
  relatedSystemId: 1,
  summary: "Valid summary",
  description: "Valid description text",
  requestedPriority: "MEDIUM",
};

function expectFieldError(
  input: CreateTicketInput,
  field: string,
): void {
  try {
    validateCreateTicketInput(input);
    throw new Error(
      "Expected validateCreateTicketInput to throw",
    );
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    const validationError =
      error as ValidationError;
    expect(validationError.fields[field])
      .toBeDefined();
  }
}

describe("API-TKT-NOR-02 & API-TKT-07: Production create-ticket validator", () => {
  describe.each([
    "categoryId",
    "relatedSystemId",
  ] as const)("%s validation", (field) => {
    it.each([
      ["missing", undefined],
      ["null", null],
      ["string", "abc"],
      ["decimal", 1.5],
      ["zero", 0],
      ["negative", -1],
    ])("rejects %s", (_label, value) => {
      expectFieldError(
        {
          ...validInput,
          [field]: value,
        },
        field,
      );
    });
  });

  describe("requestedPriority validation", () => {
    it.each([
      undefined,
      null,
      "",
      "URGENT",
      "low",
    ])("rejects %s", (value) => {
      expectFieldError(
        {
          ...validInput,
          requestedPriority: value,
        },
        "requestedPriority",
      );
    });

    it.each([
      "LOW",
      "MEDIUM",
      "HIGH",
    ])("accepts %s", (priority) => {
      const result =
        validateCreateTicketInput({
          ...validInput,
          requestedPriority: priority,
        });
      expect(result.requestedPriority)
        .toBe(priority);
    });
  });

  it("returns trimmed summary and description", () => {
    const result = validateCreateTicketInput({
      ...validInput,
      summary: "  abcde  ",
      description: "  1234567890  ",
    });

    expect(result.summary).toBe("abcde");
    expect(result.description).toBe("1234567890");
  });
});