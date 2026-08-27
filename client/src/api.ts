export interface Category {
  id: number;
  name: string;
}

export interface DevRequester {
  id: number;
  name: string;
  email: string;
}

export interface DevRequesterResponse {
  data: DevRequester[];
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
    attachments: Array<{
      id: number;
      originalFilename: string;
      mimeType: string;
      fileSizeBytes: number;
      uploadedAt: string;
      isRemoved: boolean;
      removedAt: string | null;
      removalReason: string | null;
      removedByRequesterId: number | null;
    }>;
  };
}

export async function fetchTicketDetail(
  requesterId: number,
  ticketNumber: string,
): Promise<TicketDetailResponse["data"]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL(`/api/tickets/${encodeURIComponent(ticketNumber)}`, apiBaseUrl), {
    headers: requesterHeaders(requesterId),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body?.error?.message || `Failed to fetch ticket: ${response.status}`) as Error & { code?: string };
    err.code = body?.error?.code;
    throw err;
  }
  const result = (await response.json()) as TicketDetailResponse;
  return result.data;
}

export async function fetchMyTickets(
  requesterId: number,
  params: MyTicketsParams = {},
): Promise<MyTicketsResponse> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const url = new URL("/api/tickets", apiBaseUrl);

  if (params.search) url.searchParams.set("search", params.search);
  if (params.categoryId !== undefined) url.searchParams.set("categoryId", String(params.categoryId));
  if (params.requestedPriority) url.searchParams.set("requestedPriority", params.requestedPriority);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.sort) url.searchParams.set("sort", params.sort);
  if (params.order) url.searchParams.set("order", params.order);
  if (params.page !== undefined) url.searchParams.set("page", String(params.page));
  if (params.pageSize !== undefined) url.searchParams.set("pageSize", String(params.pageSize));

  const response = await fetch(url, {
    headers: requesterHeaders(requesterId),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body?.error?.message || `Failed to fetch tickets: ${response.status}`) as Error & { code?: string };
    err.code = body?.error?.code;
    throw err;
  }
  return (await response.json()) as MyTicketsResponse;
}

export const REQUESTER_STORAGE_KEY = "toktickit.requesterId";

export async function fetchCategories(): Promise<Category[]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/categories", apiBaseUrl));
  if (!response.ok) throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
  return response.json();
}

export async function fetchDevRequesters(): Promise<DevRequester[]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/dev-requesters", apiBaseUrl));
  if (!response.ok) throw new Error(`Failed to fetch requesters: ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as DevRequesterResponse;
  return payload.data;
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/related-systems", apiBaseUrl));
  if (!response.ok) throw new Error(`Failed to fetch related systems: ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as RelatedSystemResponse;
  return payload.data;
}

export function getStoredRequesterId(): number | null {
  const stored = sessionStorage.getItem(REQUESTER_STORAGE_KEY);
  return stored && /^[1-9][0-9]*$/.test(stored) ? Number(stored) : null;
}

export function setStoredRequesterId(id: number): void {
  sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(id));
}

export function clearStoredRequesterId(): void {
  sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
}

export function requesterHeaders(id: number): HeadersInit {
  return { "X-Dev-Requester-Id": String(id) };
}

