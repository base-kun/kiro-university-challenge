import { describe, it, expect } from 'vitest';
import type { Recipe } from '../../src/core/recipe.js';
import { searchRecipes } from '../../src/core/searchRecipes.js';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'id-1',
    title: 'テスト料理',
    category: '主菜',
    ingredients: ['牛肉', '玉ねぎ'],
    cookingMinutes: 30,
    difficulty: 'easy',
    cuisineTags: ['洋食'],
    flavorTags: ['濃厚'],
    drinkPairings: ['シラーズ'],
    textureTags: ['やわらかい'],
    notes: 'メモ',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('searchRecipes', () => {
  it('returns all recipes when params is empty', () => {
    const recipes = [
      makeRecipe({ id: 'a' }),
      makeRecipe({ id: 'b' }),
      makeRecipe({ id: 'c' }),
    ];
    const results = searchRecipes(recipes, {});
    expect(results.map((r) => r.recipe.id)).toEqual(['a', 'b', 'c']);
  });

  it('filters by maxCookingMinutes (<=)', () => {
    const recipes = [
      makeRecipe({ id: 'fast', cookingMinutes: 20 }),
      makeRecipe({ id: 'edge', cookingMinutes: 30 }),
      makeRecipe({ id: 'slow', cookingMinutes: 45 }),
    ];
    const results = searchRecipes(recipes, { maxCookingMinutes: 30 });
    expect(results.map((r) => r.recipe.id).sort()).toEqual(['edge', 'fast']);
  });

  it('filters by ingredients with AND logic', () => {
    const recipes = [
      makeRecipe({ id: 'both', ingredients: ['牛肉', '玉ねぎ', 'にんにく'] }),
      makeRecipe({ id: 'one', ingredients: ['牛肉'] }),
    ];
    const results = searchRecipes(recipes, {
      ingredients: ['牛肉', '玉ねぎ'],
    });
    expect(results.map((r) => r.recipe.id)).toEqual(['both']);
  });

  it('filters by categories', () => {
    const recipes = [
      makeRecipe({ id: 'main', category: '主菜' }),
      makeRecipe({ id: 'soup', category: 'スープ' }),
      makeRecipe({ id: 'dessert', category: 'デザート' }),
    ];
    const results = searchRecipes(recipes, { categories: ['主菜', 'スープ'] });
    expect(results.map((r) => r.recipe.id).sort()).toEqual(['main', 'soup']);
  });

  it('filters by drinkPairings', () => {
    const recipes = [
      makeRecipe({ id: 'syrah', drinkPairings: ['シラーズ', '赤ワイン'] }),
      makeRecipe({ id: 'beer', drinkPairings: ['ビール'] }),
    ];
    const results = searchRecipes(recipes, { drinkPairings: ['シラーズ'] });
    expect(results.map((r) => r.recipe.id)).toEqual(['syrah']);
  });

  it('matches query as substring across fields', () => {
    const recipes = [
      makeRecipe({ id: 'hit', notes: 'とろとろに煮込む' }),
      makeRecipe({ id: 'miss', notes: 'さっと炒める' }),
    ];
    const results = searchRecipes(recipes, { query: 'とろとろ' });
    expect(results.map((r) => r.recipe.id)).toEqual(['hit']);
  });

  it('normalizes case, whitespace, and width before comparison', () => {
    const recipes = [makeRecipe({ id: 'r', difficulty: 'easy' })];
    // Mixed case + surrounding spaces should still match.
    const results = searchRecipes(recipes, {
      difficulty: '  EASY ' as 'easy',
    });
    expect(results.map((r) => r.recipe.id)).toEqual(['r']);
  });

  it('normalizes tags: full-width/half-width and case equivalence', () => {
    const recipes = [makeRecipe({ id: 'r', cuisineTags: ['Italian'] })];
    const results = searchRecipes(recipes, { cuisineTags: ['  italian '] });
    expect(results.map((r) => r.recipe.id)).toEqual(['r']);
  });

  it('returns empty array when nothing matches', () => {
    const recipes = [makeRecipe({ id: 'a', cookingMinutes: 90 })];
    const results = searchRecipes(recipes, { maxCookingMinutes: 10 });
    expect(results).toEqual([]);
  });

  it('never fabricates recipes: every result exists in the input set', () => {
    const recipes = [
      makeRecipe({ id: 'a' }),
      makeRecipe({ id: 'b' }),
    ];
    const inputIds = new Set(recipes.map((r) => r.id));
    const results = searchRecipes(recipes, { query: 'テスト' });
    for (const result of results) {
      expect(inputIds.has(result.recipe.id)).toBe(true);
    }
  });

  it('includes matchedFields describing why a recipe matched', () => {
    const recipes = [makeRecipe({ id: 'a' })];
    const results = searchRecipes(recipes, {
      maxCookingMinutes: 60,
      categories: ['主菜'],
    });
    expect(results[0].matchedFields).toContain('cookingMinutes');
    expect(results[0].matchedFields).toContain('category');
  });
});
