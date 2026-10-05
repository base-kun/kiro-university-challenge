export type RecipeCategory =
  | '主菜'
  | '副菜'
  | '前菜'
  | '主食'
  | 'スープ'
  | 'デザート';

export type RecipeDifficulty = 'easy' | 'medium' | 'hard';

export interface Recipe {
  id: string; // uuid v4 (server-generated)
  title: string; // required, non-empty
  category: RecipeCategory;
  ingredients: string[]; // split from comma-separated input
  cookingMinutes: number; // integer >= 1
  difficulty: RecipeDifficulty;
  cuisineTags: string[];
  flavorTags: string[];
  drinkPairings: string[];
  textureTags: string[];
  notes: string; // optional, default ""
  createdAt: string; // ISO 8601
}

export const RECIPE_CATEGORIES: readonly RecipeCategory[] = [
  '主菜',
  '副菜',
  '前菜',
  '主食',
  'スープ',
  'デザート',
] as const;

export const RECIPE_DIFFICULTIES: readonly RecipeDifficulty[] = [
  'easy',
  'medium',
  'hard',
] as const;
