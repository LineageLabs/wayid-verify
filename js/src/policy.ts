import type { Decision, Policy, Resolution } from "./types.js";

const DEFAULT_STATUSES = ["active"];

/**
 * Maps a resolution + policy to a decision.
 *
 * - `allow` — registered, active, and meets the identity bar.
 * - `deny`  — present but fails the policy (wrong status / unverified when required),
 *             or absent/failed-lookup under a strict policy.
 * - `flag`  — present-but-unknown or fail-open outage; serve but tag for logging.
 *
 * Fails open by default: when the lookup could not complete (`ok === false`),
 * returns `flag` unless `policy.failClosed` is set.
 */
export function decide(resolution: Resolution, policy: Policy = {}): Decision {
  const allowStatuses = policy.allowStatuses ?? DEFAULT_STATUSES;

  if (!resolution.ok) return policy.failClosed ? "deny" : "flag";

  if (!resolution.found) return policy.requireVerified ? "deny" : "flag";

  if (resolution.status && !allowStatuses.includes(resolution.status))
    return "deny";

  if (policy.requireVerified && resolution.identityLevel !== "verified")
    return "deny";

  return "allow";
}
