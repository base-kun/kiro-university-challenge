import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import type { Recipe } from '../../core/recipe.js';
import { RecipeInputSchema } from '../../core/recipeSchema.js';
import { addRecipe, loadRecipes } from '../storage/recipeStore.js';

// Maximum accepted JSON request body size (REQ-7.6).
const MAX_BODY_BYTES = 65_536;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

/**
 * Read the request body as a UTF-8 string, enforcing the max size limit.
 * Rejects with a sentinel when the body exceeds MAX_BODY_BYTES.
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let over = false;

    req.on('data', (chunk: Buffer) => {
      if (over) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        over = true;
        // Stop buffering and drain the rest of the request without tearing
        // down the socket, so the 413 response can be written cleanly.
        req.resume();
        reject(new Error('BODY_TOO_LARGE'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!over) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => {
      if (!over) reject(err);
    });
  });
}

/**
 * True when the Content-Type is `application/json`, optionally with parameters
 * such as `; charset=utf-8`. Any other media type is unsupported (415).
 */
function isJsonContentType(req: IncomingMessage): boolean {
  const raw = req.headers['content-type'];
  if (!raw) return false;
  const mediaType = raw.split(';', 1)[0].trim().toLowerCase();
  return mediaType === 'application/json';
}

async function handleCreate(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!isJsonContentType(req)) {
    sendJson(res, 415, {
      error: 'Content-Type must be application/json',
    });
    return;
  }

  let bodyText: string;
  try {
    bodyText = await readBody(req);
  } catch (e) {
    if (e instanceof Error && e.message === 'BODY_TOO_LARGE') {
      sendJson(res, 413, { error: 'request body too large' });
      return;
    }
    sendJson(res, 400, { error: 'could not read request body' });
    return;
  }

  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    sendJson(res, 400, { error: 'invalid JSON body' });
    return;
  }

  const parsed = RecipeInputSchema.safeParse(json);
  if (!parsed.success) {
    sendJson(res, 400, { error: formatZodError(parsed.error) });
    return;
  }

  const input = parsed.data;
  const recipe: Recipe = {
    id: randomUUID(),
    title: input.title,
    category: input.category as Recipe['category'],
    ingredients: input.ingredients,
    cookingMinutes: input.cookingMinutes,
    difficulty: input.difficulty as Recipe['difficulty'],
    cuisineTags: input.cuisineTags,
    flavorTags: input.flavorTags,
    drinkPairings: input.drinkPairings,
    textureTags: input.textureTags,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };

  await addRecipe(recipe);
  sendJson(res, 201, { recipe });
}

/**
 * Turn a Zod error into a single descriptive message. Unknown-field rejections
 * (strict schema) produce an "unrecognized_keys" issue; surface the key name.
 */
function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'invalid input';
  if (issue.code === 'unrecognized_keys') {
    const keys = (issue as { keys?: string[] }).keys ?? [];
    return `unexpected field: ${keys.join(', ')}`;
  }
  return issue.message;
}

async function handleList(res: ServerResponse): Promise<void> {
  const recipes = await loadRecipes();
  sendJson(res, 200, { recipes });
}

/**
 * Route dispatcher for the text-only recipe endpoints.
 * Returns true if the request was handled, false otherwise.
 *
 * The system handles no images: there is no upload endpoint and no static file
 * serving (REQ-2.1).
 */
export async function handleRecipes(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';
  const pathname = url.pathname;

  if (pathname === '/api/recipes' && method === 'POST') {
    await handleCreate(req, res);
    return true;
  }
  if (pathname === '/api/recipes' && method === 'GET') {
    await handleList(res);
    return true;
  }
  return false;
}
