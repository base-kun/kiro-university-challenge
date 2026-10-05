import type { Recipe } from '../../core/recipe';

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps): JSX.Element {
  return (
    <article className="recipe-card">
      <div className="recipe-card-body">
        <h3 className="recipe-card-title">{recipe.title}</h3>
        <dl className="recipe-card-meta">
          <div>
            <dt>カテゴリー</dt>
            <dd>{recipe.category}</dd>
          </div>
          <div>
            <dt>調理時間</dt>
            <dd>{recipe.cookingMinutes} 分</dd>
          </div>
          <div>
            <dt>難易度</dt>
            <dd>
              <span className={`difficulty difficulty-${recipe.difficulty}`}>
                {recipe.difficulty}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
