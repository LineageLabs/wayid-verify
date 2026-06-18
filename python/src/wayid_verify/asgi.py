"""ASGI middleware (Starlette / FastAPI). Attaches the verification result to
``request.state.wayid``, forwards ``X-WayID-*`` headers downstream, and
optionally blocks denied requests. Pure ASGI — no Starlette dependency."""

import asyncio
import json
from typing import Optional

from .client import WayIDClient
from .types import Policy
from .verify import DEFAULT_HEADER, upstream_headers, verify_headers


class WayIDMiddleware:
    def __init__(
        self,
        app,
        client: Optional[WayIDClient] = None,
        policy: Optional[Policy] = None,
        header_name: str = DEFAULT_HEADER,
        enforce: bool = False,
        forward_headers: bool = True,
        **client_kwargs,
    ) -> None:
        self.app = app
        self.client = client or WayIDClient(**client_kwargs)
        self.policy = policy
        self.header_name = header_name
        self.enforce = enforce
        self.forward_headers = forward_headers

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1"): v.decode("latin-1") for k, v in scope.get("headers", [])}
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, verify_headers, headers, self.client, self.policy, self.header_name
        )
        scope.setdefault("state", {})["wayid"] = result

        if self.enforce and result.decision == "deny":
            body = json.dumps(
                {"error": "wayid_denied", "did": result.resolution.did}
            ).encode("utf-8")
            await send(
                {
                    "type": "http.response.start",
                    "status": 403,
                    "headers": [(b"content-type", b"application/json")],
                }
            )
            await send({"type": "http.response.body", "body": body})
            return

        if self.forward_headers:
            extra = [
                (k.lower().encode("latin-1"), v.encode("latin-1"))
                for k, v in upstream_headers(result).items()
            ]
            scope = dict(scope)
            scope["headers"] = list(scope.get("headers", [])) + extra

        await self.app(scope, receive, send)
