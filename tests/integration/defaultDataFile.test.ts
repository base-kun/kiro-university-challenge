import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Recipe } from '../../src/core/recipe.js';
import {
  addRecipe,
  loadRecipes,
  resolveDataFile,
  DEFAULT_DATA_FILE,
} from '../../src/server/storage/recipeStore.js';

// Regression guard for the pre-commit security review: the recipe store's
// resolver must default to the git-ignored runtime file
// `data/recipes.local.json` and must NEVER resolve to — or write to — the
// tracked, public sample `data/recipes.json`.
//
// These assertions call the REAL resolver (`resolveDataFile`) and the REAL
// default constant (`DEFAULT_DATA_FILE`); they are not self-contained string
// checks. If the implementation default is reverted to `recipes.json`, the
// first two tests fail.
//
// Non-destructive: nothing here writes to the developer's real
// `data/recipes.local.json` or to the public `data/recipes.json`. The actual
// write exercise is redirected to a throwaway temp file, and the public sample
// is snapshotted and asserted byte-for-byte unchanged.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const LOCAL_RUNTIME_FILE = path.join(DATA_DIR, 'recipes.local.json');
const PUBLIC_SAMPLE = path.join(DATA_DIR, 'recipes.json');

let sampleBytesBefore: Buffer | null;
let localBytesBefore: Buffer | null;
let tmpRoot: string;

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

async function readIfExists(file: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(file);
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

beforeAll(async () => {
  // Snapshot the real data files so we can prove neither is modified.
  sampleBytesBefore = await readIfExists(PUBLIC_SAMPLE);
  localBytesBefore = await readIfExists(LOCAL_RUNTIME_FILE);
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'recipe-default-'));
});

afterAll(async () => {
  delete process.env.RECIPES_DATA_FILE;
  await fs.rm(tmpRoot, { recursive: true, force: true });

  // Final safety net: both real data files must be byte-for-byte unchanged.
  const sampleAfter = await readIfExists(PUBLIC_SAMPLE);
  const localAfter = await readIfExists(LOCAL_RUNTIME_FILE);
  expect(bufEq(sampleAfter, sampleBytesBefore)).toBe(true);
  expect(bufEq(localAfter, localBytesBefore)).toBe(true);
});

function bufEq(a: Buffer | null, b: Buffer | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.equals(b);
}

describe('recipeStore default resolution (security regression)', () => {
  beforeEach(() => {
    // Ensure no override leaks in from other suites in the same worker.
    delete process.env.RECIPES_DATA_FILE;
  });

  it('resolveDataFile() with no override returns the local runtime file, not the public sample', () => {
    const resolved = resolveDataFile();

    // The real resolver must return exactly the git-ignored runtime file.
    expect(resolved).toBe(LOCAL_RUNTIME_FILE);
    // And must NOT be the tracked public sample. (Reverting the implementation
    // default to recipes.json makes both assertions fail.)
    expect(resolved).not.toBe(PUBLIC_SAMPLE);
    expect(path.basename(resolved)).toBe('recipes.local.json');
  });

  it('DEFAULT_DATA_FILE points at data/recipes.local.json', () => {
    expect(DEFAULT_DATA_FILE).toBe(LOCAL_RUNTIME_FILE);
    expect(path.basename(DEFAULT_DATA_FILE)).toBe('recipes.local.json');
    expect(DEFAULT_DATA_FILE).not.toBe(PUBLIC_SAMPLE);
  });

  it('RECIPES_DATA_FILE override is honored by the resolver', () => {
    const override = path.join(tmpRoot, 'override.json');
    process.env.RECIPES_DATA_FILE = override;
    expect(resolveDataFile()).toBe(override);
    delete process.env.RECIPES_DATA_FILE;
  });

  it('a real write via the store lands in the resolved file and never touches the public sample', async () => {
    // Redirect writes to a throwaway file so the developer's real local store
    // is also left alone, then exercise a genuine load+append+save.
    const target = path.join(tmpRoot, 'recipes.local.json');
    process.env.RECIPES_DATA_FILE = target;
    expect(resolveDataFile()).toBe(target);

    await addRecipe(makeRecipe('regression-check'));
    const loaded = await loadRecipes();
    expect(loaded.some((r) => r.title === 'regression-check')).toBe(true);

    // The write landed in the configured target.
    expect(await readIfExists(target)).not.toBeNull();

    // The public sample is byte-for-byte unchanged by the write.
    const sampleAfter = await readIfExists(PUBLIC_SAMPLE);
    expect(bufEq(sampleAfter, sampleBytesBefore)).toBe(true);
  });
});
