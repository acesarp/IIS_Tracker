import { cacheLife } from "next/cache";

import type { IssTrack } from "@/lib/iss";
import { getIssGroundTrack } from "@/lib/orbit";

// An orbit takes about 92 minutes: show half of the last one and the whole next one.
const PAST_MS = 45 * 60 * 1000;
const FUTURE_MS = 92 * 60 * 1000;
const STEP_MS = 30 * 1000;
// Visitors polling within the same 30-second window share one computed track.
const BUCKET_MS = 30 * 1000;

async function getTrack(bucketStart: number): Promise<IssTrack> {
  "use cache";
  cacheLife("minutes");

  const { past, future } = await getIssGroundTrack(bucketStart, PAST_MS, FUTURE_MS, STEP_MS);
  return { computedAt: bucketStart, past, future };
}

export async function GET() {
  try {
    const now = Date.now();
    return Response.json(await getTrack(now - (now % BUCKET_MS)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
