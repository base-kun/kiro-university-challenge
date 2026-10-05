import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Recipe } from '../../core/recipe.js';
import { RecipeSchema } from '../../core/recipeSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Project root is three levels up from src/server/storage/.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

/**
 * Default runtime data file: the git-ignored local store. Kept as a named
 * constant so tests can assert the exact default the resolver falls back to
 * (and so a regression that points it at the tracked public sample is caught).
 */
export const DEFAULT_DATA_FILE = path.join(DATA_DIR, 'recipes.local.json');

/**
 * Resolve the data file path. Overridable via RECIPES_DATA_FILE for tests.
 *
 * Defaults to the git-ignored runtime store (DEFAULT_DATA_FILE) so the tracked,
 * public sample `data/recipes.json` is never written to. Exported so tests can
 * verify the real resolution logic rather than a hand-copied string.
 */
export function resolveDataFile(): string {
  return process.env.RECIPES_DATA_FILE ?? DEFAULT_DATA_FILE;
}

/**
 * Error thrown when the data file exists but its contents are not a valid
 * recipe array (malformed JSON, a non-array top level, or a record that fails
 * validation). The caller must NOT treat this as "no recipes" and must NOT
 * append/overwrite on top of it (REQ-3.2.2).
 */
export class RecipeDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeDataError';
  }
}

/**
 * Read all persisted recipes. Returns [] only when the file does not exist.
 *
 * Legacy/unknown fields (e.g. the old `imageFilename`) are stripped by
 * RecipeSchema's default object behavior, so pre-migration data keeps loading
 * cleanly (REQ-3.3.1). However, genuinely corrupt data is NOT silently treated
 * as empty: malformed JSON, a non-array top level, or any record that fails
 * schema validation raises a RecipeDataError so callers refuse to register or
 * overwrite on top of unreadable data (REQ-3.2.2).
 */
export async function loadRecipes(): Promise<Recipe[]> {
  const file = resolveDataFile();
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RecipeDataError('recipes data file contains invalid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new RecipeDataError('recipes data file is not a JSON array');
  }

  const recipes: Recipe[] = [];
  parsed.forEach((entry, index) => {
    const result = RecipeSchema.safeParse(entry);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new RecipeDataError(
        `recipes data file has an invalid record at index ${index}` +
          (issue ? `: ${issue.path.join('.') || '(root)'} ${issue.message}` : '')
      );
    }
    // Known fields are kept; unknown/legacy fields (e.g. imageFilename) are
    // stripped by the schema. The original file on disk is not modified here.
    recipes.push(result.data as Recipe);
  });
  return recipes;
}

/**
 * Atomically persist the recipe array: write to a temp file then rename.
 *
 * Before overwriting an existing data file, a timestamped backup of the prior
 * contents is written (git-ignored) so an interrupted/failed rewrite cannot
 * lose existing recipes (REQ-3.1.10, REQ-3.3.2).
 */
export async function saveRecipes(recipes: Recipe[]): Promise<void> {
  const file = resolveDataFile();
  await fs.mkdir(path.dirname(file), { recursive: true });

  // Non-destructive safety: back up the current file (if any) first.
  try {
    const prior = await fs.readFile(file, 'utf8');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(`${file}.backup-${stamp}`, prior, 'utf8');
  } catch (e: unknown) {
    // No existing file to back up is fine; other errors should not block the
    // write but are surfaced to stderr for diagnostics.
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('recipeStore: backup before save failed:', e);
    }
  }

  const tmpPath = `${file}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(recipes, null, 2), 'utf8');
  await fs.rename(tmpPath, file);
}

// ---------------------------------------------------------------------------
// Serialized, failure-isolating write queue (REQ-3.1.8, REQ-3.1.9).
//
// All writes run one at a time through a single promise chain so concurrent
// registrations (Web form + MCP-via-API) cannot interleave or lose updates.
// A rejected operation is isolated to its own caller: the chain tail always
// advances (in `finally`), so later queued writes still run even after a
// failure. The queue tail stores no rejected state.
// ---------------------------------------------------------------------------
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(operation);
  // Advance the tail regardless of success/failure, swallowing the result so a
  // rejection does not poison the chain for subsequent operations.
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * Load, append the given recipe, and save — serialized through the write queue.
 * Returns the appended recipe.
 */
export async function addRecipe(recipe: Recipe): Promise<Recipe> {
  return enqueueWrite(async () => {
    const recipes = await loadRecipes();
    recipes.push(recipe);
    await saveRecipes(recipes);
    return recipe;
  });
}
