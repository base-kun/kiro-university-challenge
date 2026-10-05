import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Recipe, RecipeCategory } from '../../src/core/recipe.js';
import { RECIPE_CATEGORIES, RECIPE_DIFFICULTIES } from '../../src/core/recipe.js';
import {
  searchRecipes,
  normalize,
  type SearchResult,
} from '../../src/core/searchRecipes.js';
import type { SearchParams } from '../../src/core/recipeSchema.js';

const CATEGORIES = RECIPE_CATEGORIES as readonly RecipeCategory[];

const tagArb = fc.array(fc.string({ minLength: 1, maxLength: 8 }), {
  maxLength: 4,
});

const recipeArb: fc.Arbitrary<Recipe> = fc.record({
  id: fc.uuid(),
  title: fc.string({ maxLength: 20 }),
  category: fc.constantFrom(...CATEGORIES),
  ingredients: fc.array(fc.string({ minLength: 1, maxLength: 8 }), {
    maxLength: 5,
  }),
  cookingMinutes: fc.integer({ min: 1, max: 240 }),
  difficulty: fc.constantFrom(...RECIPE_DIFFICULTIES),
  cuisineTags: tagArb,
  flavorTags: tagArb,
  drinkPairings: tagArb,
  textureTags: tagArb,
  notes: fc.string({ maxLength: 20 }),
  createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
});

const recipePoolArb = fc.array(recipeArb, { minLength: 0, maxLength: 20 });

function ids(results: SearchResult[]): string[] {
  return results.map((r) => r.recipe.id);
}

describe('searchRecipes correctness properties', () => {
  it('PROP-1: maxCookingMinutes upper bound', () => {
    fc.assert(
      fc.property(
        recipePoolArb,
        fc.integer({ min: 1, max: 240 }),
        (recipes, max) => {
          const results = searchRecipes(recipes, { maxCookingMinutes: max });
          for (const r of results) {
            expect(r.recipe.cookingMinutes).toBeLessThanOrEqual(max);
          }
        }
      )
    );
  });

  it('PROP-2: ingredients containment', () => {
    fc.assert(
      fc.property(
        recipePoolArb,
        fc.array(fc.string({ minLength: 1, maxLength: 8 }), {
          minLength: 1,
          maxLength: 4,
        }),
        (recipes, ingredients) => {
          const results = searchRecipes(recipes, { ingredients });
          for (const r of results) {
            const haystack = r.recipe.ingredients.map(normalize);
            for (const needle of ingredients) {
              const n = normalize(needle);
              if (n === '') continue;
              expect(haystack.some((h) => h.includes(n))).toBe(true);
            }
          }
        }
      )
    );
  });

  it('PROP-3: category membership', () => {
    fc.assert(
      fc.property(
        recipePoolArb,
        fc
          .subarray([...CATEGORIES], { minLength: 1 })
          .map((a) => a as RecipeCategory[]),
        (recipes, categories) => {
          const results = searchRecipes(recipes, { categories });
          const normalizedSelected = categories.map(normalize);
          for (const r of results) {
            expect(normalizedSelected).toContain(normalize(r.recipe.category));
          }
        }
      )
    );
  });

  it('PROP-4: monotone restriction (adding a condition cannot grow results)', () => {
    fc.assert(
      fc.property(
        recipePoolArb,
        fc.integer({ min: 1, max: 240 }),
        fc
          .subarray([...CATEGORIES], { minLength: 1 })
          .map((a) => a as RecipeCategory[]),
        (recipes, max, categories) => {
          const base: SearchParams = { maxCookingMinutes: max };
          const extended: SearchParams = {
            maxCookingMinutes: max,
            categories,
          };
          const baseIds = new Set(ids(searchRecipes(recipes, base)));
          const extendedIds = ids(searchRecipes(recipes, extended));
          for (const id of extendedIds) {
            expect(baseIds.has(id)).toBe(true);
          }
        }
      )
    );
  });

  it('PROP-5: empty params returns all recipes', () => {
    fc.assert(
      fc.property(recipePoolArb, (recipes) => {
        const results = searchRecipes(recipes, {});
        expect(ids(results)).toEqual(recipes.map((r) => r.id));
      })
    );
  });

  it('PROP-6: determinism', () => {
    fc.assert(
      fc.property(
        recipePoolArb,
        fc.record(
          {
            query: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
            maxCookingMinutes: fc.option(fc.integer({ min: 1, max: 240 }), {
              nil: undefined,
            }),
          },
          { requiredKeys: [] }
        ),
        (recipes, params) => {
          const a = searchRecipes(recipes, params as SearchParams);
          const b = searchRecipes(recipes, params as SearchParams);
          expect(ids(a)).toEqual(ids(b));
          expect(a.map((r) => r.matchedFields)).toEqual(
            b.map((r) => r.matchedFields)
          );
        }
      )
    );
  });

  it('PROP-7: no fabrication', () => {
    fc.assert(
      fc.property(
        recipePoolArb,
        fc.record(
          {
            query: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
            maxCookingMinutes: fc.option(fc.integer({ min: 1, max: 240 }), {
              nil: undefined,
            }),
          },
          { requiredKeys: [] }
        ),
        (recipes, params) => {
          const inputIds = new Set(recipes.map((r) => r.id));
          const results = searchRecipes(recipes, params as SearchParams);
          for (const r of results) {
            expect(inputIds.has(r.recipe.id)).toBe(true);
          }
        }
      )
    );
  });

  it('PROP-8: normalization equivalence for tags', () => {
    fc.assert(
      fc.property(
        recipePoolArb,
        fc.string({ minLength: 1, maxLength: 8 }),
        (recipes, tag) => {
          const plain = normalize(tag);
          // Skip degenerate tags that normalize to empty (always-match).
          fc.pre(plain !== '');
          const variant = `  ${tag.toUpperCase()}  `;
          const a = ids(searchRecipes(recipes, { cuisineTags: [tag] }));
          const b = ids(searchRecipes(recipes, { cuisineTags: [variant] }));
          // Only guaranteed equal when uppercase round-trips through normalize.
          fc.pre(normalize(variant) === plain);
          expect(a).toEqual(b);
        }
      )
    );
  });
});

