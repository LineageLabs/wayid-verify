from typing import Dict, Mapping, Optional

from .client import WayIDClient
from .policy import decide
from .types import Policy, Resolution, VerifyResult

DEFAULT_HEADER = "WayID"


def extract_wayid(headers: Mapping[str, str], header_name: str = DEFAULT_HEADER) -> Optional[str]:
    """Case-insensitive header lookup over a plain mapping."""
    target = header_name.lower()
    for key, value in headers.items():
        if key.lower() == target:
            return value
    return None


def _absent() -> Resolution:
    return Resolution(ok=True, found=False, verified=False, error="no-header")


def verify_headers(
    headers: Mapping[str, str],
    client: WayIDClient,
    policy: Optional[Policy] = None,
    header_name: str = DEFAULT_HEADER,
) -> VerifyResult:
    presented = extract_wayid(headers, header_name)
    resolution = client.resolve(presented) if presented else _absent()
    return VerifyResult(presented=presented, resolution=resolution, decision=decide(resolution, policy))


def upstream_headers(result: VerifyResult) -> Dict[str, str]:
    r = result.resolution
    out = {
        "X-WayID-Decision": result.decision,
        "X-WayID-Verified": str(r.found and r.verified).lower(),
    }
    if r.did:
        out["X-WayID-DID"] = r.did
    if r.identity_level:
        out["X-WayID-Identity-Level"] = r.identity_level
    if r.status:
        out["X-WayID-Status"] = r.status
    return out
