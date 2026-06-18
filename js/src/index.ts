export { WayIDClient } from "./client.js";
export { decide } from "./policy.js";
export { verifyHeaders, upstreamHeaders } from "./verify.js";
export type { VerifyOptions, VerifyResult } from "./verify.js";
export { extractWayId, DEFAULT_HEADER } from "./header.js";
export { normalizeWayId, isValidWayId, bareId } from "./did.js";
export { TtlCache } from "./cache.js";
export type {
  Resolution,
  Card,
  Decision,
  Policy,
  IdentityLevel,
  WayIDClientOptions,
} from "./types.js";
