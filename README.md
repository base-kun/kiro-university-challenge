# Recipe Shelf MCP

## 概要 / Overview

### 日本語

レシピを **テキストのみ** の構造化データとして登録し、Kiro（または任意の MCP
クライアント）から検索・推薦できるローカル実行アプリです。画像は Kiro の LLM が
チャット添付から読み取るだけで、アプリにはアップロード・保存・配信**しません**。
保存するのは抽出したテキストだけです。

- **Web (React + Vite)**: 手入力のテキスト登録フォームとレシピカード一覧。
- **API (Node.js `http`)**: JSON の検証と永続化。`data/recipes.local.json` への
  **唯一の書き込み主体**（直列化書き込み）。
- **MCP サーバー (stdio)**: `search_recipes`（保存データの条件検索・純粋ロジック）と
  `create_recipe`（承認済みテキストを **API 経由** で保存）。

画像解析と飲み物の相性提案は Kiro の LLM が担い、アプリは行いません。検索は純粋・
決定的なモジュールで、API と MCP が共有し、単体テストとプロパティテストで検証して
います。

### English

A locally-run app for registering recipes as **text-only** structured data and
searching/recommending them from Kiro (or any MCP client). Images are read by
the Kiro LLM from a chat attachment and are **never** uploaded to, stored by, or
served by the app — only the extracted text is saved.

- **Web (React + Vite)** — manual text registration form + recipe card list.
- **API (Node.js `http`)** — JSON validation and persistence; the single writer
  to `data/recipes.local.json` (serialized writes).
- **MCP server (stdio)** — two tools:
  - `search_recipes` — condition search over stored recipes (pure logic).
  - `create_recipe` — persists a confirmed, text-only recipe **via the API**.

Image analysis and drink-affinity recommendations are done by the Kiro LLM, not
by the app. The search function is a pure, deterministic module shared by the
API and MCP (`src/core/`), covered by unit and property-based tests.

## Architecture

```text
Kiro chat (user attaches image) ──> Kiro LLM extracts text, asks, proposes
      │                                        │  (user approves content,
      │                                        │   then approves tool run)
      ▼                                        ▼
  Web form (text) ──JSON──> Node API (single writer) ──> data/recipes.local.json
                               ▲        │
             create_recipe ────┘        └──> search_recipes reads it
             (MCP, via API)                  (MCP, read-only, pure search)
```

## Prerequisites

- Node.js 20+ (`.nvmrc` pins a version; `nvm use` if you use nvm).

## Install

```bash
npm install
```

## Develop / run

```bash
npm run dev         # web + api + mcp together (concurrently)
npm run dev:web     # Vite dev server (client)
npm run dev:server  # API server on http://localhost:3001
npm run dev:mcp     # MCP stdio server
```

## Verify

```bash
npm run typecheck      # tsc --noEmit (client + server)
npm test               # all tests (unit, property, api, integration)
npm run test:property  # property-based tests (PROP-1..8)
npm run build          # tsc server + vite build
npm run lint           # eslint src tests
```

Current status: typecheck clean, 65 tests passing, 13 property cases passing
(the 8 required PROP-1..8 plus 5 extra PROP-9..13), build and lint clean.

## Registration flows

### A. Web manual entry (text only)

Open the web app, fill the form (title, category, ingredients, cooking minutes,
difficulty, optional tags, notes), submit. The form posts JSON to
`POST /api/recipes`. There is no image field.

### B. LLM-assisted via Kiro (image → text, then MCP)

1. Attach a recipe image to the Kiro chat. (The image stays in the chat; the app
   never receives it.)
2. Kiro's LLM extracts attributes and asks about anything unclear — it does not
   fabricate.
3. Kiro proposes drink pairings with reasons, separating registered facts from
   its own inference.
4. You approve the proposed recipe content; then Kiro asks permission to run the
   `create_recipe` tool (a separate approval). Only then is it saved via the API.
5. Reload the web list to see the new recipe; `search_recipes` can find it.

MCP-registered recipes appear in the web list **after a page reload** (no live
auto-refresh by design).

## MCP registration (Kiro)

Workspace設定は[.kiro/settings/mcp.json](.kiro/settings/mcp.json)です。
macOSのzshでリポジトリルートから起動し、nvmがあれば`.nvmrc`のNodeを使います。
Kiroでこのリポジトリを開き、先にbuildしてください。

The workspace config uses macOS zsh and a repository-relative server path.
It loads nvm when installed and selects the Node version in `.nvmrc`.
Open this repository as the Kiro workspace and build first:

```bash
npm run build   # produces dist/mcp/recipeMcpServer.js
```

- The launcher requires its working directory to be inside this Git repository.
- Without nvm, `node` must be on the login shell PATH. On Windows, adapt the
  command and arguments to your installed Node executable and server path.
- `autoApprove` lists **only** `search_recipes`. `create_recipe` is intentionally
  **not** auto-approved, so registrations always require explicit approval.
- The config holds only a non-secret `RECIPE_API_BASE_URL`; no secrets.
- `create_recipe` requires the API server to be running (`npm run dev:server`).
- Verify in the Kiro MCP panel that `recipe-shelf` shows **connected**.

## Data & privacy

公開用の`data/recipes.json`はサンプルです。開発コマンドとMCPは
Git対象外の`data/recipes.local.json`へ読み書きします。
初回起動時は空のライブラリで始まります。サンプルを使う場合は次を実行します。

`data/recipes.json` contains public sample data. Development commands and MCP
use the ignored `data/recipes.local.json`. To start with sample data:

```bash
cp -n data/recipes.json data/recipes.local.json
```

開発コマンドはmacOS/Linux向けです。Windowsでは同じ環境変数を設定して起動します。
The development scripts use macOS/Linux environment-variable syntax.
On Windows, set RECIPES_DATA_FILE before launching the server.

- `data/recipes.local.json` is runtime-only and git-ignored; only
  `data/recipes.json` is tracked.
- The app stores no images and no secrets. Do not commit real data or secrets.

## Constraints (MVP scope)

- Text-only. No image upload/storage/serving/display, no recipe detail screen,
  no polling/SSE auto-refresh, no vector/semantic search, no login, no external
  DB, no paid AI APIs.
- `docs/product-vision.md` is a future-vision note, not an implementation target.

## Kiro University — Lesson summary

Lesson別の成果物は[CHALLENGE.md](CHALLENGE.md)にまとめています。

See [CHALLENGE.md](CHALLENGE.md) for the files created and used in each Lesson.
