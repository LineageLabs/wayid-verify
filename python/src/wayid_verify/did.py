"""WayID DID validation + normalization.

Format: ``wayid:agent:{24-char-base58}``. Mirrors way-id ``src/lib/did/generator.ts``.
"""

import re
from typing import Optional

_WAYID_RE = re.compile(r"^wayid:agent:[1-9A-HJ-NP-Za-km-z]{24}$")
_BARE_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{24}$")

_PREFIX = "wayid:agent:"


def is_valid_wayid(wayid: str) -> bool:
    return bool(_WAYID_RE.match(wayid))


def normalize_wayid(value: str) -> Optional[str]:
    """Return the full DID for a full DID or bare 24-char tail, else ``None``."""
    if value is None:
        return None
    v = value.strip()
    if _WAYID_RE.match(v):
        return v
    if _BARE_RE.match(v):
        return _PREFIX + v
    return None


def bare_id(did: str) -> str:
    """Return the bare 24-char tail of a (normalized) DID."""
    return did[len(_PREFIX):] if did.startswith(_PREFIX) else did
