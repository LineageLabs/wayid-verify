/**
 * WayID DID validation + normalization.
 *
 * Format: `wayid:agent:{24-char-base58}`. Copied (intentionally, to keep this
 * package dependency-free and standalone) from way-id `src/lib/did/generator.ts`.
 */

const WAYID_REGEX = /^wayid:agent:[1-9A-HJ-NP-Za-km-z]{24}$/;
const BARE_ID_REGEX = /^[1-9A-HJ-NP-Za-km-z]{24}$/;

export function isValidWayId(wayid: string): boolean {
  return WAYID_REGEX.test(wayid);
}

/**
 * Normalizes input into a full WayID DID. Accepts the canonical
 * `wayid:agent:<24 base58>` form or the bare 24-char base58 tail (issue #330).
 * Returns `null` if the input is neither shape.
 */
export function normalizeWayId(input: string): string | null {
  const trimmed = input.trim();
  if (WAYID_REGEX.test(trimmed)) return trimmed;
  if (BARE_ID_REGEX.test(trimmed)) return `wayid:agent:${trimmed}`;
  return null;
}

/** Returns the bare 24-char tail of a (normalized) DID. */
export function bareId(did: string): string {
  return did.startsWith("wayid:agent:")
    ? did.slice("wayid:agent:".length)
    : did;
}
