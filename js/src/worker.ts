import { WayIDClient } from "./client.js";
import {
  upstreamHeaders,
  verifyHeaders,
  type VerifyOptions,
  type VerifyResult,
} from "./verify.js";

/** Verify a Fetch API `Request` (Cloudflare Workers, Hono, Deno, Bun). */
export async function verifyRequest(
  request: Request,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  return verifyHeaders(request.headers, options);
}

export interface WorkerGuardOptions extends VerifyOptions {
  /** Return a 403 when the decision is `deny`. Default false (tag only). */
  enforce?: boolean;
}

/**
 * Wraps a Fetch-style handler. Resolves the agent, and either short-circuits a
 * denied request (when `enforce`) or forwards the original request to `handler`
 * with `X-WayID-*` identity headers added. The result is also passed as the
 * second argument so the handler can read it directly.
 */
export function withWayId(
  handler: (
    request: Request,
    result: VerifyResult,
  ) => Response | Promise<Response>,
  options: WorkerGuardOptions = {},
): (request: Request) => Promise<Response> {
  const client = options.client ?? new WayIDClient(options);
  return async (request: Request): Promise<Response> => {
    const result = await verifyHeaders(request.headers, { ...options, client });
    if (options.enforce && result.decision === "deny") {
      return new Response(
        JSON.stringify({
          error: "wayid_denied",
          did: result.resolution.did ?? null,
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      );
    }
    const headers = new Headers(request.headers);
    for (const [k, v] of Object.entries(upstreamHeaders(result)))
      headers.set(k, v);
    const forwarded = new Request(request, { headers });
    return handler(forwarded, result);
  };
}
