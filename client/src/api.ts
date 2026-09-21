import { parseContentDispositionFilename } from "./format";
import { apiJson, apiRequest, parseApiError, type ApiError } from "./api-client";

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface RelatedSystemResponse {
  data: RelatedSystem[];
}

export interface TicketResponse {
  data: {
    id: number;
    ticketNumber: string;
    requesterId: number;
    categoryId: number;
    relatedSystemId: number;
    summary: string;
    description: string;
    requestedPriority: string;
    itPriority: string | null;
    ticketOwnerId: number | null;
    currentStatus: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface MyTicketItem {
  id: number;
  ticketNumber: string;
  categoryId: number;
  categoryName: string;
  summary: string;
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyTicketsResponse {
  data: MyTicketItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    unfilteredTotalItems: number;
  };
}

export interface MyTicketsParams {
  search?: string;
  categoryId?: number;
  requestedPriority?: string;
  status?: string;
  sort?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}

export interface TicketDetailResponse {
  data: {
    id: number;
    ticketNumber: string;
    requesterId: number;
    requesterName: string;
    requesterIsActive: boolean;
    categoryId: number;
    categoryName: string;
    relatedSystemId: number;
    relatedSystemName: string;
    summary: string;
    description: string;
    requestedPriority: string;
    itPriority: string | null;
    ticketOwnerId: number | null;
    currentStatus: string;
    createdAt: string;
    updatedAt: string;
    /**
     * Issue #38 — Requester "Problem Appears Resolved" indicator (BR-19).
     * Optional so Lab 2 fixtures that predate the field remain valid; the
     * server always returns it.
     */
    appearsResolved?: boolean;
    /**
     * Issue #38 — Public Comments only (BR-04: notes never reach a Requester
     * payload). Optional for Lab 2 fixture compatibility.
     */
    publicComments?: CommentItem[];
    attachments: Array<{
      id: number;
      originalFilename: string;
      mimeType: string;
      fileSizeBytes: number;
      uploadedAt: string;
      isRemoved: boolean;
      removedAt: string | null;
      removalReason: string | null;
      removedByUserId: number | null;
    }>;
  };
}

/**
 * Fetches a Ticket's detail.
 *
 * Identity comes from the authenticated session (httpOnly cookie) — there is no
 * client-supplied requester id. Shared read: the owning Requester or IT
 * Staff/Administrator.
 */
export async function fetchTicketDetail(
  ticketNumber: string,
): Promise<TicketDetailResponse["data"]> {
  const result = await apiJson<TicketDetailResponse>(
    `/api/tickets/${encodeURIComponent(ticketNumber)}`,
    { fallbackError: "Failed to fetch ticket." },
  );
  return result.data;
}

/** Fetches the authenticated Requester's own Tickets (My Tickets). */
export async function fetchMyTickets(
  params: MyTicketsParams = {},
): Promise<MyTicketsResponse> {
  const url = new URL("/api/tickets", "http://placeholder.invalid");

  if (params.search) url.searchParams.set("search", params.search);
  if (params.categoryId !== undefined) url.searchParams.set("categoryId", String(params.categoryId));
  if (params.requestedPriority) url.searchParams.set("requestedPriority", params.requestedPriority);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.sort) url.searchParams.set("sort", params.sort);
  if (params.order) url.searchParams.set("order", params.order);
  if (params.page !== undefined) url.searchParams.set("page", String(params.page));
  if (params.pageSize !== undefined) url.searchParams.set("pageSize", String(params.pageSize));

  return apiJson<MyTicketsResponse>(`${url.pathname}${url.search}`, {
    fallbackError: "Failed to fetch tickets.",
  });
}

/** Fetches active Categories (authenticated session required). */
export async function fetchCategories(): Promise<Category[]> {
  // GET /api/categories returns a BARE ARRAY (preserved from Lab 2; see
  // docs/lab-03/api-spec.md §5 and specification.md D-19). It is not wrapped
  // in `{ data }`.
  return apiJson<Category[]>("/api/categories", {
    fallbackError: "Failed to fetch categories.",
  });
}

/** Fetches active Related Systems (authenticated session required). */
export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const payload = await apiJson<{ data: RelatedSystem[] }>("/api/related-systems", {
    fallbackError: "Failed to fetch related systems.",
  });
  return payload.data;
}

export interface CreateTicketPayload {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
}

/**
 * Creates a Ticket for the authenticated Requester.
 *
 * State-changing: sends the session cookie and the CSRF token from the shared
 * transport. Any `requesterId` in the payload is ignored server-side.
 */
export async function createTicket(
  payload: CreateTicketPayload,
): Promise<TicketResponse["data"]> {
  const result = await apiJson<TicketResponse>("/api/tickets", {
    method: "POST",
    body: payload,
    includeCsrf: true,
    fallbackError: "Failed to create ticket.",
  });
  return result.data;
}

// Attachment types

