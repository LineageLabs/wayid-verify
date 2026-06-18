"""Flask integration. Register on an app to attach the verification result to
``flask.g.wayid`` for every request::

    from wayid_verify.flask_ext import wayid_before_request
    app.before_request(wayid_before_request(issuer="https://way.je"))
"""

from typing import Optional

from .client import WayIDClient
from .types import Policy
from .verify import DEFAULT_HEADER, verify_headers


def wayid_before_request(
    client: Optional[WayIDClient] = None,
    policy: Optional[Policy] = None,
    header_name: str = DEFAULT_HEADER,
    enforce: bool = False,
    **client_kwargs,
):
    """Build a Flask ``before_request`` callback. When ``enforce`` is set and the
    decision is ``deny``, returns a 403 response (short-circuiting the view)."""
    resolver = client or WayIDClient(**client_kwargs)

    def before_request():
        from flask import g  # imported lazily so Flask stays optional
        from flask import request

        result = verify_headers(request.headers, resolver, policy, header_name)
        g.wayid = result
        if enforce and result.decision == "deny":
            return {"error": "wayid_denied", "did": result.resolution.did}, 403
        return None

    return before_request
