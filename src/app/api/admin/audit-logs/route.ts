import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_AUDIT_ACTION_VALUES } from "@/lib/audit-events";
import {
  AUDIT_PAGE_SIZE,
  AUDIT_PAGE_SIZE_MAX,
  listAuditLogPage,
  listAuditLogSince,
  type AuditLogFilters,
} from "@/lib/dal/audit-read";
import { getViewer } from "@/lib/dal/session";

/**
 * Historical audit reads for the admin monitor.
 *
 * The database stays the source of truth: the Realtime channel only says "something happened",
 * and the browser comes here for the canonical rows. That also means a dropped or duplicated
 * broadcast cannot corrupt what the operator sees.
 */

const querySchema = z.object({
  action: z.string().min(1).max(64).optional(),
  actorId: z.string().min(1).max(64).optional(),
  sessionId: z.string().min(1).max(64).optional(),
  family: z.enum(["auth", "staff"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  pageSize: z.coerce.number().int().min(1).max(AUDIT_PAGE_SIZE_MAX).optional(),
  /** Keyset cursor: page backwards through history from this point. */
  cursorCreatedAt: z.coerce.date().optional(),
  cursorId: z.string().min(1).max(64).optional(),
  /** Reconnect reconciliation: fetch anything newer than this point instead of paging. */
  sinceCreatedAt: z.coerce.date().optional(),
  sinceId: z.string().min(1).max(64).optional(),
});

export async function GET(request: Request) {
  // Independent of the proxy and of the page that renders this data. A matcher mistake or a
  // direct fetch must not be able to read the audit trail.
  const viewer = await getViewer();
  if (!viewer || !viewer.isVerified || !viewer.isAdmin) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const query = parsed.data;

  if (query.action && !isKnownAction(query.action)) {
    return NextResponse.json({ error: "Unknown action filter." }, { status: 400 });
  }

  const filters: AuditLogFilters = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.sessionId ? { sessionId: query.sessionId } : {}),
    ...(query.family ? { family: query.family } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  };

  if (query.sinceCreatedAt && query.sinceId) {
    const entries = await listAuditLogSince({
      after: { createdAt: query.sinceCreatedAt, id: query.sinceId },
      filters,
      limit: query.pageSize ?? AUDIT_PAGE_SIZE,
    });

    return NextResponse.json(
      { entries, nextCursor: null },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const page = await listAuditLogPage({
    filters,
    cursor:
      query.cursorCreatedAt && query.cursorId
        ? { createdAt: query.cursorCreatedAt, id: query.cursorId }
        : null,
    pageSize: query.pageSize ?? AUDIT_PAGE_SIZE,
  });

  return NextResponse.json(page, { headers: { "cache-control": "no-store" } });
}

/**
 * Staff actions are dotted lowercase and open-ended, so they are shape-checked rather than
 * enumerated; authentication actions are a closed set.
 */
function isKnownAction(action: string): boolean {
  return (
    (AUTH_AUDIT_ACTION_VALUES as readonly string[]).includes(action) ||
    /^[a-z][a-z.]{1,62}[a-z]$/.test(action)
  );
}
