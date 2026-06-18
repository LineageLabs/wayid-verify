import { TtlCache } from "./cache.js";
import { bareId, normalizeWayId } from "./did.js";
import type { Card, Resolution, WayIDClientOptions } from "./types.js";

const DEFAULTS = {
  issuer: "https://way.je",
  timeoutMs: 2000,
  cacheTtlMs: 60_000,
  negativeCacheTtlMs: 10_000,
};

interface AgentLookupResponse {
  verified?: boolean;
  owner?: {
    identityMethod?: string | null;
    identityLevel?: string | null;
    claimedAt?: string | null;
  } | null;
  certificate?: {
    id?: string | null;
    status?: string | null;
    verifyUrl?: string | null;
  } | null;
}

function unknown(did: string | null, error: string): Resolution {
  return {
    ok: false,
    found: false,
    verified: false,
    did,
    status: null,
    identityMethod: null,
    identityLevel: null,
    claimedAt: null,
    verifyUrl: null,
    error,
  };
}

/**
 * Resolves WayID DIDs against the issuer's public lookup endpoints, with an
 * in-memory TTL cache. Fails open: lookup errors return `{ ok: false }` rather
 * than throwing, so a verifier outage never breaks the calling gateway.
 */
export class WayIDClient {
  private readonly issuer: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly negativeCacheTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly cache: TtlCache<Resolution>;

  constructor(options: WayIDClientOptions = {}) {
    this.issuer = (options.issuer ?? DEFAULTS.issuer).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULTS.cacheTtlMs;
    this.negativeCacheTtlMs =
      options.negativeCacheTtlMs ?? DEFAULTS.negativeCacheTtlMs;
    const f = options.fetch ?? globalThis.fetch;
    if (!f)
      throw new Error("No fetch implementation available; pass options.fetch");
    this.fetchImpl = f;
    this.cache = new TtlCache<Resolution>(options.now);
  }

  /** Resolve a DID (or bare tail). Never throws. */
  async resolve(input: string): Promise<Resolution> {
    const did = normalizeWayId(input ?? "");
    if (!did) return { ...unknown(null, "invalid-did"), ok: true };

    const cached = this.cache.get(did);
    if (cached) return cached;

    let res: Response;
    try {
      res = await this.timedFetch(`${this.issuer}/api/v1/agent/${bareId(did)}`);
    } catch (err) {
      return unknown(
        did,
        err instanceof Error && err.name === "AbortError"
          ? "timeout"
          : "network",
      );
    }

    if (res.status === 404) {
      const miss: Resolution = { ...unknown(did, "not-found"), ok: true };
      this.cache.set(did, miss, this.negativeCacheTtlMs);
      return miss;
    }
    if (res.status === 429) return unknown(did, "rate-limited");
    if (!res.ok) return unknown(did, `http-${res.status}`);

    let body: AgentLookupResponse;
    try {
      body = (await res.json()) as AgentLookupResponse;
    } catch {
      return unknown(did, "bad-json");
    }

    const level = body.owner?.identityLevel;
    const resolution: Resolution = {
      ok: true,
      found: true,
      verified: body.verified === true,
      did,
      status: body.certificate?.status ?? null,
      identityMethod: body.owner?.identityMethod ?? null,
      identityLevel:
        level === "verified" || level === "unverified" ? level : null,
      claimedAt: body.owner?.claimedAt ?? null,
      verifyUrl: body.certificate?.verifyUrl ?? null,
    };
    this.cache.set(did, resolution, this.cacheTtlMs);
    return resolution;
  }

  /** Fetch the narrow display card. Returns null if not found or on error. */
  async card(input: string): Promise<Card | null> {
    const did = normalizeWayId(input ?? "");
    if (!did) return null;
    try {
      const res = await this.timedFetch(
        `${this.issuer}/api/v1/agent/${bareId(did)}/card`,
      );
      if (!res.ok) return null;
      return (await res.json()) as Card;
    } catch {
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async timedFetch(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
