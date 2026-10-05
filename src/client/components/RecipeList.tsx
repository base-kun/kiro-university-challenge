import type { Recipe } from '../../core/recipe';
import { RecipeCard } from './RecipeCard';

interface RecipeListProps {
  recipes: Recipe[];
}

export function RecipeList({ recipes }: RecipeListProps): JSX.Element {
  if (recipes.length === 0) {
    return (
      <p className="empty-state">
        まだレシピがありません。最初のレシピを登録しましょう。
      </p>
    );
  }

  return (
    <section className="recipe-grid" aria-label="レシピ一覧">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </section>
  );
}
