import type { FastifyInstance } from "fastify";

// Requests coming from another website (security audit F-23, F-25).
//
// A browser always sends `Origin` on a cross-site request and on a WebSocket
// handshake. If it names another host than the one the request was sent to,
// the request comes from a page of another website: it is refused. Requests
// without `Origin` (tests, scripts, calls between services) are not
// concerned: they are not made by a browser on behalf of a user.

// Host name only: behind the gateway, `Host` has no port while `Origin` has
// one (https://localhost:8443)
function hostName(value: string): string {
  return value.replace(/:\d+$/, "").toLowerCase();
}

export function isSameOrigin(
  origin: string | undefined,
  host: string | undefined,
): boolean {
  if (!origin) return true;
  if (!host) return false;
  try {
    return new URL(origin).hostname.toLowerCase() === hostName(host);
  } catch {
    // "null" (sandboxed iframe, file://) or garbage
    return false;
  }
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Refuses every state-changing request sent from another website
export function setupOriginCheck(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    if (!UNSAFE_METHODS.has(request.method)) return;
    if (isSameOrigin(request.headers.origin, request.headers.host)) return;
    return reply.code(403).send({ error: "Cross-site request refused" });
  });
}

// Messages allowed on one WebSocket (security audit F-10): a token bucket.
// The socket starts with `burst` messages and gets `perSecond` more every
// second, up to `burst`. Short bursts (a fast player, a test script) pass, a
// flood is soon cut down to `perSecond`.
export function createMessageLimiter(
  perSecond = 50,
  burst = 200,
): () => boolean {
  let tokens = burst;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(burst, tokens + ((now - last) / 1000) * perSecond);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}
