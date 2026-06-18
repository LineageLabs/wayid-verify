"""WayID resolver with an in-memory TTL cache. Fails open: lookup errors return
``Resolution(ok=False)`` rather than raising, so a verifier outage never breaks
the calling gateway.

Dependency-free: the default transport uses the standard library (``urllib``).
Pass a custom ``transport`` callable to swap in ``httpx``/``requests`` or to test.
"""

import json
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, Optional, Tuple

from .did import bare_id, normalize_wayid
from .types import Resolution

# transport(url, timeout) -> (status_code, parsed_json_or_None)
# status_code 0 means "could not reach" (network/timeout).
Transport = Callable[[str, float], Tuple[int, Optional[Any]]]


def _urllib_transport(url: str, timeout: float) -> Tuple[int, Optional[Any]]:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return resp.status, body
    except urllib.error.HTTPError as exc:  # 4xx / 5xx
        return exc.code, None
    except Exception:  # URLError, timeout, JSON decode, etc.
        return 0, None


def _unknown(did: Optional[str], error: str, ok: bool = False) -> Resolution:
    return Resolution(ok=ok, found=False, verified=False, did=did, error=error)


class WayIDClient:
    def __init__(
        self,
        issuer: str = "https://way.je",
        timeout: float = 2.0,
        cache_ttl: float = 60.0,
        negative_cache_ttl: float = 10.0,
        transport: Optional[Transport] = None,
        now: Callable[[], float] = time.monotonic,
    ) -> None:
        self.issuer = issuer.rstrip("/")
        self.timeout = timeout
        self.cache_ttl = cache_ttl
        self.negative_cache_ttl = negative_cache_ttl
        self._transport = transport or _urllib_transport
        self._now = now
        self._cache: Dict[str, Tuple[Resolution, float]] = {}

    def _cache_get(self, key: str) -> Optional[Resolution]:
        hit = self._cache.get(key)
        if not hit:
            return None
        value, expires = hit
        if expires <= self._now():
            self._cache.pop(key, None)
            return None
        return value

    def _cache_set(self, key: str, value: Resolution, ttl: float) -> None:
        self._cache[key] = (value, self._now() + ttl)

    def resolve(self, value: str) -> Resolution:
        did = normalize_wayid(value or "")
        if not did:
            return _unknown(None, "invalid-did", ok=True)

        cached = self._cache_get(did)
        if cached:
            return cached

        status, body = self._transport(f"{self.issuer}/api/v1/agent/{bare_id(did)}", self.timeout)

        if status == 404:
            miss = _unknown(did, "not-found", ok=True)
            self._cache_set(did, miss, self.negative_cache_ttl)
            return miss
        if status == 429:
            return _unknown(did, "rate-limited")
        if status == 0:
            return _unknown(did, "network")
        if status != 200 or body is None:
            return _unknown(did, f"http-{status}")

        owner = body.get("owner") or {}
        cert = body.get("certificate") or {}
        level = owner.get("identityLevel")
        resolution = Resolution(
            ok=True,
            found=True,
            verified=body.get("verified") is True,
            did=did,
            status=cert.get("status"),
            identity_method=owner.get("identityMethod"),
            identity_level=level if level in ("verified", "unverified") else None,
            claimed_at=owner.get("claimedAt"),
            verify_url=cert.get("verifyUrl"),
        )
        self._cache_set(did, resolution, self.cache_ttl)
        return resolution

    def card(self, value: str) -> Optional[dict]:
        did = normalize_wayid(value or "")
        if not did:
            return None
        status, body = self._transport(
            f"{self.issuer}/api/v1/agent/{bare_id(did)}/card", self.timeout
        )
        return body if status == 200 else None

    def clear_cache(self) -> None:
        self._cache.clear()
