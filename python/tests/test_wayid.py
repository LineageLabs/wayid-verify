from wayid_verify import (
    Policy,
    WayIDClient,
    bare_id,
    decide,
    extract_wayid,
    is_valid_wayid,
    normalize_wayid,
    upstream_headers,
    verify_headers,
)
from wayid_verify.types import Resolution

FULL = "wayid:agent:3yQ8mNpRsTuVwXyZabcdefgh"
TAIL = "3yQ8mNpRsTuVwXyZabcdefgh"

FOUND_BODY = {
    "verified": True,
    "owner": {
        "identityMethod": "concordium",
        "identityLevel": "verified",
        "claimedAt": "2026-04-01T12:00:00Z",
    },
    "certificate": {"id": FULL, "status": "active", "verifyUrl": "/agent/sebastian-bot"},
}


def make_client(handler, now=None):
    """handler(url) -> (status, body); records calls."""
    calls = []

    def transport(url, timeout):
        calls.append(url)
        return handler(url)

    kwargs = {"issuer": "https://way.test", "transport": transport}
    if now is not None:
        kwargs["now"] = now
    return WayIDClient(**kwargs), calls


# --- did ---
def test_normalize():
    assert normalize_wayid(FULL) == FULL
    assert normalize_wayid(TAIL) == FULL
    assert normalize_wayid(f"  {TAIL}  ") == FULL
    assert normalize_wayid("nope") is None
    assert normalize_wayid("wayid:agent:short") is None
    assert is_valid_wayid(FULL) and not is_valid_wayid(TAIL)
    assert bare_id(FULL) == TAIL and bare_id(TAIL) == TAIL


# --- resolve: three states ---
def test_found_verified():
    client, calls = make_client(lambda u: (200, FOUND_BODY))
    r = client.resolve(FULL)
    assert r.ok and r.found and r.verified
    assert r.status == "active" and r.identity_level == "verified"
    assert calls[0] == f"https://way.test/api/v1/agent/{TAIL}"


def test_found_unverified():
    body = dict(FOUND_BODY, owner={"identityMethod": None, "identityLevel": "unverified", "claimedAt": None})
    client, _ = make_client(lambda u: (200, body))
    r = client.resolve(FULL)
    assert r.found and r.identity_level == "unverified" and r.identity_method is None


def test_not_found():
    client, _ = make_client(lambda u: (404, None))
    r = client.resolve(FULL)
    assert r.ok and not r.found and r.error == "not-found"


def test_bare_tail_equivalent():
    client, _ = make_client(lambda u: (200, FOUND_BODY))
    a = client.resolve(FULL)
    client.clear_cache()
    b = client.resolve(TAIL)
    assert a == b


def test_invalid_did_no_fetch():
    client, calls = make_client(lambda u: (200, FOUND_BODY))
    r = client.resolve("garbage")
    assert r.ok and not r.found and r.error == "invalid-did"
    assert calls == []


# --- resolve: fail open ---
def test_5xx_fail_open():
    client, _ = make_client(lambda u: (503, None))
    r = client.resolve(FULL)
    assert not r.ok and r.error == "http-503"


def test_429():
    client, _ = make_client(lambda u: (429, None))
    r = client.resolve(FULL)
    assert not r.ok and r.error == "rate-limited"


def test_network():
    client, _ = make_client(lambda u: (0, None))
    r = client.resolve(FULL)
    assert not r.ok and r.error == "network"


# --- cache ---
def test_positive_cached():
    client, calls = make_client(lambda u: (200, FOUND_BODY))
    client.resolve(FULL)
    client.resolve(TAIL)
    assert len(calls) == 1


def test_errors_not_cached():
    client, calls = make_client(lambda u: (503, None))
    client.resolve(FULL)
    client.resolve(FULL)
    assert len(calls) == 2


def test_cache_expiry():
    t = {"v": 1000.0}
    client, calls = make_client(lambda u: (200, FOUND_BODY), now=lambda: t["v"])
    client.resolve(FULL)
    t["v"] = 1000.0 + 61.0  # past default 60s ttl
    client.resolve(FULL)
    assert len(calls) == 2


# --- policy ---
def _base():
    return Resolution(
        ok=True, found=True, verified=True, did=FULL, status="active",
        identity_method="concordium", identity_level="verified",
    )


def test_policy():
    assert decide(_base()) == "allow"
    susp = _base()
    susp.status = "suspended"
    assert decide(susp) == "deny"
    unv = _base()
    unv.identity_level = "unverified"
    assert decide(unv) == "allow"
    assert decide(unv, Policy(require_verified=True)) == "deny"
    nf = _base()
    nf.found = False
    assert decide(nf) == "flag"
    assert decide(nf, Policy(require_verified=True)) == "deny"
    outage = _base()
    outage.ok = False
    assert decide(outage) == "flag"
    assert decide(outage, Policy(fail_closed=True)) == "deny"


# --- header + verify_headers ---
def test_extract_header():
    assert extract_wayid({"wayid": FULL}) == FULL
    assert extract_wayid({"WayID": FULL}) == FULL
    assert extract_wayid({}) is None


def test_verify_no_header():
    client, calls = make_client(lambda u: (200, FOUND_BODY))
    result = verify_headers({}, client)
    assert result.presented is None and result.decision == "flag" and calls == []


def test_verify_present_allow():
    client, _ = make_client(lambda u: (200, FOUND_BODY))
    result = verify_headers({"WayID": TAIL}, client)
    assert result.decision == "allow"
    h = upstream_headers(result)
    assert h["X-WayID-Verified"] == "true"
    assert h["X-WayID-DID"] == FULL
    assert h["X-WayID-Identity-Level"] == "verified"
