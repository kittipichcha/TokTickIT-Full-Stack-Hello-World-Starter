/** Strict additive Lab 4 filters; legacy query parsing remains with its owner. */
export { OPEN_TICKET_STATUSES } from "./ticket-status.js";

export class DashboardFilterError extends Error {
  constructor(public fields: Record<string, string>) {
    super("Validation failed.");
  }
}

function value(query: Record<string, unknown>, key: string): string | undefined {
  if (query[key] === undefined) return undefined;
  const raw = Array.isArray(query[key]) ? (query[key] as unknown[])[0] : query[key];
  if (typeof raw !== "string" || raw === "") {
    throw new DashboardFilterError({ [key]: "A single nonempty value is required." });
  }
  return raw;
}

function timestamp(query: Record<string, unknown>, key: string): Date | undefined {
  const raw = value(query, key);
  if (raw === undefined) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(?:Z|\+00:00)$/.exec(raw);
  const parsed = new Date(raw);
  const canonical = match ? `${match[1]}.${(match[2] ?? "").padEnd(3, "0").slice(0,3)}Z` : "";
  if (!match || !Number.isFinite(parsed.getTime()) || parsed.toISOString() !== canonical) {
    throw new DashboardFilterError({ [key]: "A valid ISO-8601 UTC timestamp is required." });
  }
  return parsed;
}

export function parseRequesterDashboardFilters(query: Record<string, unknown>) {
  const scope = value(query, "scope");
  if (scope !== undefined && scope !== "open") throw new DashboardFilterError({ scope: "scope must be open." });
  if (scope !== undefined && query.status !== undefined) throw new DashboardFilterError({ scope: "scope and status are mutually exclusive." });
  return { scope: scope as "open" | undefined, updatedSince: timestamp(query, "updatedSince"), resolvedSince: timestamp(query, "resolvedSince") };
}

export function parseStaffDashboardFilters(query: Record<string, unknown>) {
  const ownerScope = value(query, "ownerScope");
  if (ownerScope !== undefined && ownerScope !== "me" && ownerScope !== "unassigned") throw new DashboardFilterError({ ownerScope: "ownerScope must be me or unassigned." });
  if (ownerScope !== undefined && query.ownerId !== undefined) throw new DashboardFilterError({ ownerScope: "ownerScope and ownerId are mutually exclusive." });
  const openOnly = value(query, "openOnly");
  if (openOnly !== undefined && openOnly !== "true" && openOnly !== "false") throw new DashboardFilterError({ openOnly: "openOnly must be true or false." });
  return { ownerScope: ownerScope as "me" | "unassigned" | undefined, openOnly: openOnly === "true", updatedSince: timestamp(query, "updatedSince") };
}
