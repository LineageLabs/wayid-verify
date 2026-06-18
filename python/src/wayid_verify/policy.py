from .types import Decision, Policy, Resolution


def decide(resolution: Resolution, policy: Policy = None) -> Decision:
    """Map a resolution + policy to ``allow`` / ``deny`` / ``flag``.

    Fails open: when the lookup could not complete (``ok is False``), returns
    ``flag`` unless ``policy.fail_closed`` is set.
    """
    policy = policy or Policy()

    if not resolution.ok:
        return "deny" if policy.fail_closed else "flag"

    if not resolution.found:
        return "deny" if policy.require_verified else "flag"

    if resolution.status and resolution.status not in policy.allow_statuses:
        return "deny"

    if policy.require_verified and resolution.identity_level != "verified":
        return "deny"

    return "allow"
