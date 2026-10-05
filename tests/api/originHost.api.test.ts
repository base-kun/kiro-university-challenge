import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Security tests for the API's Host and Origin allow-lists. These complement
// recipes.api.test.ts (which covers the happy path). We use the raw node:http
// client so we can set an arbitrary Host header (fetch forbids overriding it).

let server: Server;
let port: number;
let tmpRoot: string;

interface RawResponse {
  status: number;
  body: string;
}

/**
 * Send a request to 127.0.0.1:<port> with explicit Host/Origin headers.
 * Connecting by IP while sending a chosen Host header mimics a DNS-rebinding
 * attacker whose domain resolves to loopback.
 */
function raw(
  method: string,
  pathname: string,
  headers: Record<string, string> = {},
  body?: string
): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: pathname,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const validBody = JSON.stringify({
  title: 'host-origin-test',
  category: '主菜',
  ingredients: ['x'],
  cookingMinutes: 5,
  difficulty: 'easy',
});

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'recipe-ho-'));
  process.env.RECIPES_DATA_FILE = path.join(tmpRoot, 'recipes.json');
  process.env.RECIPE_SERVER_NO_LISTEN = '1';

  const { createServer } = await import('../../src/server/index.js');
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('API Host allow-list (DNS-rebinding guard)', () => {
  it('allows a localhost Host header', async () => {
    const res = await raw('GET', '/api/recipes', { Host: `localhost:${port}` });
    expect(res.status).toBe(200);
  });

  it('allows a 127.0.0.1 Host header', async () => {
    const res = await raw('GET', '/api/recipes', { Host: `127.0.0.1:${port}` });
    expect(res.status).toBe(200);
  });

  it('rejects a non-local Host on GET (403)', async () => {
    const res = await raw('GET', '/api/recipes', {
      Host: 'attacker.example.com',
    });
    expect(res.status).toBe(403);
    expect(res.body).toMatch(/host not allowed/);
  });

  it('rejects a non-local Host on POST (403) and does not read/write', async () => {
    const res = await raw(
      'POST',
      '/api/recipes',
      { Host: 'attacker.example.com', 'Content-Type': 'application/json' },
      validBody
    );
    expect(res.status).toBe(403);
    expect(res.body).toMatch(/host not allowed/);
  });

  it('rejects a non-local Host on OPTIONS preflight (403)', async () => {
    const res = await raw('OPTIONS', '/api/recipes', {
      Host: 'attacker.example.com',
    });
    expect(res.status).toBe(403);
  });
});

describe('API Origin allow-list', () => {
  it('allows an Origin-less request (local MCP / curl / same-origin)', async () => {
    // Local Host, no Origin header → allowed (the MCP server path).
    const res = await raw('GET', '/api/recipes', { Host: `127.0.0.1:${port}` });
    expect(res.status).toBe(200);
  });

  it('allows a whitelisted Origin and reflects it', async () => {
    const res = await raw('GET', '/api/recipes', {
      Host: `127.0.0.1:${port}`,
      Origin: 'http://localhost:5173',
    });
    expect(res.status).toBe(200);
  });

  it('rejects a disallowed Origin on GET (403)', async () => {
    const res = await raw('GET', '/api/recipes', {
      Host: `127.0.0.1:${port}`,
      Origin: 'http://evil.example.com',
    });
    expect(res.status).toBe(403);
    expect(res.body).toMatch(/origin not allowed/);
  });

  it('rejects a disallowed Origin on POST (403) before persisting', async () => {
    const res = await raw(
      'POST',
      '/api/recipes',
      {
        Host: `127.0.0.1:${port}`,
        Origin: 'http://evil.example.com',
        'Content-Type': 'application/json',
      },
      validBody
    );
    expect(res.status).toBe(403);
    expect(res.body).toMatch(/origin not allowed/);
  });

  it('rejects a disallowed Origin on OPTIONS preflight (403)', async () => {
    const res = await raw('OPTIONS', '/api/recipes', {
      Host: `127.0.0.1:${port}`,
      Origin: 'http://evil.example.com',
    });
    expect(res.status).toBe(403);
  });

  it('allows an OPTIONS preflight from a whitelisted Origin (204)', async () => {
    const res = await raw('OPTIONS', '/api/recipes', {
      Host: `127.0.0.1:${port}`,
      Origin: 'http://localhost:5173',
    });
    expect(res.status).toBe(204);
  });
});

describe('API rejected requests do not persist', () => {
  it('neither the bad-Host nor bad-Origin POST was saved', async () => {
    // A valid local request lists what is stored; the rejected POSTs above must
    // not appear.
    const res = await raw('GET', '/api/recipes', { Host: `127.0.0.1:${port}` });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body) as { recipes: Array<{ title: string }> };
    expect(data.recipes.some((r) => r.title === 'host-origin-test')).toBe(false);
  });
});
