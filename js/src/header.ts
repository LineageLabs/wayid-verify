/** Canonical v1 header an agent uses to declare its WayID. */
export const DEFAULT_HEADER = "WayID";

type HeaderBag = Headers | Record<string, string | string[] | undefined>;

/**
 * Extracts the WayID header value from either a fetch `Headers` object or a
 * Node-style headers bag (lowercased keys, possibly array-valued). Returns the
 * raw string (un-normalized) or null.
 */
export function extractWayId(
  headers: HeaderBag,
  headerName: string = DEFAULT_HEADER,
): string | null {
  const lower = headerName.toLowerCase();
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(headerName);
  }
  const bag = headers as Record<string, string | string[] | undefined>;
  const raw = bag[lower] ?? bag[headerName];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}
