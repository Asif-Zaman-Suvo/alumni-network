"use client";

import * as React from "react";
import { format } from "date-fns";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auditActionLabel, AUTH_AUDIT_ACTIONS } from "@/lib/audit-events";
import {
  createRealtimeClient,
  subscribeToAuditChannel,
} from "@/lib/supabase/browser";

/**
 * Live audit monitor.
 *
 * The Realtime channel is treated as an invalidation signal, never as data: every row rendered
 * here came from the admin API, so a dropped, duplicated, or out-of-order broadcast cannot make
 * the table disagree with the database. That also means the component degrades cleanly — with the
 * socket down it is still a working paginated history.
 */

export type AuditRow = {
  id: string;
  action: string;
  actionLabel: string;
  isAuthEvent: boolean;
  createdAt: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  sessionId: string | null;
  provider: string | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
};

type Cursor = { createdAt: string; id: string };

type ConnectionState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "unavailable"
  | "offline";

/** Caps memory on a long-lived dashboard; history beyond this is reachable via Load more. */
const MAX_ROWS = 500;

const FAMILY_FILTERS = [
  { value: "", label: "Everything" },
  { value: "auth", label: "Authentication" },
  { value: "staff", label: "Admin actions" },
] as const;

const ACTION_FILTERS = [
  { value: "", label: "Any event" },
  ...Object.values(AUTH_AUDIT_ACTIONS).map((action) => ({
    value: action,
    label: auditActionLabel(action),
  })),
] as const;

type Filters = { family: string; action: string };

