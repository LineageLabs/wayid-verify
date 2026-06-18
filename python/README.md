# wayid-verify (Python)

Dependency-free WayID verification for Python gateways. The core uses the standard
library; pass a custom `transport` to use `httpx`/`requests`.

```python
from wayid_verify import WayIDClient, verify_headers, Policy

client = WayIDClient(issuer="https://way.je")
result = verify_headers(request.headers, client, Policy(require_verified=False))
# result.resolution.identity_level, result.decision -> "allow" | "deny" | "flag"
```

### FastAPI / Starlette

```python
from wayid_verify.asgi import WayIDMiddleware
app.add_middleware(WayIDMiddleware, issuer="https://way.je")
# read in a route via: request.state.wayid
```

### Flask

```python
from wayid_verify.flask_ext import wayid_before_request
app.before_request(wayid_before_request(issuer="https://way.je"))
# read in a view via: flask.g.wayid
```

By default the SDK **fails open** — a verifier outage or unknown DID never blocks
traffic. Set `enforce=True` (middleware) or `Policy(fail_closed=True)` to change that.

Run the tests: `python -m pytest`.
