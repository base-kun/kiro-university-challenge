import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { McpStdioClient } from './mcpClient.js';

// Real API server (in-process) + real MCP server (child process over stdio).
let apiServer: Server;
let apiBaseUrl: string;
let dataFile: string;
let tmpRoot: string;
let client: McpStdioClient;

function validRecipe(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'MCP鶏の照り焼き',
    category: '主菜',
    ingredients: ['鶏もも肉', '醤油', 'みりん'],
    cookingMinutes: 20,
    difficulty: 'easy',
    drinkPairings: [],
    notes: 'integration',
    ...overrides,
  };
}

async function readData(): Promise<Array<{ title: string }>> {
  const raw = await fs.readFile(dataFile, 'utf8');
  return JSON.parse(raw) as Array<{ title: string }>;
}

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'recipe-int-'));
  dataFile = path.join(tmpRoot, 'recipes.json');

  // Start the real API server in-process on a random port, isolated data file.
  process.env.RECIPES_DATA_FILE = dataFile;
  process.env.RECIPE_SERVER_NO_LISTEN = '1';
  const { createServer } = await import('../../src/server/index.js');
  apiServer = createServer();
  await new Promise<void>((resolve) => apiServer.listen(0, resolve));
  const addr = apiServer.address() as AddressInfo;
  apiBaseUrl = `http://127.0.0.1:${addr.port}`;

  // Start the real MCP server as a child, pointed at the API + same data file.
  client = new McpStdioClient({
    RECIPE_API_BASE_URL: apiBaseUrl,
    RECIPES_DATA_FILE: dataFile,
  });
  await client.initialize();
}, 30_000);

afterAll(async () => {
  await client.close();
  await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('MCP integration: real create_recipe/search_recipes over stdio', () => {
  it('exposes both tools', async () => {
    const names = await client.listToolNames();
    expect(names).toContain('create_recipe');
    expect(names).toContain('search_recipes');
  });

  it('registers a recipe, lists it, and finds it via search', async () => {
    const create = await client.callTool('create_recipe', validRecipe());
    expect(create.isError).toBe(false);
    const created = JSON.parse(create.text) as { recipe: { id: string; title: string } };
    expect(created.recipe.id).toBeTruthy();
    expect(created.recipe.title).toBe('MCP鶏の照り焼き');

    // Appears in the Web list endpoint.
    const listRes = await fetch(`${apiBaseUrl}/api/recipes`);
    const list = (await listRes.json()) as { recipes: Array<{ title: string }> };
    expect(list.recipes.some((r) => r.title === 'MCP鶏の照り焼き')).toBe(true);

    // Found via the real search_recipes tool.
    const search = await client.callTool('search_recipes', {
      categories: ['主菜'],
      maxCookingMinutes: 30,
    });
    expect(search.isError).toBe(false);
    const results = JSON.parse(search.text) as Array<{ recipe: { title: string } }>;
    expect(results.some((r) => r.recipe.title === 'MCP鶏の照り焼き')).toBe(true);
  });

  it('rejects an unknown field (strict input) and does not persist it', async () => {
    const before = (await readData()).length;
    const res = await client.callTool(
      'create_recipe',
      validRecipe({ title: 'bad-unknown', imageFilename: 'x.jpg' })
    );
    expect(res.isError).toBe(true);
    const after = await readData();
    expect(after.length).toBe(before);
    expect(after.some((r) => r.title === 'bad-unknown')).toBe(false);
  });

  it('rejects invalid input (non-positive cookingMinutes)', async () => {
    const res = await client.callTool(
      'create_recipe',
      validRecipe({ title: 'bad-minutes', cookingMinutes: 0 })
    );
    expect(res.isError).toBe(true);
  });

  it('persists all recipes under concurrent registration (no lost updates)', async () => {
    const before = (await readData()).length;
    const N = 8;
    const calls = Array.from({ length: N }, (_, i) =>
      client.callTool('create_recipe', validRecipe({ title: `concurrent-${i}` }))
    );
    const results = await Promise.all(calls);
    expect(results.every((r) => r.isError === false)).toBe(true);

    const after = await readData();
    expect(after.length).toBe(before + N);
    for (let i = 0; i < N; i++) {
      expect(after.some((r) => r.title === `concurrent-${i}`)).toBe(true);
    }
  }, 30_000);
});

describe('MCP integration: API-unavailable and timeout error paths', () => {
  it('returns a clear error when the API server is not running', async () => {
    // Point a fresh MCP client at a port with nothing listening.
    const deadClient = new McpStdioClient({
      RECIPE_API_BASE_URL: 'http://127.0.0.1:1',
      RECIPES_DATA_FILE: dataFile,
    });
    try {
      await deadClient.initialize();
      const res = await deadClient.callTool('create_recipe', validRecipe());
      expect(res.isError).toBe(true);
      expect(res.text).toMatch(/API unavailable|did not respond|register/i);
    } finally {
      await deadClient.close();
    }
  }, 20_000);

  it('times out (~5s) against a non-responsive API and reports it clearly', async () => {
    // A TCP server that accepts connections but never responds, forcing the
    // create_recipe fetch to hit its 5s AbortController timeout.
    const stuck = net.createServer((socket) => {
      socket.on('data', () => {
        /* swallow the request; never reply */
      });
      socket.on('error', () => undefined);
    });
    await new Promise<void>((resolve) => stuck.listen(0, '127.0.0.1', resolve));
    const stuckPort = (stuck.address() as AddressInfo).port;

    const slowClient = new McpStdioClient({
      RECIPE_API_BASE_URL: `http://127.0.0.1:${stuckPort}`,
      RECIPES_DATA_FILE: dataFile,
    });
    try {
      await slowClient.initialize();
      const started = Date.now();
      const res = await slowClient.callTool('create_recipe', validRecipe());
      const elapsed = Date.now() - started;
      expect(res.isError).toBe(true);
      expect(res.text).toMatch(/timeout|did not respond|register/i);
      // The 5s AbortController should fire well under the client's 15s cap.
      expect(elapsed).toBeGreaterThanOrEqual(4_000);
      expect(elapsed).toBeLessThan(12_000);
    } finally {
      await slowClient.close();
      await new Promise<void>((resolve) => stuck.close(() => resolve()));
    }
  }, 20_000);
});

// Verify that the valid recipes persisted above survive and the data file is a
// clean array (no corruption from concurrent writes).
describe('MCP integration: data integrity', () => {
  it('data file is a valid non-empty array with no image fields', async () => {
    const data = await readData();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => !('imageFilename' in r))).toBe(true);
  });
});