export interface AttachmentItem {
  id: number;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  isRemoved: boolean;
  removedAt: string | null;
  removalReason: string | null;
  removedByUserId: number | null;
}

export interface AttachmentUploadResult {
  data: {
    id: number;
    ticketId: number;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    uploadedAt: string;
    isRemoved: boolean;
  };
}

export interface AttachmentRemoveResult {
  data: AttachmentItem;
}

export interface AttachmentListResponse {
  data: AttachmentItem[];
}

export interface AttachmentError extends Error {
  code?: string;
  fields?: Record<string, string>;
}

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

export function isAllowedAttachmentType(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isWithinSizeLimit(sizeBytes: number): boolean {
  return sizeBytes <= 5_000_000;
}

/**
 * Uploads an Attachment to an owned Ticket.
 * State-changing: session cookie + CSRF token; multipart body sent as-is.
 */
export async function uploadAttachment(
  ticketNumber: string,
  file: File,
): Promise<AttachmentUploadResult["data"]> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiRequest(
    `/api/tickets/${encodeURIComponent(ticketNumber)}/attachments`,
    {
      method: "POST",
      body: formData,
      rawBody: true,
      includeCsrf: true,
    },
  );

  if (!response.ok) {
    throw await parseApiError(response, "Failed to upload attachment.");
  }

  const result = (await response.json()) as AttachmentUploadResult;
  return result.data;
}

/** Lists a Ticket's Attachments (shared read: owner Requester or Staff/Admin). */
export async function fetchAttachments(ticketNumber: string): Promise<AttachmentItem[]> {
  const response = await apiRequest(
    `/api/tickets/${encodeURIComponent(ticketNumber)}/attachments`,
  );

  if (!response.ok) {
    throw await parseApiError(response, "Failed to fetch attachments.");
  }

  return (await response.json()) as AttachmentItem[];
}

/** Downloads an Attachment file (shared read). */
export async function downloadAttachmentFile(
  attachmentId: number,
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiRequest(`/api/attachments/${attachmentId}/download`);

  if (!response.ok) {
    throw await parseApiError(response, "Failed to download attachment.");
  }

  const disposition = response.headers.get("content-disposition") || "";
  const filename = parseContentDispositionFilename(disposition) ?? "download";

  const blob = await response.blob();
  return { blob, filename };
}

/** Previews an Attachment (shared read). */
export async function previewAttachmentFile(
  attachmentId: number,
): Promise<{ blob: Blob; mimeType: string }> {
  const response = await apiRequest(`/api/attachments/${attachmentId}/preview`);

  if (!response.ok) {
    throw await parseApiError(response, "Failed to preview attachment.");
  }

  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  const blob = await response.blob();
  return { blob, mimeType };
}

/**
 * Soft-removes an Attachment (Requester-owner-only mutation).
 * State-changing: session cookie + CSRF token.
 */
export async function removeAttachment(
  attachmentId: number,
  removalReason?: string,
): Promise<AttachmentItem> {
  const body = removalReason !== undefined ? { removalReason } : undefined;

  const response = await apiRequest(`/api/attachments/${attachmentId}`, {
    method: "DELETE",
    body,
    includeCsrf: true,
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to remove attachment.");
  }

  const result = (await response.json()) as AttachmentRemoveResult;
  return result.data;
}

export type { ApiError };

// ---------------------------------------------------------------------------
// Issue #38 — IT Staff ticket operations
// ---------------------------------------------------------------------------

export interface StaffQueueItem {
  id: number;
  ticketNumber: string;
  summary: string;
  currentStatus: string;
  requestedPriority: string;
  itPriority: string | null;
  ticketOwnerId: number | null;
  requesterId: number;
  createdAt: string;
  updatedAt: string;
}

export interface StaffQueueResponse {
  data: StaffQueueItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    unfilteredTotalItems: number;
  };
}

export interface StaffQueueParams {
  search?: string;
  status?: string;
  priority?: string;
  ownerId?: number;
  sort?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}

/** Fetches the IT Staff / Administrator ticket queue (api-spec §15). */
export async function fetchStaffQueue(
  params: StaffQueueParams = {},
): Promise<StaffQueueResponse> {
  const url = new URL("/api/staff/queue", "http://placeholder.invalid");
  if (params.search) url.searchParams.set("search", params.search);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.priority) url.searchParams.set("priority", params.priority);
  if (params.ownerId !== undefined) url.searchParams.set("ownerId", String(params.ownerId));
  if (params.sort) url.searchParams.set("sort", params.sort);
  if (params.order) url.searchParams.set("order", params.order);
  if (params.page !== undefined) url.searchParams.set("page", String(params.page));
  if (params.pageSize !== undefined) url.searchParams.set("pageSize", String(params.pageSize));

  return apiJson<StaffQueueResponse>(`${url.pathname}${url.search}`, {
    fallbackError: "Failed to fetch the staff queue.",
  });
}

