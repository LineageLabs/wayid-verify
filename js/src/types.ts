export type IdentityLevel = "verified" | "unverified";

/** Result of resolving a WayID DID against the issuer. */
export interface Resolution {
  /** Lookup completed (HTTP 200 or 404). `false` on network error / timeout / 5xx / 429. */
  ok: boolean;
  /** The agent exists and is a registered WayID. */
  found: boolean;
  /** The issuer's top-level `verified` flag (a registered agent). */
  verified: boolean;
  did: string | null;
  /** Certificate status, e.g. `active` / `suspended` / `revoked`. */
  status: string | null;
  /** Owner identity provider, e.g. `concordium` / `google` / `github`. */
  identityMethod: string | null;
  identityLevel: IdentityLevel | null;
  claimedAt: string | null;
  /** Relative cert page URL on the issuer, e.g. `/agent/sebastian-bot`. */
  verifyUrl: string | null;
  /** Set when `ok` is false or the DID was malformed. */
  error?: string;
}

/** Narrow display projection from `GET /api/v1/agent/{did}/card`. */
export interface Card {
  displayName: string | null;
  owner: { displayName: string | null; username: string | null } | null;
  verificationStatus: string;
  telegramHandle: string | null;
  certificateUrl: string | null;
}

export interface WayIDClientOptions {
  /** Issuer origin that minted the DID. Default `https://way.je`. */
  issuer?: string;
  /** Per-request timeout in ms. Default 2000. */
  timeoutMs?: number;
  /** TTL for positive (found) results in ms. Default 60000. */
  cacheTtlMs?: number;
  /** TTL for negative (404) results in ms. Default 10000. */
  negativeCacheTtlMs?: number;
  /** Injectable fetch (for tests / non-global environments). */
  fetch?: typeof fetch;
  /** Injectable clock (for tests). */
  now?: () => number;
}

export type Decision = "allow" | "deny" | "flag";

export interface Policy {
  /** Require the owner identity to be `verified`. Default false. */
  requireVerified?: boolean;
  /** Allowed certificate statuses. Default `['active']`. */
  allowStatuses?: string[];
  /**
   * When the lookup could not complete (verifier outage, timeout, 429), deny
   * instead of failing open. Default false (fail open — never block on outage).
   */
  failClosed?: boolean;
}