describe('searchRecipes additional correctness properties', () => {
  it('PROP-9: difficulty exact match (results share the requested difficulty)', () => {
    fc.assert(
      fc.property(
        recipePoolArb,
        fc.constantFrom(...RECIPE_DIFFICULTIES),
        (recipes, difficulty) => {
          const results = searchRecipes(recipes, { difficulty });
          for (const r of results) {
            expect(normalize(r.recipe.difficulty)).toBe(normalize(difficulty));
          }
        }
      )
    );
  });

  it('PROP-10: idempotence (re-searching the result set reproduces the result set)', () => {
    fc.assert(
      fc.property(
        recipePoolArb,
        fc.record(
          {
            query: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
            maxCookingMinutes: fc.option(fc.integer({ min: 1, max: 240 }), {
              nil: undefined,
            }),
            difficulty: fc.option(fc.constantFrom(...RECIPE_DIFFICULTIES), {
              nil: undefined,
            }),
          },
          { requiredKeys: [] }
        ),
        (recipes, params) => {
          const p = params as SearchParams;
          const first = searchRecipes(recipes, p);
          const firstRecipes = first.map((r) => r.recipe);
          const second = searchRecipes(firstRecipes, p);
          expect(ids(second)).toEqual(ids(first));
        }
      )
    );
  });

  it('PROP-11: matchedFields soundness (only specified conditions appear, no unspecified ones)', () => {
    const CONDITION_FIELDS = [
      'cookingMinutes',
      'category',
      'difficulty',
      'ingredients',
      'cuisineTags',
      'flavorTags',
      'drinkPairings',
      'textureTags',
      'query',
    ] as const;

    fc.assert(
      fc.property(
        recipePoolArb,
        fc.record(
          {
            query: fc.option(fc.string({ minLength: 1, maxLength: 8 }), {
              nil: undefined,
            }),
            maxCookingMinutes: fc.option(fc.integer({ min: 1, max: 240 }), {
              nil: undefined,
            }),
            difficulty: fc.option(fc.constantFrom(...RECIPE_DIFFICULTIES), {
              nil: undefined,
            }),
            categories: fc.option(
              fc
                .subarray([...CATEGORIES], { minLength: 1 })
                .map((a) => a as RecipeCategory[]),
              { nil: undefined }
            ),
          },
          { requiredKeys: [] }
        ),
        (recipes, params) => {
          const p = params as SearchParams;
          // Which fields are "active" (specified in a way the search acts on).
          const expectedActive = new Set<string>();
          if (p.maxCookingMinutes !== undefined)
            expectedActive.add('cookingMinutes');
          if (p.categories && p.categories.length > 0)
            expectedActive.add('category');
          if (p.difficulty !== undefined) expectedActive.add('difficulty');
          if (p.query !== undefined && normalize(p.query) !== '')
            expectedActive.add('query');

          const results = searchRecipes(recipes, p);
          for (const r of results) {
            for (const f of r.matchedFields) {
              // every matched field must be a known condition field
              expect(CONDITION_FIELDS).toContain(f);
              // and must be one of the active conditions
              expect(expectedActive.has(f)).toBe(true);
            }
            // no duplicates in matchedFields
            expect(new Set(r.matchedFields).size).toBe(r.matchedFields.length);
          }
        }
      )
    );
  });

  it('PROP-12: query reflexivity (a recipe matches its own non-empty title)', () => {
    fc.assert(
      fc.property(
        recipeArb,
        recipePoolArb,
        (target, others) => {
          // Only meaningful when the title is non-empty after normalization.
          fc.pre(normalize(target.title) !== '');
          const recipes = [...others, target];
          const results = searchRecipes(recipes, { query: target.title });
          expect(ids(results)).toContain(target.id);
        }
      )
    );
  });

  it('PROP-13: subset + order preservation (results are a sublist of the input)', () => {
    fc.assert(
      fc.property(
        recipePoolArb,
        fc.record(
          {
            query: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
            maxCookingMinutes: fc.option(fc.integer({ min: 1, max: 240 }), {
              nil: undefined,
            }),
            difficulty: fc.option(fc.constantFrom(...RECIPE_DIFFICULTIES), {
              nil: undefined,
            }),
          },
          { requiredKeys: [] }
        ),
        (recipes, params) => {
          const resultIds = ids(searchRecipes(recipes, params as SearchParams));
          const inputIds = recipes.map((r) => r.id);
          // results must appear in the same relative order as the input
          let cursor = 0;
          for (const rid of resultIds) {
            const found = inputIds.indexOf(rid, cursor);
            expect(found).toBeGreaterThanOrEqual(cursor);
            cursor = found + 1;
          }
        }
      )
    );
  });
});
