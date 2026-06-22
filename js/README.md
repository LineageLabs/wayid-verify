# @lineagelabs/wayid-verify

Verify the **WayID** of an AI agent at your gateway, reverse proxy, or API backend.

[WayID](https://way.je) binds a verified human or business identity to their AI
agents. This package lets a relying party answer _"what kind of agent is calling
me?"_ in one call — no user flow, no crypto to maintain.

```bash
npm install @lineagelabs/wayid-verify
```

Not on npm yet? Install the tarball attached to a GitHub release (no registry):

```bash
npm install https://github.com/LineageLabs/wayid-verify/releases/download/js-v0.1.0/lineagelabs-wayid-verify-0.1.0.tgz
```

Zero runtime dependencies. Works on Node 18+, Bun, and Cloudflare Workers.

## Quick start

An agent declares its identity with a request header:

```
WayID: wayid:agent:{24-char-base58}      # full DID or the bare 24-char tail
```

### Core resolver

```ts
import { WayIDClient, decide } from "@lineagelabs/wayid-verify";

const client = new WayIDClient({ issuer: "https://way.je" });

const res = await client.resolve("wayid:agent:3yQ8mNpRsTuVwXyZabcdefgh");
// { ok, found, verified, did, status, identityMethod, identityLevel, claimedAt, verifyUrl }

decide(res, { requireVerified: true }); // "allow" | "deny" | "flag"
```

### Express / Connect

```ts
import { wayIdMiddleware } from "@lineagelabs/wayid-verify/express";

app.use(wayIdMiddleware({ issuer: "https://way.je" /*, enforce: true */ }));

app.get("/", (req, res) => {
  res.json(req.wayid); // { presented, resolution, decision }
});
```

The middleware tags `req.wayid`, forwards `X-WayID-*` headers to your upstream, and
(with `enforce: true`) returns `403` on a `deny` decision.

### Cloudflare Worker / Hono / Fetch

```ts
import { withWayId, verifyRequest } from "@lineagelabs/wayid-verify/worker";

export default {
  fetch: withWayId(
    async (request, result) => {
      // request has X-WayID-* headers added; result is the verification
      return new Response(`decision: ${result.decision}`);
    },
    { issuer: "https://way.je" },
  ),
};
```

## Behaviour

- **Caching** — resolutions are cached in-process (TTL configurable; 404s cached
  briefly). The WayID v1 lookup routes are uncached server-side, so the client caches.
- **Fails open** — a verifier outage, timeout, 429, or unknown DID never throws and
  never blocks traffic; the request is tagged and served. Set `Policy.failClosed` or
  the middleware's `enforce` to change that.

### Options

| Option               | Default          | Meaning                                          |
| -------------------- | ---------------- | ------------------------------------------------ |
| `issuer`             | `https://way.je` | Issuer origin that minted the DIDs               |
| `timeoutMs`          | `2000`           | Per-request lookup timeout                       |
| `cacheTtlMs`         | `60000`          | TTL for found results                            |
| `negativeCacheTtlMs` | `10000`          | TTL for 404 results                              |
| `headerName`         | `WayID`          | Inbound header to read the DID from              |
| `policy`             | —                | `requireVerified`, `allowStatuses`, `failClosed` |

## Identification, not authentication

The v1 `WayID` header is _self-asserted_: it proves the named DID exists and is
owner-verified, not that the caller holds the agent's private key. That is the right
tool for attribution. Cryptographic proof-of-possession is a planned v2 layer built
on Web Bot Auth / RFC 9421.

## License

MIT © Lineage Labs. Issue tracker: <https://github.com/LineageLabs/wayid-verify/issues>.
