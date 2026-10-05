# recipe-curator (self-made Kiro Power)

## 概要 / Overview

### 日本語

レシピ画像をきれいなテキストに整理し、本プロジェクト既存の **Recipe Shelf MCP**
ツール（`create_recipe` / `search_recipes`）で登録・検索するための **再利用可能な
手順** をまとめた、スキルのみの Power です。

- **MCP サーバーは含みません。** スキルのみ。Recipe Shelf MCP は別途登録します
  （プロジェクト README と `.kiro/settings/mcp.json` 参照）。本 Power はそれを
  移動も複製もしません。
- **依存追加なし・アプリ変更なし。** パッケージ追加や `src/` の変更はしません。
- **テキストのみ。** 画像は保存せず、承認済みのテキスト項目だけを `create_recipe`
  で登録します。

### English

A small, skill-only Power that packages a **reusable procedure** for turning a
recipe photo into clean text and registering/searching it through the project's
existing **Recipe Shelf MCP** tools (`create_recipe`, `search_recipes`).

- **No MCP server here.** Skill only; the Recipe Shelf MCP server is registered
  separately and this Power neither moves nor duplicates it.
- **No dependencies, no app changes.**
- **Text only.** The image is never stored; only approved text is registered.

## Contents

```text
powers/recipe-curator/
├── plugin.json                     # Agent Plugins manifest (author.name = base-kun)
└── skills/recipe-curation/SKILL.md # the procedure
```

Author: `author.name` is set to `base-kun` (a public handle).

## 導入と利用 / Import & use (Kiro IDE)

### 日本語

1. Powers パネル（稲妻付き Ghosty アイコン）を開く。
2. **Add Custom Power → Import power from a folder**。
3. `powers/recipe-curator`（`plugin.json` を含む）を選択。
4. **Install**。
5. フォルダを置くだけでは導入になりません。パネルからのインポートが必要です。
6. 確認: パネルに表示され、チャットでキーワード（「レシピ」「recipe」等）を使うと
   有効化。レシピ画像を添付し「登録前の内容整理」を依頼して動作確認。

### English

1. Open the Powers panel (Ghosty icon with the lightning bolt).
2. **Add Custom Power → Import power from a folder.**
3. Select `powers/recipe-curator` (contains `plugin.json`).
4. Click **Install**. Placing the folder in the repo is **not** installing it.
5. Confirm: it appears in the Powers panel and activates when you use its
   keywords (e.g. "recipe"/"レシピ"). Attach a recipe photo and ask to organize
   it for registration.

## Steering との関係 / Relationship to Steering

Steering (`.kiro/steering/project-standards.md`) = 永続ルール / persistent rules.
This Power = 具体的な作業手順 / the concrete steps for one task (curate → register
→ search). They are intentionally separate, not copies.