export interface CommentItem {
  id: number;
  content: string;
  authorId: number;
  createdAt: string;
}

export interface StaffTicketDetail {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  currentStatus: string;
  requestedPriority: string;
  itPriority: string | null;
  ticketOwnerId: number | null;
  requesterId: number;
  requesterName: string;
  requesterIsActive: boolean;
  categoryId: number;
  categoryName: string;
  relatedSystemId: number;
  relatedSystemName: string;
  appearsResolved: boolean;
  createdAt: string;
  updatedAt: string;
  publicComments: CommentItem[];
  internalNotes: CommentItem[];
}

/** Fetches the Staff/Admin Ticket Detail (api-spec §16). */
export async function fetchStaffTicketDetail(
  ticketNumber: string,
): Promise<StaffTicketDetail> {
  const result = await apiJson<{ data: StaffTicketDetail }>(
    `/api/staff/tickets/${encodeURIComponent(ticketNumber)}`,
    { fallbackError: "Failed to fetch ticket detail." },
  );
  return result.data;
}

/** Claims/reassigns a Ticket's owner (api-spec §17). State-changing. */
export async function setTicketOwner(
  ticketNumber: string,
  ownerId: number,
): Promise<{ ticketOwnerId: number }> {
  const result = await apiJson<{ data: { ticketOwnerId: number } }>(
    `/api/staff/tickets/${encodeURIComponent(ticketNumber)}/owner`,
    { method: "POST", body: { ownerId }, includeCsrf: true, fallbackError: "Failed to set owner." },
  );
  return result.data;
}

/** Sets the IT Priority (api-spec §18). State-changing. */
export async function setItPriority(
  ticketNumber: string,
  itPriority: string,
): Promise<{ itPriority: string }> {
  const result = await apiJson<{ data: { itPriority: string } }>(
    `/api/staff/tickets/${encodeURIComponent(ticketNumber)}/priority`,
    { method: "PATCH", body: { itPriority }, includeCsrf: true, fallbackError: "Failed to set IT priority." },
  );
  return result.data;
}

/** Applies a status transition (api-spec §19). State-changing. */
export async function applyStatusTransition(
  ticketNumber: string,
  status: string,
): Promise<{ currentStatus: string }> {
  const result = await apiJson<{ data: { currentStatus: string } }>(
    `/api/staff/tickets/${encodeURIComponent(ticketNumber)}/status`,
    { method: "PATCH", body: { status }, includeCsrf: true, fallbackError: "Failed to change status." },
  );
  return result.data;
}

/** Posts a Public Comment (api-spec §20). State-changing. */
export async function postTicketComment(
  ticketNumber: string,
  content: string,
): Promise<CommentItem> {
  const result = await apiJson<{ data: CommentItem }>(
    `/api/tickets/${encodeURIComponent(ticketNumber)}/comments`,
    { method: "POST", body: { content }, includeCsrf: true, fallbackError: "Failed to post comment." },
  );
  return result.data;
}

/** Lists Public Comments (api-spec §21). */
export async function fetchTicketComments(ticketNumber: string): Promise<CommentItem[]> {
  const result = await apiJson<{ data: CommentItem[] }>(
    `/api/tickets/${encodeURIComponent(ticketNumber)}/comments`,
    { fallbackError: "Failed to fetch comments." },
  );
  return result.data;
}

/** Posts an Internal Note (api-spec §22). State-changing; Staff/Admin only. */
export async function postInternalNote(
  ticketNumber: string,
  content: string,
): Promise<CommentItem> {
  const result = await apiJson<{ data: CommentItem }>(
    `/api/staff/tickets/${encodeURIComponent(ticketNumber)}/notes`,
    { method: "POST", body: { content }, includeCsrf: true, fallbackError: "Failed to post note." },
  );
  return result.data;
}

/** Lists Internal Notes (api-spec §23). Staff/Admin only. */
export async function fetchInternalNotes(ticketNumber: string): Promise<CommentItem[]> {
  const result = await apiJson<{ data: CommentItem[] }>(
    `/api/staff/tickets/${encodeURIComponent(ticketNumber)}/notes`,
    { fallbackError: "Failed to fetch notes." },
  );
  return result.data;
}

/** Sets the Requester "Problem Appears Resolved" indicator (api-spec §20a). State-changing. */
export async function postAppearsResolved(
  ticketNumber: string,
  appearsResolved: boolean,
): Promise<{ ticketNumber: string; appearsResolved: boolean; currentStatus: string }> {
  const result = await apiJson<{
    data: { ticketNumber: string; appearsResolved: boolean; currentStatus: string };
  }>(`/api/tickets/${encodeURIComponent(ticketNumber)}/appears-resolved`, {
    method: "POST",
    body: { appearsResolved },
    includeCsrf: true,
    fallbackError: "Failed to update the appears-resolved indicator.",
  });
  return result.data;
}
