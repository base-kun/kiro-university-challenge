import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadRecipes } from '../server/storage/recipeStore.js';
import { searchRecipes } from '../core/searchRecipes.js';
import { SearchParamsSchema, RecipeInputSchema } from '../core/recipeSchema.js';
import { RECIPE_CATEGORIES, RECIPE_DIFFICULTIES } from '../core/recipe.js';

const TOOL_DESCRIPTION = `Search locally stored recipes by conditions.
Use this tool when the user asks to find recipes matching criteria such as
cooking time, ingredients, drink pairings, cuisine style, or flavor.

Parameters:
- query: Free-text substring matched against title, ingredients, tags, and notes.
- ingredients: All listed ingredients must be present in the recipe.
- categories: Recipe category must be one of the specified values (主菜, 副菜, 前菜, 主食, スープ, デザート).
- maxCookingMinutes: Recipes requiring more than this many minutes are excluded.
- difficulty: easy | medium | hard.
- cuisineTags: All specified cuisine styles must match (e.g. 和食, 洋食).
- flavorTags: All specified flavor tags must match (e.g. 辛い, さっぱり).
- drinkPairings: Explicit tag filter over a recipe's REGISTERED drink pairings
  only (e.g. シラーズ, ビール). It returns only recipes that already have the
  tag saved; it does NOT judge which recipes "go well with" a drink.
- textureTags: All specified texture tags must match.

Unspecified parameters are ignored. All conditions are combined with AND.
Returns an empty array when no recipes match — never fabricates data.

Recommending recipes for a drink (e.g. "シラーズに合う主菜"):
do NOT filter by drinkPairings for this. First retrieve candidates with the
structured conditions you do know (maxCookingMinutes, ingredients, categories,
etc.), including recipes that have NO drink pairing registered. Then evaluate
each candidate's affinity yourself from its title, ingredients, category, and
cooking time. In your answer, clearly separate information that is registered in
the recipe data from your own inference, and explain the reason for each pick.`;

const CREATE_DESCRIPTION = `Persist a confirmed, text-only recipe to the local store.

Call this ONLY after you have shown the full proposed recipe to the user and the
user has explicitly approved the content. If something read from the image is
unknown or unreadable, ask the user first — never fabricate. drinkPairings is
optional.

This tool takes TEXT attributes only. Do NOT pass any image, image bytes, file
path, or image id — the application does not handle images. You (the LLM) read
the attached image yourself; only the extracted text fields are registered.

The server assigns the id and createdAt. On success the recipe is saved via the
API server and will appear in the Web list (after reload) and in search_recipes.`;

// Base URL of the API server (REQ-6.3.3). Never a secret.
const API_BASE_URL = process.env.RECIPE_API_BASE_URL ?? 'http://localhost:3001';
// Finite timeout for the API call (REQ-6.3.8).
const API_TIMEOUT_MS = 5_000;

// Raw Zod shape for the tool input. Mirrors SearchParamsSchema; all optional.
const searchInputShape = {
  query: z
    .string()
    .optional()
    .describe('Free-text substring matched against title, ingredients, tags, and notes.'),
  ingredients: z
    .array(z.string())
    .optional()
    .describe('All listed ingredients must be present in the recipe.'),
  categories: z
    .array(z.enum(RECIPE_CATEGORIES as unknown as [string, ...string[]]))
    .optional()
    .describe('Recipe category must be one of: 主菜, 副菜, 前菜, 主食, スープ, デザート.'),
  maxCookingMinutes: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Recipes requiring more than this many minutes are excluded.'),
  difficulty: z
    .enum(RECIPE_DIFFICULTIES as unknown as [string, ...string[]])
    .optional()
    .describe('easy | medium | hard'),
  cuisineTags: z
    .array(z.string())
    .optional()
    .describe('All specified cuisine styles must match (e.g. 和食, 洋食).'),
  flavorTags: z
    .array(z.string())
    .optional()
    .describe('All specified flavor tags must match (e.g. 辛い, さっぱり).'),
  drinkPairings: z
    .array(z.string())
    .optional()
    .describe(
      'Explicit tag filter over REGISTERED drink pairings only (e.g. シラーズ). ' +
        'Do not use this to recommend what pairs with a drink; judge affinity ' +
        'yourself from the retrieved recipes instead.'
    ),
  textureTags: z
    .array(z.string())
    .optional()
    .describe('All specified texture tags must match.'),
};

interface ApiResult {
  ok: boolean;
  status?: number;
  recipe?: unknown;
  error: string | null;
}

/**
 * POST the recipe to the API server with a finite timeout. Returns a structured
 * result rather than throwing, so the tool can surface a clear message.
 */
async function postRecipeToApi(body: unknown): Promise<ApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/api/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      recipe?: unknown;
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error ?? `API returned ${res.status}`,
      };
    }
    return { ok: true, status: res.status, recipe: data.recipe, error: null };
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, error: 'API did not respond (timeout)' };
    }
    return {
      ok: false,
      error: `API unavailable — start the API server (${API_BASE_URL}).`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const server = new McpServer({
    name: 'recipe-shelf',
    version: '1.0.0',
  });

  server.registerTool(
    'search_recipes',
    {
      title: 'Search recipes',
      description: TOOL_DESCRIPTION,
      inputSchema: searchInputShape,
    },
    async (args) => {
      // Validate/normalize the input against the shared schema.
      const params = SearchParamsSchema.parse(args ?? {});
      const recipes = await loadRecipes();
      const results = searchRecipes(recipes, params);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'create_recipe',
    {
      title: 'Create recipe',
      description: CREATE_DESCRIPTION,
      // Pass the shared STRICT schema directly so the SDK rejects unknown
      // fields (REQ-6.3.9) instead of silently stripping them, and so a single
      // schema governs both the API and MCP input (REQ-6.3.2, REQ-3.1.6).
      inputSchema: RecipeInputSchema,
    },
    async (args) => {
      // `args` is already validated by the strict schema above. Guard again for
      // safety, then persist via the API (single writer); never write the data
      // file directly from MCP (REQ-3.1.7, REQ-6.3.3). No image analysis, no
      // affinity judgment.
      const parsed = RecipeInputSchema.safeParse(args ?? {});
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message ?? 'invalid input';
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Invalid input: ${msg}` }],
        };
      }

      const result = await postRecipeToApi(parsed.data);
      if (!result.ok) {
        return {
          isError: true,
          content: [
            { type: 'text' as const, text: `Could not register recipe: ${result.error}` },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ recipe: result.recipe }, null, 2),
          },
        ],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Diagnostic output must go to stderr only (REQ-6.1.6).
  console.error('Recipe MCP server started (stdio).');
}

main().catch((err) => {
  console.error('Fatal MCP server error:', err);
  process.exit(1);
});