export function AuditLogLive({
  initialRows,
  initialCursor,
  realtimeEnabled,
  publishableKey,
}: {
  initialRows: AuditRow[];
  initialCursor: Cursor | null;
  realtimeEnabled: boolean;
  publishableKey: string | null;
}) {
  const [filters, setFilters] = React.useState<Filters>({ family: "", action: "" });
  const [rows, setRows] = React.useState<AuditRow[]>(initialRows);
  const [cursor, setCursor] = React.useState<Cursor | null>(initialCursor);
  const [connection, setConnection] = React.useState<ConnectionState>(
    realtimeEnabled && publishableKey ? "connecting" : "unavailable",
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * The newest row currently displayed. Held in a ref as well as state because the Realtime
   * callback closes over it and must always see the latest value without re-subscribing (which
   * would tear down and rebuild the socket on every incoming event).
   */
  const newestRef = React.useRef<Cursor | null>(
    initialRows[0] ? { createdAt: initialRows[0].createdAt, id: initialRows[0].id } : null,
  );
  /**
   * Filters are also mirrored into a ref so the fetch helpers can stay referentially stable. If
   * they depended on `filters` directly, the Realtime effect below would tear down and rebuild the
   * socket every time the operator changed a dropdown.
   */
  const filtersRef = React.useRef(filters);
  React.useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const buildQuery = React.useCallback((extra: Record<string, string>) => {
    const params = new URLSearchParams(extra);
    const current = filtersRef.current;
    if (current.family) params.set("family", current.family);
    if (current.action) params.set("action", current.action);
    return params;
  }, []);

  const loadFirstPage = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/audit-logs?${buildQuery({})}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Request failed");

      const data = (await response.json()) as {
        entries: AuditRow[];
        nextCursor: Cursor | null;
      };
      setRows(data.entries);
      setCursor(data.nextCursor);
      const first = data.entries[0];
      newestRef.current = first ? { createdAt: first.createdAt, id: first.id } : null;
    } catch {
      setError("Could not load the audit log. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery]);

  /** Pulls anything committed since the newest row we hold. Also the reconnect repair path. */
  const reconcile = React.useCallback(async () => {
    const newest = newestRef.current;
    if (!newest) {
      // Nothing on screen to anchor to, so there is no "since" — reload the first page instead.
      await loadFirstPage();
      return;
    }

    try {
      const params = buildQuery({
        sinceCreatedAt: newest.createdAt,
        sinceId: newest.id,
      });
      const response = await fetch(`/api/admin/audit-logs?${params}`, {
        cache: "no-store",
      });
      if (!response.ok) return;

      const data = (await response.json()) as { entries: AuditRow[] };
      if (data.entries.length === 0) return;

      setRows((previous) => mergeRows(data.entries, previous));
      const first = data.entries[0];
      if (first) newestRef.current = { createdAt: first.createdAt, id: first.id };
    } catch {
      // A failed reconcile is recoverable: the next event or reconnect tries again.
    }
  }, [buildQuery, loadFirstPage]);

  const loadMore = React.useCallback(async () => {
    if (!cursor) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        cursorCreatedAt: cursor.createdAt,
        cursorId: cursor.id,
      });
      const response = await fetch(`/api/admin/audit-logs?${params}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Request failed");

      const data = (await response.json()) as {
        entries: AuditRow[];
        nextCursor: Cursor | null;
      };
      // Older rows append, so MAX_ROWS is not applied here: the operator asked for these.
      setRows((previous) => dedupe([...previous, ...data.entries]));
      setCursor(data.nextCursor);
    } catch {
      setError("Could not load more entries. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery, cursor]);

  // Refetch from the top whenever the filter changes. Filtering client-side would silently
  // exclude rows that were never fetched.
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void loadFirstPage();
  }, [filters, loadFirstPage]);

  React.useEffect(() => {
    if (!realtimeEnabled || !publishableKey) return;

    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function connect() {
      try {
        const response = await fetch("/api/admin/realtime-token", { method: "POST" });
        if (!response.ok) {
          if (!cancelled) setConnection("unavailable");
          return;
        }

        const { token, expiresAt, topic, supabaseUrl } = (await response.json()) as {
          token: string;
          expiresAt: number;
          topic: string;
          supabaseUrl: string;
        };
        if (cancelled) return;

        client = createRealtimeClient(supabaseUrl, publishableKey!);
        // Realtime authorizes the join against these claims, not the publishable key.
        await client.realtime.setAuth(token);

        channel = subscribeToAuditChannel(client, topic, {
          onEvent: () => {
            // The payload is intentionally minimal, so it is used only as a prompt to re-read
            // the canonical rows from the API.
            void reconcile();
          },
          onStatusChange: (status) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              setConnection("live");
              // Fill the gap between the server render and the socket becoming ready.
              void reconcile();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setConnection("reconnecting");
            } else if (status === "CLOSED") {
              setConnection("offline");
            }
          },
        });

        // Tokens are deliberately short-lived, so refresh ahead of expiry rather than letting
        // the socket drop. A revoked administrator loses access when the refresh is denied.
        const leadTimeMs = 60_000;
        const delay = Math.max(30_000, expiresAt - Date.now() - leadTimeMs);
        refreshTimer = setTimeout(() => {
          void (async () => {
            const refreshed = await fetch("/api/admin/realtime-token", { method: "POST" });
            if (!refreshed.ok) {
              if (!cancelled) setConnection("unavailable");
              return;
            }
            const next = (await refreshed.json()) as { token: string };
            await client?.realtime.setAuth(next.token);
          })();
        }, delay);
      } catch {
        if (!cancelled) setConnection("unavailable");
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (channel && client) void client.removeChannel(channel);
      void client?.realtime.disconnect();
    };
  }, [realtimeEnabled, publishableKey, reconcile]);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Audit log</CardTitle>
            <CardDescription>
              Append-only record of sign-ins, sign-outs, session changes and admin actions.
            </CardDescription>
          </div>
          <ConnectionBadge state={connection} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Category"
            value={filters.family}
            options={FAMILY_FILTERS}
            onChange={(family) => setFilters({ family, action: "" })}
          />
          <FilterSelect
            label="Event"
            value={filters.action}
            options={ACTION_FILTERS}
            onChange={(action) => setFilters((prev) => ({ ...prev, action }))}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={() => void loadFirstPage()}
          >
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <p className="px-6 pb-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="w-10 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {isLoading ? "Loading…" : "Nothing recorded yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <AuditTableRow
                  key={row.id}
                  row={row}
                  expanded={expandedId === row.id}
                  onToggle={() =>
                    setExpandedId((current) => (current === row.id ? null : row.id))
                  }
                />
              ))
            )}
          </TableBody>
        </Table>

        {cursor ? (
          <div className="flex justify-center border-t p-4">
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadMore()}
            >
              {isLoading ? "Loading…" : "Load older entries"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AuditTableRow({
  row,
  expanded,
  onToggle,
}: {
  row: AuditRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
          {format(new Date(row.createdAt), "d MMM yyyy, HH:mm:ss")}
        </TableCell>
        <TableCell className="text-xs">
          {row.actorEmail ?? (
            <span className="text-muted-foreground">
              {/* A failed sign-in for an unknown address has no actor by design. */}
              unknown
            </span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={badgeVariantFor(row.action)}>{row.actionLabel}</Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {describe(row)}
        </TableCell>
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide details" : "Show details"}
          >
            {expanded ? "−" : "+"}
          </Button>
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/40">
            <dl className="grid grid-cols-1 gap-2 py-2 text-xs sm:grid-cols-2">
              <Detail label="Event" value={row.action} />
              <Detail label="Provider" value={row.provider} />
              <Detail label="Reason" value={row.reason} />
              <Detail label="Session" value={row.sessionId} mono />
              <Detail label="Actor ID" value={row.actorId} mono />
              <Detail
                label="Target"
                value={row.targetType ? `${row.targetType}/${row.targetId}` : null}
                mono
              />
              <Detail label="IP address" value={row.ipAddress} mono />
              <Detail label="User agent" value={row.userAgent} />
              {row.metadata ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Metadata</dt>
                  <dd className="mt-1 overflow-x-auto rounded bg-background p-2 font-mono text-[11px]">
                    {JSON.stringify(row.metadata, null, 2)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono break-all" : "break-words"}>{value}</dd>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const config: Record<ConnectionState, { label: string; variant: BadgeVariant }> = {
    connecting: { label: "Connecting…", variant: "secondary" },
    live: { label: "Live", variant: "success" },
    reconnecting: { label: "Reconnecting…", variant: "secondary" },
    offline: { label: "Offline", variant: "secondary" },
    unavailable: { label: "Live updates off", variant: "outline" },
  };

  const { label, variant } = config[state];
  return (
    <Badge variant={variant} aria-live="polite">
      {label}
    </Badge>
  );
}

type BadgeVariant = "secondary" | "success" | "destructive" | "outline";

function badgeVariantFor(action: string): BadgeVariant {
  if (
    action === AUTH_AUDIT_ACTIONS.loginFailed ||
    action === AUTH_AUDIT_ACTIONS.sessionRevoked ||
    action.includes("reject") ||
    action.includes("suspend")
  ) {
    return "destructive";
  }
  if (action === AUTH_AUDIT_ACTIONS.loginSuccess || action.includes("approve")) {
    return "success";
  }
  return "secondary";
}

/** One-line summary for the collapsed row. */
function describe(row: AuditRow): string {
  if (row.isAuthEvent) {
    const parts = [row.provider, row.reason].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "—";
  }
  if (row.targetType && row.targetId) {
    return `${row.targetType}/${row.targetId.slice(0, 10)}`;
  }
  return "—";
}

/**
 * Prepends newly-arrived rows, dropping any the list already holds.
 *
 * De-duplication is by audit id rather than timestamp: the same row can legitimately arrive twice
 * (a broadcast plus a reconnect reconcile), and two distinct rows can share a millisecond.
 */
function mergeRows(incoming: AuditRow[], existing: AuditRow[]): AuditRow[] {
  const seen = new Set(existing.map((row) => row.id));
  const fresh = incoming.filter((row) => !seen.has(row.id));
  if (fresh.length === 0) return existing;
  return [...fresh, ...existing].slice(0, MAX_ROWS);
}

function dedupe(rows: AuditRow[]): AuditRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}
