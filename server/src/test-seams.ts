/**
 * Test seams for integration tests.
 *
 * This module provides mutable state that can be set by integration tests
 * and read by production code. It allows deterministic fault injection
 * without mocking Prisma or other internals.
 *
 * IMPORTANT: This module is NEVER imported in production request paths.
 * It is only used by integration tests and the testability hooks in service.ts.
 */

export const testSeams = {
  /**
   * When set to a non-null Error, createAttachmentMetadata will throw
   * that error instead of writing to the database.
   */
  forceCreateAttachmentMetadataError: null as Error | null,
};