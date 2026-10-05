import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Recipe } from '../../core/recipe';
import { RECIPE_CATEGORIES, RECIPE_DIFFICULTIES } from '../../core/recipe';

interface RecipeFormProps {
  onSuccess: (recipe: Recipe) => void;
}

interface FormState {
  title: string;
  category: string;
  ingredients: string;
  cookingMinutes: string;
  difficulty: string;
  cuisineTags: string;
  flavorTags: string;
  drinkPairings: string;
  textureTags: string;
  notes: string;
}

const INITIAL: FormState = {
  title: '',
  category: RECIPE_CATEGORIES[0],
  ingredients: '',
  cookingMinutes: '',
  difficulty: 'easy',
  cuisineTags: '',
  flavorTags: '',
  drinkPairings: '',
  textureTags: '',
  notes: '',
};

/** Split a comma-separated string into trimmed, non-empty values. */
function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function RecipeForm({ onSuccess }: RecipeFormProps): JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (form.title.trim() === '') return 'タイトルは必須です。';
    const minutes = Number(form.cookingMinutes);
    if (!Number.isInteger(minutes) || minutes < 1) {
      return '調理時間は1以上の整数で入力してください。';
    }
    if (!RECIPE_CATEGORIES.includes(form.category as never)) {
      return 'カテゴリーが不正です。';
    }
    if (!RECIPE_DIFFICULTIES.includes(form.difficulty as never)) {
      return '難易度が不正です。';
    }
    return null;
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        ingredients: splitCsv(form.ingredients),
        cookingMinutes: Number(form.cookingMinutes),
        difficulty: form.difficulty,
        cuisineTags: splitCsv(form.cuisineTags),
        flavorTags: splitCsv(form.flavorTags),
        drinkPairings: splitCsv(form.drinkPairings),
        textureTags: splitCsv(form.textureTags),
        notes: form.notes.trim(),
      };

      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? '登録に失敗しました。');
        return;
      }
      const data = (await res.json()) as { recipe: Recipe };
      onSuccess(data.recipe);

      // Reset the form.
      setForm(INITIAL);
    } catch {
      setError('ネットワークエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="recipe-form" onSubmit={onSubmit} noValidate>
      <h2>レシピを登録</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <label>
        タイトル<span aria-hidden="true"> *</span>
        <input
          type="text"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          required
        />
      </label>

      <label>
        カテゴリー<span aria-hidden="true"> *</span>
        <select
          value={form.category}
          onChange={(e) => update('category', e.target.value)}
        >
          {RECIPE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label>
        材料（カンマ区切り）
        <input
          type="text"
          value={form.ingredients}
          placeholder="牛肉, 玉ねぎ, にんにく"
          onChange={(e) => update('ingredients', e.target.value)}
        />
      </label>

      <label>
        調理時間（分）<span aria-hidden="true"> *</span>
        <input
          type="number"
          min={1}
          value={form.cookingMinutes}
          onChange={(e) => update('cookingMinutes', e.target.value)}
          required
        />
      </label>

      <label>
        難易度<span aria-hidden="true"> *</span>
        <select
          value={form.difficulty}
          onChange={(e) => update('difficulty', e.target.value)}
        >
          {RECIPE_DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label>
        料理ジャンル（カンマ区切り）
        <input
          type="text"
          value={form.cuisineTags}
          placeholder="和食, 洋食, 中華"
          onChange={(e) => update('cuisineTags', e.target.value)}
        />
      </label>

      <label>
        味わいタグ（カンマ区切り）
        <input
          type="text"
          value={form.flavorTags}
          placeholder="甘い, 辛い, 濃厚, さっぱり"
          onChange={(e) => update('flavorTags', e.target.value)}
        />
      </label>

      <label>
        合うお酒・ドリンク（カンマ区切り、任意）
        <input
          type="text"
          value={form.drinkPairings}
          placeholder="シラーズ, 白ワイン, ビール, お茶"
          onChange={(e) => update('drinkPairings', e.target.value)}
        />
      </label>

      <label>
        食感タグ（カンマ区切り）
        <input
          type="text"
          value={form.textureTags}
          placeholder="やわらかい, 香ばしい, 歯ごたえがある"
          onChange={(e) => update('textureTags', e.target.value)}
        />
      </label>

      <label>
        メモ
        <textarea
          value={form.notes}
          rows={3}
          onChange={(e) => update('notes', e.target.value)}
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? '登録中…' : 'レシピを登録'}
      </button>
    </form>
  );
}
