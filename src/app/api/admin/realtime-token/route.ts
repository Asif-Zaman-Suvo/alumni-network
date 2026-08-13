import { NextResponse } from "next/server";
import { clientEnv } from "@/env";
import { getViewer } from "@/lib/dal/session";
import {
  isRealtimeConfigured,
  mintAuditChannelToken,
  RealtimeTokenUnavailableError,
} from "@/lib/supabase/realtime-token";

/**
 * Issues a short-lived Realtime token to an administrator.
 *
 * This endpoint is the only thing standing between a signed-in alumnus and a subscription to the
 * audit stream, so it re-checks the role itself rather than trusting the proxy or the page that
 * called it. The RLS policy on `realtime.messages` then re-checks the minted claims against the
 * database, which is what makes a stale token useless after revocation.
 */
export async function POST() {
  const viewer = await getViewer();
  if (!viewer || !viewer.isVerified || !viewer.isAdmin) {
    // 404 rather than 403: a distinct status would confirm the endpoint exists.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!isRealtimeConfigured()) {
    // Not an error the operator can act on from the browser. The dashboard degrades to manual
    // refresh, which is why this is 503 and not 500.
    return NextResponse.json(
      { error: "Live updates are not configured." },
      { status: 503 },
    );
  }

  try {
    const minted = await mintAuditChannelToken(viewer);
    return NextResponse.json(
      {
        token: minted.token,
        expiresAt: minted.expiresAt,
        topic: minted.topic,
        supabaseUrl: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RealtimeTokenUnavailableError) {
      return NextResponse.json(
        { error: "Live updates are not configured." },
        { status: 503 },
      );
    }
    throw error;
  }
}
