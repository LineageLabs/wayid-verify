/*
 * End-to-end check over real HTTP: a mock WayID issuer + a gateway built on the
 * SDK. Exercises real fetch, header parsing, caching, policy, and upstream
 * headers. Run: `bun run example/e2e.ts`
 */
import { verifyHeaders, upstreamHeaders } from "../src/verify.js";

const ISSUER_PORT = 5199;
const GW_PORT = 8788;
const FULL = "wayid:agent:3yQ8mNpRsTuVwXyZabcdefgh";
const BARE = "3yQ8mNpRsTuVwXyZabcdefgh";

const issuer = Bun.serve({
  port: ISSUER_PORT,
  fetch(req) {
    const m = new URL(req.url).pathname.match(/^\/api\/v1\/agent\/([^/]+)$/);
    if (m && m[1] === BARE) {
      return Response.json({
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
      });
    }
    return new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  },
});

const gw = Bun.serve({
  port: GW_PORT,
  async fetch(req) {
    const result = await verifyHeaders(req.headers, {
      issuer: `http://localhost:${ISSUER_PORT}`,
    });
    return new Response(JSON.stringify({ decision: result.decision }), {
      headers: {
        "content-type": "application/json",
        ...upstreamHeaders(result),
      },
    });
  },
});

async function check(
  name: string,
  headers: Record<string, string>,
  expectDecision: string,
  expectVerified: string,
  expectStatus = 200,
): Promise<boolean> {
  const r = await fetch(`http://localhost:${GW_PORT}/`, { headers });
  const decision = r.headers.get("X-WayID-Decision");
  const verified = r.headers.get("X-WayID-Verified");
  const ok =
    r.status === expectStatus &&
    decision === expectDecision &&
    verified === expectVerified;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}: status=${r.status} decision=${decision} verified=${verified}`,
  );
  return ok;
}

let pass = true;
pass =
  (await check("verified (full DID)", { WayID: FULL }, "allow", "true")) &&
  pass;
pass =
  (await check("verified (bare tail)", { WayID: BARE }, "allow", "true")) &&
  pass;
pass =
  (await check(
    "unknown DID (fail open)",
    { WayID: "zzzzzzzzzzzzzzzzzzzzzzzz" },
    "flag",
    "false",
  )) && pass;
pass = (await check("no header (fail open)", {}, "flag", "false")) && pass;

issuer.stop();
gw.stop();
console.log(pass ? "\nE2E PASS" : "\nE2E FAIL");
process.exit(pass ? 0 : 1);
