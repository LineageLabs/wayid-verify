# Changelog

All notable changes to `@lineagelabs/wayid-verify` are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## 0.1.0

Initial release.

- `WayIDClient` — resolve a WayID DID (full or bare tail) against
  `GET {issuer}/api/v1/agent/{did}`, with an in-memory TTL cache. Fails open.
- `decide()` — allow / deny / flag policy from a resolution.
- `verifyHeaders()` / `upstreamHeaders()` — framework-agnostic gateway primitives.
- Express / Connect adapter (`/express`) and Cloudflare Worker / Fetch adapter (`/worker`).
- DID helpers (`normalizeWayId`, `isValidWayId`, `bareId`).
