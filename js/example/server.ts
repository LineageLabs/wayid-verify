/**
 * Minimal gateway demo. Run with Bun (no express dependency needed):
 *
 *   WAYID_ISSUER=http://localhost:5173 bun run example/server.ts
 *   curl -H 'WayID: wayid:agent:<did>' http://localhost:8787/
 *
 * Prints the resolved identity of whatever agent calls it.
 */
import { verifyHeaders, upstreamHeaders } from "../src/verify.js";

const issuer = process.env.WAYID_ISSUER ?? "https://way.je";
const port = Number(process.env.PORT ?? 8787);

Bun.serve({
  port,
  async fetch(req) {
    const result = await verifyHeaders(req.headers, {
      issuer,
      policy: { requireVerified: false },
    });
    const { presented, resolution, decision } = result;
    const summary = {
      decision,
      presented,
      did: resolution.did,
      found: resolution.found,
      identityLevel: resolution.identityLevel,
      status: resolution.status,
      verifyUrl: resolution.verifyUrl
        ? `${issuer}${resolution.verifyUrl}`
        : null,
    };
    console.log(
      `[${decision}]`,
      presented ?? "(no WayID header)",
      "→",
      resolution.identityLevel ?? "unknown",
    );
    return new Response(JSON.stringify(summary, null, 2), {
      headers: {
        "content-type": "application/json",
        ...upstreamHeaders(result),
      },
    });
  },
});

console.log(
  `wayid-verify demo gateway on http://localhost:${port} (issuer: ${issuer})`,
);
