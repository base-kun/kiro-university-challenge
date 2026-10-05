import type { Recipe } from './recipe.js';
import type { SearchParams } from './recipeSchema.js';

export interface SearchResult {
  recipe: Recipe;
  matchedFields: string[];
}

/**
 * Normalize a string for comparison: NFKC Unicode normalization, trim, lowercase.
 * Applied to every string before comparison (REQ-5.1.7, PROP-8).
 */
export function normalize(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase();
}

function isSpecified<T>(v: T[] | undefined): v is T[] {
  return Array.isArray(v) && v.length > 0;
}

/**
 * Returns true if every needle matches (as a normalized substring) at least
 * one element of haystack.
 */
function everyNeedleMatchesSome(needles: string[], haystack: string[]): boolean {
  const normalizedHaystack = haystack.map(normalize);
  return needles.every((needle) => {
    const n = normalize(needle);
    if (n === '') return true;
    return normalizedHaystack.some((h) => h.includes(n));
  });
}

/**
 * Pure search function. No file or network I/O.
 * All specified conditions are combined with AND. Unspecified conditions are
 * ignored. Returns every recipe (as a SearchResult) when no condition is
 * specified (params is empty).
 */
export function searchRecipes(
  recipes: Recipe[],
  params: SearchParams
): SearchResult[] {
  const results: SearchResult[] = [];

  for (const recipe of recipes) {
    const matchedFields: string[] = [];

    // 1. maxCookingMinutes
    if (params.maxCookingMinutes !== undefined) {
      if (recipe.cookingMinutes > params.maxCookingMinutes) continue;
      matchedFields.push('cookingMinutes');
    }

    // 2. categories
    if (isSpecified(params.categories)) {
      const recipeCat = normalize(recipe.category);
      const matches = params.categories.some(
        (c) => normalize(c) === recipeCat
      );
      if (!matches) continue;
      matchedFields.push('category');
    }

    // 3. difficulty
    if (params.difficulty !== undefined) {
      if (normalize(recipe.difficulty) !== normalize(params.difficulty)) {
        continue;
      }
      matchedFields.push('difficulty');
    }

    // 4. ingredients — every specified ingredient must match at least one
    if (isSpecified(params.ingredients)) {
      if (!everyNeedleMatchesSome(params.ingredients, recipe.ingredients)) {
        continue;
      }
      matchedFields.push('ingredients');
    }

    // 5. tag fields
    if (isSpecified(params.cuisineTags)) {
      if (!everyNeedleMatchesSome(params.cuisineTags, recipe.cuisineTags)) {
        continue;
      }
      matchedFields.push('cuisineTags');
    }
    if (isSpecified(params.flavorTags)) {
      if (!everyNeedleMatchesSome(params.flavorTags, recipe.flavorTags)) {
        continue;
      }
      matchedFields.push('flavorTags');
    }
    if (isSpecified(params.drinkPairings)) {
      if (!everyNeedleMatchesSome(params.drinkPairings, recipe.drinkPairings)) {
        continue;
      }
      matchedFields.push('drinkPairings');
    }
    if (isSpecified(params.textureTags)) {
      if (!everyNeedleMatchesSome(params.textureTags, recipe.textureTags)) {
        continue;
      }
      matchedFields.push('textureTags');
    }

    // 6. query — free-text substring across title, notes, and all list fields
    if (params.query !== undefined && normalize(params.query) !== '') {
      const q = normalize(params.query);
      const haystacks: string[] = [
        recipe.title,
        recipe.notes,
        ...recipe.ingredients,
        ...recipe.cuisineTags,
        ...recipe.flavorTags,
        ...recipe.drinkPairings,
        ...recipe.textureTags,
      ];
      const matches = haystacks.some((h) => normalize(h).includes(q));
      if (!matches) continue;
      matchedFields.push('query');
    }

    results.push({ recipe, matchedFields });
  }

  return results;
}