export async function fetchRequesterContext(id: number): Promise<{ requesterId: number }> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/requester-context", apiBaseUrl), {
    headers: requesterHeaders(id),
  });
  if (!response.ok) throw new Error(`Failed to validate requester context: ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as { data: { requesterId: number } };
  return payload.data;
}

export interface CreateTicketPayload {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
}

export async function createTicket(
  requesterId: number,
  payload: CreateTicketPayload,
): Promise<TicketResponse["data"]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/tickets", apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requesterHeaders(requesterId),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body?.error?.message || `Failed to create ticket: ${response.status}`) as Error & { code?: string; fields?: Record<string, string> };
    err.code = body?.error?.code;
    err.fields = body?.error?.fields;
    throw err;
  }
  const result = (await response.json()) as TicketResponse;
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
  removedByRequesterId: number | null;
}

export interface AttachmentUploadResult {
  data: {
    id: number;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    uploadedAt: string;
    isRemoved: boolean;
    storedFilename: string;
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

export async function uploadAttachment(
  requesterId: number,
  ticketNumber: string,
  file: File,
): Promise<AttachmentUploadResult["data"]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    new URL(`/api/tickets/${encodeURIComponent(ticketNumber)}/attachments`, apiBaseUrl),
    {
      method: "POST",
      headers: requesterHeaders(requesterId),
      body: formData,
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(
      body?.error?.message || `Failed to upload attachment: ${response.status}`,
    ) as AttachmentError;
    err.code = body?.error?.code;
    err.fields = body?.error?.fields;
    throw err;
  }

  const result = (await response.json()) as AttachmentUploadResult;
  return result.data;
}

export async function fetchAttachments(
  requesterId: number,
  ticketNumber: string,
): Promise<AttachmentItem[]> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(
    new URL(`/api/tickets/${encodeURIComponent(ticketNumber)}/attachments`, apiBaseUrl),
    {
      headers: requesterHeaders(requesterId),
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(
      body?.error?.message || `Failed to fetch attachments: ${response.status}`,
    ) as AttachmentError;
    err.code = body?.error?.code;
    throw err;
  }

  return (await response.json()) as AttachmentItem[];
}

export function getAttachmentDownloadUrl(
  attachmentId: number,
  requesterId: number,
): string {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const url = new URL(`/api/attachments/${attachmentId}/download`, apiBaseUrl);
  // Add requester ID as query parameter for download via new window
  url.searchParams.set("requesterId", String(requesterId));
  return url.toString();
}

export function getAttachmentPreviewUrl(
  attachmentId: number,
  requesterId: number,
): string {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const url = new URL(`/api/attachments/${attachmentId}/preview`, apiBaseUrl);
  url.searchParams.set("requesterId", String(requesterId));
  return url.toString();
}

export async function downloadAttachmentFile(
  requesterId: number,
  attachmentId: number,
): Promise<{ blob: Blob; filename: string }> {
  // NOTE: First param is requesterId, second is attachmentId
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(
    new URL(`/api/attachments/${attachmentId}/download`, apiBaseUrl),
    { headers: requesterHeaders(requesterId) },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(
      body?.error?.message || `Failed to download attachment: ${response.status}`,
    ) as AttachmentError;
    err.code = body?.error?.code;
    throw err;
  }

  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename\*?=([^;]+)/);
  const filename = match ? decodeURIComponent(match[1].replace(/UTF-8''/i, "").trim()) : "download";

  const blob = await response.blob();
  return { blob, filename };
}

export async function previewAttachmentFile(
  requesterId: number,
  attachmentId: number,
): Promise<{ blob: Blob; mimeType: string }> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const response = await fetch(
    new URL(`/api/attachments/${attachmentId}/preview`, apiBaseUrl),
    { headers: requesterHeaders(requesterId) },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(
      body?.error?.message || `Failed to preview attachment: ${response.status}`,
    ) as AttachmentError;
    err.code = body?.error?.code;
    throw err;
  }

  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  const blob = await response.blob();
  return { blob, mimeType };
}

export async function removeAttachment(
  requesterId: number,
  attachmentId: number,
  removalReason?: string,
): Promise<AttachmentItem> {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const body = removalReason !== undefined ? { removalReason } : undefined;

  const response = await fetch(
    new URL(`/api/attachments/${attachmentId}`, apiBaseUrl),
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...requesterHeaders(requesterId),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );

  if (!response.ok) {
    const bodyJson = await response.json().catch(() => ({}));
    const err = new Error(
      bodyJson?.error?.message || `Failed to remove attachment: ${response.status}`,
    ) as AttachmentError;
    err.code = bodyJson?.error?.code;
    throw err;
  }

  const result = (await response.json()) as AttachmentRemoveResult;
  return result.data;
}
