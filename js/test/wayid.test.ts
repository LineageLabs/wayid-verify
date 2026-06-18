import { describe, expect, test } from "bun:test";
import { WayIDClient } from "../src/client.js";
import { decide } from "../src/policy.js";
import { normalizeWayId, isValidWayId, bareId } from "../src/did.js";
import { extractWayId } from "../src/header.js";
import { TtlCache } from "../src/cache.js";
import { verifyHeaders, upstreamHeaders } from "../src/verify.js";
import type { Resolution } from "../src/types.js";

const FULL = "wayid:agent:3yQ8mNpRsTuVwXyZabcdefgh";
const TAIL = "3yQ8mNpRsTuVwXyZabcdefgh";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const FOUND_BODY = {
  verified: true,
  owner: {
    identityMethod: "concordium",
    identityLevel: "verified",
    claimedAt: "2026-04-01T12:00:00Z",
  },
  certificate: {
    id: FULL,
    status: "active",
    verifyUrl: "/agent/sebastian-bot",
  },
};

/** Build a client with a stubbed fetch that records calls. */
function stub(
  handler: (url: string) => Response | Promise<Response>,
  now?: () => number,
) {
  const calls: string[] = [];
  const client = new WayIDClient({
    issuer: "https://way.test",
    fetch: (async (url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url.toString();
      calls.push(u);
      return handler(u);
    }) as typeof fetch,
    now,
  });
  return { client, calls };
}

describe("did", () => {
  test("normalizes full DID and bare tail", () => {
    expect(normalizeWayId(FULL)).toBe(FULL);
    expect(normalizeWayId(TAIL)).toBe(FULL);
    expect(normalizeWayId(`  ${TAIL}  `)).toBe(FULL);
  });
  test("rejects malformed input", () => {
    expect(normalizeWayId("nope")).toBeNull();
    expect(normalizeWayId("wayid:agent:short")).toBeNull();
    expect(normalizeWayId("wayid:agent:0OIl000000000000000000000")).toBeNull(); // 0,O,I,l not base58
    expect(isValidWayId(TAIL)).toBe(false);
    expect(isValidWayId(FULL)).toBe(true);
  });
  test("bareId strips prefix", () => {
    expect(bareId(FULL)).toBe(TAIL);
    expect(bareId(TAIL)).toBe(TAIL);
  });
});

describe("resolve — three states", () => {
  test("found + verified", async () => {
    const { client, calls } = stub(() => jsonResponse(FOUND_BODY));
    const r = await client.resolve(FULL);
    expect(r).toMatchObject({
      ok: true,
      found: true,
      verified: true,
      status: "active",
      identityLevel: "verified",
    });
    expect(calls[0]).toBe(`https://way.test/api/v1/agent/${TAIL}`); // bare tail in URL
  });
  test("found + unverified owner", async () => {
    const body = {
      ...FOUND_BODY,
      owner: {
        identityMethod: null,
        identityLevel: "unverified",
        claimedAt: null,
      },
    };
    const { client } = stub(() => jsonResponse(body));
    const r = await client.resolve(FULL);
    expect(r).toMatchObject({
      found: true,
      identityLevel: "unverified",
      identityMethod: null,
    });
  });
  test("404 → not found", async () => {
    const { client } = stub(() => jsonResponse({ error: {} }, 404));
    const r = await client.resolve(FULL);
    expect(r).toMatchObject({ ok: true, found: false, error: "not-found" });
  });
  test("bare tail resolves identically to full DID", async () => {
    const { client } = stub(() => jsonResponse(FOUND_BODY));
    const a = await client.resolve(FULL);
    client.clearCache();
    const b = await client.resolve(TAIL);
    expect(b).toEqual(a);
  });
  test("invalid DID → ok:true, not-found, no fetch", async () => {
    const { client, calls } = stub(() => jsonResponse(FOUND_BODY));
    const r = await client.resolve("garbage");
    expect(r).toMatchObject({ ok: true, found: false, error: "invalid-did" });
    expect(calls.length).toBe(0);
  });
});

