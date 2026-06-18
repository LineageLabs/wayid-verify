import { WayIDClient } from "./client.js";
import {
  upstreamHeaders,
  verifyHeaders,
  type VerifyOptions,
  type VerifyResult,
} from "./verify.js";

// Minimal structural types so this adapter needs no `express` dependency.
interface Req {
  headers: Record<string, string | string[] | undefined>;
  wayid?: VerifyResult;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): unknown;
  setHeader(name: string, value: string): void;
}
type Next = (err?: unknown) => void;

export interface ExpressMiddlewareOptions extends VerifyOptions {
  /** Reject requests whose decision is `deny` with a 403. Default false (tag only). */
  enforce?: boolean;
  /** Also forward `X-WayID-*` identity headers to the upstream. Default true. */
  forwardHeaders?: boolean;
}

/**
 * Express / Connect middleware. Attaches the verification result to `req.wayid`,
 * forwards `X-WayID-*` headers to the upstream, and (optionally) blocks denied
 * requests. Fails open: never throws into the request pipeline.
 */
export function wayIdMiddleware(options: ExpressMiddlewareOptions = {}) {
  const client = options.client ?? new WayIDClient(options);
  const forward = options.forwardHeaders !== false;

  return function wayIdHandler(req: Req, res: Res, next: Next): void {
    verifyHeaders(req.headers, { ...options, client })
      .then((result) => {
        req.wayid = result;
        if (forward) {
          const fwd = upstreamHeaders(result);
          for (const [k, v] of Object.entries(fwd)) {
            req.headers[k.toLowerCase()] = v;
            res.setHeader(k, v);
          }
        }
        if (options.enforce && result.decision === "deny") {
          res
            .status(403)
            .json({
              error: "wayid_denied",
              did: result.resolution.did ?? null,
            });
          return;
        }
        next();
      })
      .catch(next);
  };
}
