# Changelog

All notable changes to `wayid-verify` (Python) are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## 0.1.0

Initial release.

- `WayIDClient` — resolve a WayID DID (full or bare tail) against
  `GET {issuer}/api/v1/agent/{did}`, with an in-memory TTL cache. Fails open.
  Dependency-free (stdlib `urllib`); pass a custom `transport` to use httpx/requests.
- `decide()` — allow / deny / flag policy from a resolution.
- `verify_headers()` / `upstream_headers()` — framework-agnostic gateway primitives.
- ASGI middleware (`wayid_verify.asgi.WayIDMiddleware`) for FastAPI / Starlette.
- Flask hook (`wayid_verify.flask_ext.wayid_before_request`).
- DID helpers (`normalize_wayid`, `is_valid_wayid`, `bare_id`).
