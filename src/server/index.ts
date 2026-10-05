import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleRecipes } from './routes/recipes.js';

const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);
// Bind to loopback only so the local API is never exposed on the network
// (REQ-7.x security hardening). Overridable for tests only.
const HOST = process.env.HOST ?? '127.0.0.1';

// Origins allowed to reach the API. This is a locally-run app: only the Vite
// dev server and direct localhost access are legitimate browser origins.
//
// A request with NO Origin header (the local MCP server's fetch, curl, same-
// process tests, same-origin navigations) is allowed. Note this does NOT mean
// "the client is definitely not a browser" — some same-origin browser requests
// also omit Origin. Rather, an absent Origin cannot be a *cross-origin* browser
// fetch, which is the drive-by/CSRF vector the Origin allow-list guards against.
// Loopback-only binding plus the Host allow-list below are what actually keep
// non-local callers out; the Origin check only hardens the browser path.
const ALLOWED_ORIGINS = new Set(
  (
    process.env.ALLOWED_ORIGINS ??
    [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
    ].join(',')
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
);

// Host names allowed in the HTTP Host header. Only local destinations: this
// defeats DNS-rebinding, where a remote page resolves an attacker domain to
// 127.0.0.1 and sends requests carrying a non-local Host header. The port is
// ignored (any port on these hosts is fine); IPv6 loopback is included.
const ALLOWED_HOSTS = new Set(
  (
    process.env.ALLOWED_HOSTS ?? ['localhost', '127.0.0.1', '[::1]', '::1'].join(',')
  )
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Decide whether a request's Origin is permitted. Requests without an Origin
 * header are allowed (see note above); a present Origin must be in the
 * allow-list.
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (origin === undefined || origin === '') return true;
  return ALLOWED_ORIGINS.has(origin);
}

/**
 * Decide whether a request's Host header targets a permitted local hostname.
 * The hostname is compared case-insensitively with any port stripped. A missing
 * Host header is rejected (HTTP/1.1 requires one; its absence is anomalous).
 */
function isHostAllowed(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  // Strip the port. IPv6 literals are bracketed: "[::1]:3001" -> "[::1]".
  let host = hostHeader.trim().toLowerCase();
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end !== -1) host = host.slice(0, end + 1);
  } else {
    const colon = host.indexOf(':');
    if (colon !== -1) host = host.slice(0, colon);
  }
  return ALLOWED_HOSTS.has(host);
}

function applyCors(res: ServerResponse, origin: string | undefined): void {
  // Reflect only an allowed Origin; never echo an arbitrary one or use '*'.
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function createServer(): http.Server {
  return http.createServer(
    (req: IncomingMessage, res: ServerResponse): void => {
      const origin = req.headers.origin;
      applyCors(res, origin);

      // Reject a non-local Host before anything else (DNS-rebinding guard).
      // Applies to every method, including OPTIONS preflight.
      if (!isHostAllowed(req.headers.host)) {
        res.writeHead(403, {
          'Content-Type': 'application/json; charset=utf-8',
        });
        res.end(JSON.stringify({ error: 'host not allowed' }));
        return;
      }

      // Reject a disallowed browser Origin before any read or write.
      if (!isOriginAllowed(origin)) {
        res.writeHead(403, {
          'Content-Type': 'application/json; charset=utf-8',
        });
        res.end(JSON.stringify({ error: 'origin not allowed' }));
        return;
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      void (async (): Promise<void> => {
        try {
          const handled = await handleRecipes(req, res);
          if (!handled) {
            res.writeHead(404, {
              'Content-Type': 'application/json; charset=utf-8',
            });
            res.end(JSON.stringify({ error: 'not found' }));
          }
        } catch (err) {
          // Never leak internal details to the client.
          console.error('Unhandled server error:', err);
          if (!res.headersSent) {
            res.writeHead(500, {
              'Content-Type': 'application/json; charset=utf-8',
            });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          } else {
            res.end();
          }
        }
      })();
    }
  );
}

// Start the server unless imported for testing.
if (process.env.RECIPE_SERVER_NO_LISTEN !== '1') {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.error(`Recipe API server listening on http://${HOST}:${PORT}`);
  });
}