describe("resolve — fail open", () => {
  test("5xx → ok:false", async () => {
    const { client } = stub(() => new Response("boom", { status: 503 }));
    const r = await client.resolve(FULL);
    expect(r).toMatchObject({ ok: false, error: "http-503" });
  });
  test("429 → ok:false rate-limited", async () => {
    const { client } = stub(() => new Response("", { status: 429 }));
    const r = await client.resolve(FULL);
    expect(r).toMatchObject({ ok: false, error: "rate-limited" });
  });
  test("network throw → ok:false network", async () => {
    const { client } = stub(() => {
      throw new Error("ECONNREFUSED");
    });
    const r = await client.resolve(FULL);
    expect(r).toMatchObject({ ok: false, error: "network" });
  });
});

describe("cache", () => {
  test("positive result cached (one fetch)", async () => {
    const { client, calls } = stub(() => jsonResponse(FOUND_BODY));
    await client.resolve(FULL);
    await client.resolve(TAIL); // same DID, normalized
    expect(calls.length).toBe(1);
  });
  test("errors are not cached (retried)", async () => {
    const { client, calls } = stub(() => new Response("", { status: 503 }));
    await client.resolve(FULL);
    await client.resolve(FULL);
    expect(calls.length).toBe(2);
  });
  test("TtlCache expires", () => {
    let t = 1000;
    const c = new TtlCache<string>(() => t);
    c.set("k", "v", 100);
    expect(c.get("k")).toBe("v");
    t = 1101;
    expect(c.get("k")).toBeUndefined();
  });
});

describe("policy.decide", () => {
  const base: Resolution = {
    ok: true,
    found: true,
    verified: true,
    did: FULL,
    status: "active",
    identityMethod: "concordium",
    identityLevel: "verified",
    claimedAt: null,
    verifyUrl: null,
  };
  test("allow active verified", () => {
    expect(decide(base)).toBe("allow");
  });
  test("deny suspended", () => {
    expect(decide({ ...base, status: "suspended" })).toBe("deny");
  });
  test("unverified: flag by default, deny when requireVerified", () => {
    const r = { ...base, identityLevel: "unverified" as const };
    expect(decide(r)).toBe("allow"); // active + present is allowed by default
    expect(decide(r, { requireVerified: true })).toBe("deny");
  });
  test("not found: flag, or deny when requireVerified", () => {
    const r = { ...base, found: false };
    expect(decide(r)).toBe("flag");
    expect(decide(r, { requireVerified: true })).toBe("deny");
  });
  test("fail open vs fail closed on outage", () => {
    const r = { ...base, ok: false };
    expect(decide(r)).toBe("flag");
    expect(decide(r, { failClosed: true })).toBe("deny");
  });
});

describe("header + verifyHeaders", () => {
  test("extract from node bag and Headers", () => {
    expect(extractWayId({ wayid: FULL })).toBe(FULL);
    expect(extractWayId({ wayid: [FULL, "x"] })).toBe(FULL);
    expect(extractWayId(new Headers({ WayID: FULL }))).toBe(FULL);
    expect(extractWayId({})).toBeNull();
  });
  test("no header → flag, no fetch", async () => {
    const { client, calls } = stub(() => jsonResponse(FOUND_BODY));
    const result = await verifyHeaders({}, { client });
    expect(result.presented).toBeNull();
    expect(result.decision).toBe("flag");
    expect(calls.length).toBe(0);
  });
  test("present + verified → allow + upstream headers", async () => {
    const { client } = stub(() => jsonResponse(FOUND_BODY));
    const result = await verifyHeaders({ wayid: TAIL }, { client });
    expect(result.decision).toBe("allow");
    const h = upstreamHeaders(result);
    expect(h["X-WayID-Verified"]).toBe("true");
    expect(h["X-WayID-DID"]).toBe(FULL);
    expect(h["X-WayID-Identity-Level"]).toBe("verified");
  });
});
