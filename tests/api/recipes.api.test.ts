import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

let server: Server;
let baseUrl: string;
let tmpRoot: string;

type Json = Record<string, unknown>;

async function postRecipe(
  body: unknown,
  contentType: string | null = 'application/json'
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (contentType !== null) headers['Content-Type'] = contentType;
  return fetch(`${baseUrl}/api/recipes`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function validRecipe(overrides: Json = {}): Json {
  return {
    title: 'シラーズ煮込み',
    category: '主菜',
    ingredients: ['牛肉', '玉ねぎ'],
    cookingMinutes: 25,
    difficulty: 'medium',
    drinkPairings: ['シラーズ', '赤ワイン'],
    ...overrides,
  };
}

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'recipe-api-'));
  process.env.RECIPES_DATA_FILE = path.join(tmpRoot, 'recipes.json');
  process.env.RECIPE_SERVER_NO_LISTEN = '1';

  const { createServer } = await import('../../src/server/index.js');
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('recipes API (text-only JSON)', () => {
  it('creates a recipe and returns 201 with the recipe body (charset allowed)', async () => {
    // A charset parameter on application/json must be accepted.
    const res = await postRecipe(
      validRecipe(),
      'application/json; charset=utf-8'
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { recipe: Json };
    expect(body.recipe.title).toBe('シラーズ煮込み');
    expect(body.recipe.id).toBeTruthy();
    expect(body.recipe.createdAt).toBeTruthy();
    expect(body.recipe.drinkPairings).toEqual(['シラーズ', '赤ワイン']);
    // The text-only model has no image field.
    expect('imageFilename' in body.recipe).toBe(false);
  });

  it('returns 415 for a non-JSON Content-Type', async () => {
    const res = await postRecipe(
      JSON.stringify(validRecipe()),
      'text/plain'
    );
    expect(res.status).toBe(415);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/application\/json/);
  });

  it('returns 415 when Content-Type is missing', async () => {
    const res = await postRecipe(JSON.stringify(validRecipe()), null);
    expect(res.status).toBe(415);
  });

  it('returns 400 when title is missing', async () => {
    const { title: _omit, ...noTitle } = validRecipe();
    const res = await postRecipe(noTitle);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/title/);
  });

  it('returns 400 for an invalid category', async () => {
    const res = await postRecipe(validRecipe({ category: 'INVALID' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid difficulty', async () => {
    const res = await postRecipe(validRecipe({ difficulty: 'wizard' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a non-positive cookingMinutes', async () => {
    const res = await postRecipe(validRecipe({ cookingMinutes: 0 }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/cookingMinutes/);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await postRecipe('{ not valid json');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/JSON/i);
  });

  it('returns 400 for an unknown field (strict input)', async () => {
    const res = await postRecipe(validRecipe({ imageFilename: 'x.jpg' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unexpected field/);
  });

  it('returns 413 for an oversized body', async () => {
    const huge = validRecipe({ notes: 'あ'.repeat(70_000) });
    const res = await postRecipe(huge);
    expect(res.status).toBe(413);
  });

  it('GET /api/recipes returns the saved recipes', async () => {
    const res = await fetch(`${baseUrl}/api/recipes`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recipes: Array<{ title: string }> };
    expect(Array.isArray(body.recipes)).toBe(true);
    expect(body.recipes.some((r) => r.title === 'シラーズ煮込み')).toBe(true);
  });
});
