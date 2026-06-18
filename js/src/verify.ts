import { WayIDClient } from "./client.js";
import { decide } from "./policy.js";
import { DEFAULT_HEADER, extractWayId } from "./header.js";
import type {
  Decision,
  Policy,
  Resolution,
  WayIDClientOptions,
} from "./types.js";

export interface VerifyOptions extends WayIDClientOptions {
  /** Inbound header to read the agent's DID from. Default `WayID`. */
  headerName?: string;
  /** Policy applied to produce the decision. */
  policy?: Policy;
  /** Reuse an existing client (so the cache is shared) instead of creating one. */
  client?: WayIDClient;
}

export interface VerifyResult {
  /** Raw header value as presented (or null if absent). */
  presented: string | null;
  resolution: Resolution;
  decision: Decision;
}

/** No header present — a synthetic "not found, fail-open" resolution. */
function absent(): Resolution {
  return {
    ok: true,
    found: false,
    verified: false,
    did: null,
    status: null,
    identityMethod: null,
    identityLevel: null,
    claimedAt: null,
    verifyUrl: null,
    error: "no-header",
  };
}

/**
 * Core gateway primitive shared by every adapter: read the header, resolve it,
 * and produce a decision. Framework-agnostic.
 */
export async function verifyHeaders(
  headers: Headers | Record<string, string | string[] | undefined>,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  const client = options.client ?? new WayIDClient(options);
  const presented = extractWayId(headers, options.headerName ?? DEFAULT_HEADER);
  const resolution = presented ? await client.resolve(presented) : absent();
  return {
    presented,
    resolution,
    decision: decide(resolution, options.policy),
  };
}

/** Identity headers a gateway can forward to its upstream. */
export function upstreamHeaders(result: VerifyResult): Record<string, string> {
  const { resolution, decision } = result;
  const out: Record<string, string> = {
    "X-WayID-Decision": decision,
    "X-WayID-Verified": String(resolution.found && resolution.verified),
  };
  if (resolution.did) out["X-WayID-DID"] = resolution.did;
  if (resolution.identityLevel)
    out["X-WayID-Identity-Level"] = resolution.identityLevel;
  if (resolution.status) out["X-WayID-Status"] = resolution.status;
  return out;
}
