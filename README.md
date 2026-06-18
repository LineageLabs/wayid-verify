# wayid-verify

Verify the **WayID** of an AI agent at your gateway, reverse proxy, or API backend.

WayID is provenance and trust infrastructure for AI agents — it binds a verified human or business
identity to their agents. This SDK lets a relying party answer _"what kind of agent is calling me?"_
in one call, with no user flow and without standing up its own crypto.

This repo hosts the language packages:

- **`js/`** — `@lineagelabs/wayid-verify` (TypeScript / NPM). Express + Cloudflare Worker adapters.
  See [`js/README.md`](js/README.md).
- **`python/`** — `wayid-verify` (PyPI). FastAPI / Starlette + Flask adapters.
  See [`python/README.md`](python/README.md).

The Nginx integration lives in its own repo: **`lineagelabs/wayid-nginx`**.

```bash
npm install @lineagelabs/wayid-verify     # Node / Bun / Cloudflare Workers
pip install wayid-verify                  # Python 3.9+
```

## How it works (v1 — passive)

An agent declares its identity with a request header:

```
WayID: wayid:agent:{24-char-base58}      # full DID or the bare 24-char tail
```

The gateway extracts the header, resolves it via the public `GET {issuer}/api/v1/agent/{did}`
endpoint, caches the result, and applies a policy. By default the SDK **fails open** — a verifier
outage or unknown DID never blocks traffic; the request is served and tagged `unknown`.

> **Identification, not authentication.** The v1 `WayID` header is _self-asserted_: it proves the
> named DID exists and is owner-verified, not that the caller holds the agent's private key. That is
> the right tool for attribution. Cryptographic proof-of-possession is a planned **v2** layer built
> on Web Bot Auth / RFC 9421 HTTP Message Signatures.

## Status

Prototype for WayID issue [#373](https://github.com/LineageLabs/way-id/issues/373). The canonical
wire contract lives in the way-id repo: `.specs/product-spec.md` §4.6 and `.specs/tech-spec.md` §5.5.

## Releasing

Both packages are publish-ready (tag-driven GitHub Actions) but not yet published — see
[`PUBLISHING.md`](PUBLISHING.md) for the npm / PyPI setup and release steps.

## License

MIT © Lineage Labs — see [`LICENSE`](LICENSE).
