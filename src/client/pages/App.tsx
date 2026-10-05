import { useCallback, useEffect, useState } from 'react';
import type { Recipe } from '../../core/recipe';
import { RecipeForm } from '../components/RecipeForm';
import { RecipeList } from '../components/RecipeList';

export function App(): JSX.Element {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchRecipes = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/recipes');
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as { recipes: Recipe[] };
      setRecipes(data.recipes);
      setLoadError(null);
    } catch {
      setLoadError('レシピの読み込みに失敗しました。');
    }
  }, []);

  useEffect(() => {
    void fetchRecipes();
  }, [fetchRecipes]);

  const onSuccess = useCallback((recipe: Recipe): void => {
    setRecipes((prev) => [...prev, recipe]);
  }, []);

  return (
    <main className="app">
      <header className="app-header">
        <h1>Recipe Shelf</h1>
        <p>レシピを登録して、MCP から条件検索できます。</p>
      </header>

      <div className="app-layout">
        <RecipeForm onSuccess={onSuccess} />
        <div className="app-list">
          <h2>登録済みレシピ</h2>
          {loadError && (
            <p className="form-error" role="alert">
              {loadError}
            </p>
          )}
          <RecipeList recipes={recipes} />
        </div>
      </div>
    </main>
  );
}
