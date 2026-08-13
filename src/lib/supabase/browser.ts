import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client, used only to subscribe to the private audit channel.
 *
 * Distinct from src/lib/storage.ts, which holds the service-role key and must never reach the
 * browser. This client is created with the publishable key and then has its access token replaced
 * by a short-lived token minted for the signed-in administrator — the publishable key on its own
 * authorizes nothing, because the RLS policy on `realtime.messages` requires our custom claims.
 */

export type AuditBroadcastPayload = {
  id: string;
  action: string;
  createdAt: string;
  actorEmail: string | null;
  actorRole: string | null;
  provider: string | null;
  reason: string | null;
};

export const AUDIT_BROADCAST_EVENT = "audit_log_created";

/**
 * One client per page, recreated only when the URL or key changes. The Realtime socket is a
 * shared resource; creating a client per render would open a socket per render.
 */
export function createRealtimeClient(
  supabaseUrl: string,
  publishableKey: string,
): SupabaseClient {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      // There is no Supabase session to persist or refresh; tokens come from our own endpoint.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 20 },
    },
  });
}

/**
 * Subscribes to the private audit topic.
 *
 * `private: true` makes Realtime run the RLS policy before allowing the join, so an alumnus who
 * somehow obtains a token still cannot subscribe. The returned channel must be removed by the
 * caller on unmount.
 */
export function subscribeToAuditChannel(
  client: SupabaseClient,
  topic: string,
  handlers: {
    onEvent: (payload: AuditBroadcastPayload) => void;
    onStatusChange: (status: string) => void;
  },
): RealtimeChannel {
  const channel = client.channel(topic, { config: { private: true } });

  channel
    .on("broadcast", { event: AUDIT_BROADCAST_EVENT }, (message) => {
      const payload = message.payload as { record?: AuditBroadcastPayload } | AuditBroadcastPayload;
      // realtime.send delivers the jsonb as-is; broadcast_changes would wrap it in `record`.
      // Accept both so the trigger can change shape without breaking the client.
      const record = "record" in payload && payload.record ? payload.record : payload;
      if (record && typeof (record as AuditBroadcastPayload).id === "string") {
        handlers.onEvent(record as AuditBroadcastPayload);
      }
    })
    .subscribe((status) => handlers.onStatusChange(status));

  return channel;
}
