import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Recipe } from '../../src/core/recipe.js';
import {
  addRecipe,
  loadRecipes,
} from '../../src/server/storage/recipeStore.js';

// These tests exercise the real persistence layer (serialized write queue,
// failure isolation, and corrupt-data handling) directly, with an isolated
// data file per test. They complement the stdio tool tests.

let tmpRoot: string;
let dataFile: string;

function makeRecipe(title: string): Recipe {
  return {
    id: `id-${title}`,
    title,
    category: '主菜',
    ingredients: ['x'],
    cookingMinutes: 10,
    difficulty: 'easy',
    cuisineTags: [],
    flavorTags: [],
    drinkPairings: [],
    textureTags: [],
    notes: '',
    createdAt: new Date().toISOString(),
  };
}

// The store's write queue is module-level and only serializes operations (it
// holds no data), so a shared import is fine as long as each test uses its own
// isolated data file (set in beforeEach).

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'recipe-queue-'));
  dataFile = path.join(tmpRoot, 'recipes.json');
  process.env.RECIPES_DATA_FILE = dataFile;
});

afterEach(async () => {
  delete process.env.RECIPES_DATA_FILE;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('persistence: concurrency and queue recovery', () => {
  it('persists all recipes from concurrent addRecipe calls', async () => {
    const N = 10;
    await Promise.all(
      Array.from({ length: N }, (_, i) => addRecipe(makeRecipe(`c${i}`)))
    );
    const loaded = await loadRecipes();
    expect(loaded.length).toBe(N);
    for (let i = 0; i < N; i++) {
      expect(loaded.some((r) => r.title === `c${i}`)).toBe(true);
    }
  });

  it('recovers: a failed write does not break the queue for later writes', async () => {

    // First, a normal successful write.
    await addRecipe(makeRecipe('ok-1'));

    // Force the next write to fail by making the data file path unwritable:
    // replace the data file with a directory so writeFile(tmp)/rename fails.
    // We target the tmp sibling path the store uses (`${dataFile}.tmp`).
    const tmpSibling = `${dataFile}.tmp`;
    await fs.mkdir(tmpSibling); // writing to this path will now EISDIR

    const failing = addRecipe(makeRecipe('will-fail'));
    await expect(failing).rejects.toBeTruthy();

    // Clean up the obstruction, then a subsequent write must still succeed,
    // proving the serial queue recovered (REQ-3.1.9).
    await fs.rmdir(tmpSibling);
    await addRecipe(makeRecipe('ok-2'));

    const loaded = await loadRecipes();
    const titles = loaded.map((r) => r.title);
    expect(titles).toContain('ok-1');
    expect(titles).toContain('ok-2');
    expect(titles).not.toContain('will-fail');
  });
});

describe('persistence: corrupt data is a clear error, not silent empty', () => {
  it('throws RecipeDataError on non-array JSON and does not overwrite the file', async () => {
    const original = '{"not":"an array"}';
    await fs.writeFile(dataFile, original, 'utf8');

    await expect(loadRecipes()).rejects.toMatchObject({
      name: 'RecipeDataError',
    });
    // addRecipe loads first, so it must refuse and NOT overwrite the file.
    await expect(addRecipe(makeRecipe('new'))).rejects.toMatchObject({
      name: 'RecipeDataError',
    });
    const after = await fs.readFile(dataFile, 'utf8');
    expect(after).toBe(original);
  });

  it('throws RecipeDataError on malformed JSON and leaves the file unchanged', async () => {
    const original = '{ this is not json';
    await fs.writeFile(dataFile, original, 'utf8');

    await expect(loadRecipes()).rejects.toMatchObject({
      name: 'RecipeDataError',
    });
    const after = await fs.readFile(dataFile, 'utf8');
    expect(after).toBe(original);
  });

  it('throws RecipeDataError on an invalid record and leaves the file unchanged', async () => {
    // Valid array shape, but a record is missing required fields.
    const original = JSON.stringify([{ title: 'incomplete' }], null, 2);
    await fs.writeFile(dataFile, original, 'utf8');

    await expect(loadRecipes()).rejects.toMatchObject({
      name: 'RecipeDataError',
    });
    const after = await fs.readFile(dataFile, 'utf8');
    expect(after).toBe(original);
  });

  it('still loads a valid record that carries a legacy image field (stripped)', async () => {
    const legacy = [
      {
        ...makeRecipe('legacy'),
        imageFilename: 'old.jpg',
      },
    ];
    await fs.writeFile(dataFile, JSON.stringify(legacy, null, 2), 'utf8');

    const loaded = await loadRecipes();
    expect(loaded.length).toBe(1);
    expect(loaded[0].title).toBe('legacy');
    expect('imageFilename' in loaded[0]).toBe(false);
  });
});
