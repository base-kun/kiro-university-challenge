import { z } from 'zod';
import { RECIPE_CATEGORIES, RECIPE_DIFFICULTIES } from './recipe.js';

export const CategorySchema = z.enum(
  RECIPE_CATEGORIES as unknown as [string, ...string[]]
);

export const DifficultySchema = z.enum(
  RECIPE_DIFFICULTIES as unknown as [string, ...string[]]
);

/**
 * Full recipe record schema, mirroring the (text-only) Recipe type.
 * Used to validate persisted/returned recipe objects.
 *
 * This schema is intentionally tolerant of unknown/legacy fields on READ:
 * `.strip()` (the Zod default for objects) drops any extra properties such as
 * the legacy `imageFilename` from the previous image-based MVP, so old data
 * keeps loading cleanly (REQ-3.3.1). This differs from registration input,
 * which is strict (see RecipeInputSchema).
 */
export const RecipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: CategorySchema,
  ingredients: z.array(z.string()),
  cookingMinutes: z.number().int().min(1),
  difficulty: DifficultySchema,
  cuisineTags: z.array(z.string()),
  flavorTags: z.array(z.string()),
  drinkPairings: z.array(z.string()),
  textureTags: z.array(z.string()),
  notes: z.string(),
  createdAt: z.string().min(1),
});

const optionalStringArray = z
  .array(z.string())
  .optional()
  .transform((v) => v ?? []);

/**
 * Registration input schema for text-only recipe creation, shared by the API
 * JSON path and the MCP `create_recipe` tool (REQ-3.1.6, REQ-6.3.2).
 *
 * STRICT: unknown fields (including any image-related field) are rejected
 * (REQ-6.3.9). The server, not the client, assigns `id` and `createdAt`, so
 * those are not accepted here. Optional tag arrays default to [], notes to "".
 */
export const RecipeInputSchema = z
  .object({
    title: z
      .string({ required_error: 'title is required' })
      .trim()
      .min(1, 'title is required'),
    category: CategorySchema,
    ingredients: optionalStringArray,
    cookingMinutes: z
      .number({ invalid_type_error: 'cookingMinutes must be a positive integer' })
      .int('cookingMinutes must be a positive integer')
      .min(1, 'cookingMinutes must be a positive integer'),
    difficulty: DifficultySchema,
    cuisineTags: optionalStringArray,
    flavorTags: optionalStringArray,
    drinkPairings: optionalStringArray,
    textureTags: optionalStringArray,
    notes: z
      .string()
      .optional()
      .transform((v) => v ?? ''),
  })
  .strict();

/**
 * Search parameters schema for both the API and the MCP tool.
 * Every field is optional; unspecified fields are ignored by the search.
 */
export const SearchParamsSchema = z.object({
  query: z.string().optional(),
  ingredients: z.array(z.string()).optional(),
  categories: z.array(CategorySchema).optional(),
  maxCookingMinutes: z.number().int().min(1).optional(),
  difficulty: DifficultySchema.optional(),
  cuisineTags: z.array(z.string()).optional(),
  flavorTags: z.array(z.string()).optional(),
  drinkPairings: z.array(z.string()).optional(),
  textureTags: z.array(z.string()).optional(),
});

export type RecipeInput = z.infer<typeof RecipeSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;
// Registration input (text-only). Output type has required arrays/notes after
// transform; input type (what callers pass) has them optional.
export type RecipeRegistrationInput = z.infer<typeof RecipeInputSchema>;
export type RecipeRegistrationInputRaw = z.input<typeof RecipeInputSchema>;
