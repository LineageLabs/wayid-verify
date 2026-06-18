from dataclasses import dataclass, field
from typing import List, Optional

Decision = str  # "allow" | "deny" | "flag"


@dataclass
class Resolution:
    ok: bool
    found: bool
    verified: bool
    did: Optional[str] = None
    status: Optional[str] = None
    identity_method: Optional[str] = None
    identity_level: Optional[str] = None  # "verified" | "unverified"
    claimed_at: Optional[str] = None
    verify_url: Optional[str] = None
    error: Optional[str] = None


@dataclass
class Policy:
    require_verified: bool = False
    allow_statuses: List[str] = field(default_factory=lambda: ["active"])
    fail_closed: bool = False


@dataclass
class VerifyResult:
    presented: Optional[str]
    resolution: Resolution
    decision: Decision
