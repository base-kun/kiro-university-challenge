# Requirements Document

## Introduction

Recipe Shelf MCPは、ユーザーがレシピをテキスト属性として登録し、KiroなどのMCPクライアントから条件に合うレシピを検索・推薦できる、ローカル実行型のWebアプリケーションです。

登録方法は2通りを提供します。(1) WebフォームからのテキストベースのMANUAL登録。(2) ユーザーがKiroチャットにレシピ画像を添付し、KiroのLLMが画像から属性（料理名・材料・調理時間・カテゴリなど）を読み取り、不明点を確認し、飲み物相性を理由付きで提案し、ユーザーの明示的な承認後にMCPツール `create_recipe` でテキストデータを登録する方法。

画像はKiroのLLMが読み取る入力としてのみ使用します。アプリケーション・API・MCPサーバーは画像を一切受け取らず、保存・配信・表示しません。登録・保存・検索の対象は構造化されたテキスト属性のみです。元画像とレシピの関連付けは将来の拡張としてスコープ外とします。

本ドキュメントは、EARS（Easy Approach to Requirements Syntax）形式で要件を定義します。

---

## Glossary

| Term | Definition |
|------|------------|
| Recipe | A record containing a title, ingredients, cooking time, category, difficulty, tags, and notes stored in `data/recipes.local.json`. A recipe does not include an image or any image reference. |
| MCP | Model Context Protocol — a protocol that allows AI clients such as Kiro to call structured tools exposed by a local server. |
| `search_recipes` | The MCP tool that accepts search parameters and returns matching recipes from the local data store. |
| `create_recipe` | The MCP tool that accepts a confirmed, structured (text-only) recipe and persists it by calling the API server. It performs no image analysis and no drink-affinity judgment. |
| EARS | Easy Approach to Requirements Syntax — a structured natural-language format for writing testable requirements. |
| NFKC | Unicode Normalization Form KC — compatibility decomposition followed by canonical composition; used to normalize visually similar characters before string comparison. |
| Pure function | A function whose output depends solely on its inputs and has no side effects (no file I/O, no HTTP calls). |
| Atomic write | Writing to a temporary file then renaming it to the target path, ensuring the target is never left in a partially written state. |
| Property-based test | A test that verifies a logical property holds for a large set of automatically generated inputs, rather than a fixed set of examples. |
| Correctness Property | A formally stated invariant (PROP-1 through PROP-8) that the search function must satisfy for all valid inputs. |

---

## Requirements

## 1. レシピ登録機能

レシピは構造化されたテキスト属性のみで構成される。登録経路は、Webフォームの手入力（REQ-1.1〜1.2）と、KiroのLLM支援による画像ベース抽出→MCP登録（Section 6.4）の2つ。画像そのものは保存・配信・表示しない。

### 1.1 フォーム入力（Web手入力）

- **REQ-1.1.1**: The system shall allow the user to input a recipe title (required).
- **REQ-1.1.2**: The system shall allow the user to select a category from the following values: 主菜, 副菜, 前菜, 主食, スープ, デザート.
- **REQ-1.1.3**: The system shall allow the user to input ingredients as a comma-separated string.
- **REQ-1.1.4**: The system shall allow the user to input cooking time in minutes as a positive integer.
- **REQ-1.1.5**: The system shall allow the user to select difficulty from: easy, medium, hard.
- **REQ-1.1.6**: The system shall allow the user to input cuisine tags as a comma-separated string (e.g., 和食, 洋食, 中華).
- **REQ-1.1.7**: The system shall allow the user to input flavor tags as a comma-separated string (e.g., 甘い, 辛い, 濃厚, さっぱり).
- **REQ-1.1.8**: The system shall allow the user to optionally input drink pairings as a comma-separated string (e.g., シラーズ, 白ワイン, ビール, お茶). This field is optional; recipes without drink pairings shall still be saved and remain eligible for drink-affinity recommendations (see Section 5.3).
- **REQ-1.1.9**: The system shall allow the user to input texture tags as a comma-separated string (e.g., やわらかい, 香ばしい, 歯ごたえがある).
- **REQ-1.1.10**: The system shall allow the user to input optional notes as free text.
- **REQ-1.1.11**: The Web registration form shall not include any image file picker, image upload control, or image preview; registration uses text attributes only.

### 1.2 入力バリデーション

- **REQ-1.2.1**: When the user submits the form without a title, the system shall display a validation error and not submit the recipe.
- **REQ-1.2.2**: When the user inputs a cooking time that is not a positive integer (≥ 1), the system shall display a validation error and not submit the recipe.
- **REQ-1.2.3**: When the user inputs an invalid category value, the system shall display a validation error and not submit the recipe.
- **REQ-1.2.4**: When the user inputs an invalid difficulty value, the system shall display a validation error and not submit the recipe.

---

## 2. 画像の扱い

本システムは画像をレシピデータとして保存しない。画像はKiroのLLMが属性抽出のために読み取る入力としてのみ使われる。

- **REQ-2.1**: The application, API server, and MCP server shall not accept, store, serve, or display image files. There is no image upload endpoint, no static image serving, and no image field in the recipe data model.
- **REQ-2.2**: Image reading shall be performed solely by the Kiro LLM on an image the user attaches to the Kiro chat. The system shall not perform in-app OCR, image AI, or any image processing.
- **REQ-2.3**: The system shall not require the image file path or binary of a Kiro-attached image to be passed to the API or MCP server. `create_recipe` accepts text attributes only (Section 6.3).
- **REQ-2.4**: Associating an original image file with a stored recipe is out of scope for this MVP and shall be treated as a future extension.

---

## 3. 永続化機能

### 3.1 レシピデータの保存

- **REQ-3.1.1**: The system shall persist recipe attributes in `data/recipes.local.json` as a JSON array.
- **REQ-3.1.2**: When `data/recipes.local.json` does not exist, the system shall initialize it as an empty array.
- **REQ-3.1.3**: The system shall write recipe data atomically (using a temporary file and rename) to prevent data corruption from interrupted writes.
- **REQ-3.1.4**: Each saved recipe shall have a unique string ID generated by the server.
- **REQ-3.1.5**: Each saved recipe shall include a `createdAt` field in ISO 8601 format generated by the server.
- **REQ-3.1.6**: The recipe validation and persistence logic shall be shared by the Web/API path and the MCP path (no duplicated validation or save implementation), consistent with REQ-8.5 for search logic.
- **REQ-3.1.7**: The API server shall be the single writer to `data/recipes.local.json`. MCP-initiated registration shall persist by calling the API server rather than writing the data file directly.
- **REQ-3.1.8**: The API server shall serialize concurrent write operations so that simultaneous registrations (e.g., from the Web UI and from MCP) do not cause lost updates; all submitted recipes shall be persisted.
- **REQ-3.1.9**: When a single write operation fails, the write queue shall recover: the failure shall be isolated to that operation and subsequent queued writes shall still execute and persist (the serialization mechanism is not left permanently broken).
- **REQ-3.1.10**: Before rewriting `data/recipes.local.json`, the system should be able to preserve the prior contents (e.g., a timestamped backup) so that an interrupted or failed rewrite does not lose existing recipes (REQ-3.3.2). Backup files shall not be committed to Git.

### 3.2 データの読み込み

- **REQ-3.2.1**: When the application server starts, the system shall read and expose all persisted recipes from `data/recipes.local.json`.
- **REQ-3.2.2**: The system shall not return corrupted or partially written recipe data. When the data file exists but is not a valid recipe array (malformed JSON, a non-array top level, or a record failing validation), the system shall raise a clear error rather than treating it as empty, and shall not register new recipes or overwrite the file while it is in that state (the existing file is left unchanged). Unknown/legacy fields on otherwise-valid records are still tolerated and stripped (REQ-3.3.1).

### 3.3 既存データの互換性・移行

- **REQ-3.3.1**: When existing recipes in `data/recipes.local.json` contain a legacy image attribute (e.g., `imageFilename`), the system shall continue to load and expose them without error (the legacy field is ignored by the text-only model and search).
- **REQ-3.3.2**: The system shall not delete or overwrite existing local recipe data as part of the migration to the text-only model; any migration shall be non-destructive.

---

## 4. レシピ一覧機能

- **REQ-4.1**: The system shall display all saved recipes as cards in the recipe list view.
- **REQ-4.2**: Each recipe card shall show the recipe title, category, cooking time, and difficulty. Cards shall not display an image.
- **REQ-4.3**: When a new recipe is saved through the Web form, the system shall update the recipe list without requiring a full page reload.
- **REQ-4.4**: When no recipes are saved, the system shall display an empty state message.
- **REQ-4.5**: A recipe registered through the MCP path shall be visible in the Web recipe list at least after the user reloads the page (or the list re-fetches). Automatic/live refresh for MCP-added recipes is not required; the refresh method shall be documented in the README.

---

## 5. 検索機能

### 5.1 検索ロジック

- **REQ-5.1.1**: The search logic shall be implemented as a pure function in `src/core/` that is independent of HTTP handling and file I/O.
- **REQ-5.1.2**: The system shall accept the following search parameters: `query`, `ingredients`, `categories`, `maxCookingMinutes`, `difficulty`, `cuisineTags`, `flavorTags`, `drinkPairings`, `textureTags`.
- **REQ-5.1.3**: When a search parameter is not specified, the system shall ignore that parameter and not filter on it.
- **REQ-5.1.4**: The system shall combine all specified structured conditions with AND logic.
- **REQ-5.1.4a**: The `drinkPairings` search parameter shall act as an explicit tag filter only: when specified, it matches recipes whose registered `drinkPairings` contain the given tags. It shall not be used to infer drink affinity for recipes that have no registered drink pairings. Drink-affinity inference is the responsibility of the MCP client's LLM (see Section 5.3).
- **REQ-5.1.5**: When `ingredients` contains multiple values, the system shall return only recipes containing all specified ingredients.
- **REQ-5.1.6**: When `maxCookingMinutes` is specified, the system shall return only recipes with `cookingMinutes` ≤ `maxCookingMinutes`.
- **REQ-5.1.7**: The system shall normalize strings for comparison by trimming whitespace, ignoring case differences, and applying Unicode normalization (NFKC) before any string comparison.
- **REQ-5.1.8**: When `query` is specified, the system shall search across title, ingredients, all tag fields, and notes.
- **REQ-5.1.9**: Each search result shall include information indicating why the recipe matched (matched fields).
- **REQ-5.1.10**: When no recipes match, the system shall return an empty array (not an error).
- **REQ-5.1.11**: The system shall never fabricate or generate recipe data not present in the stored data.
- **REQ-5.1.12**: The search function shall remain deterministic and pure; it shall not depend on external search services, network access, or the LLM. Its result depends only on its inputs (REQ-5.1.1, PROP-6).

### 5.2 Correctness Properties（Property-based testingで検証する性質）

- **PROP-1**: For all results when `maxCookingMinutes` is specified, `result.cookingMinutes ≤ maxCookingMinutes`.
- **PROP-2**: For all results when `ingredients` are specified, each result contains all specified ingredients.
- **PROP-3**: For all results when `categories` are specified, each result's category is one of the specified categories.
- **PROP-4**: For any search with conditions C, and C' = C ∪ {additional condition}, `results(C')` ⊆ `results(C)` (adding conditions never increases the result set).
- **PROP-5**: With empty search conditions, the system returns all stored recipes.
- **PROP-6**: Given the same recipe data and the same search conditions, the function always returns the same result (determinism).
- **PROP-7**: Every element in the search results is an element of the input recipe set (no fabrication).
- **PROP-8**: Tags that are equal after normalization (NFKC Unicode normalization + trim + lowercase) produce the same search results as each other.

### 5.3 飲み物との相性判断の責務分担

飲み物（例: シラーズ）との相性判断は、アプリケーションの検索ロジックではなく、MCPクライアント（Kiro）のLLMが担う。アプリケーションは判断材料を提供するだけで、相性そのものを計算しない。

- **REQ-5.3.1**: When a user asks for recipes matching a drink (e.g., "シラーズに合う料理"), the drink-affinity judgment shall be performed by the MCP client's LLM, not by the application's search logic.
- **REQ-5.3.2**: The recommendation flow shall first retrieve candidate recipes by structured conditions (time, ingredients, category, etc.) via `search_recipes`, and then let the LLM evaluate the drink affinity of those candidates from their title, ingredients, category, and cooking time.
- **REQ-5.3.3**: A recipe shall not be excluded from drink-affinity recommendation candidates solely because its `drinkPairings` field is empty or unregistered.
- **REQ-5.3.4**: The LLM's response shall distinguish between information that is explicitly registered in the recipe data and inferences the LLM has made, and shall explain the reason for each recommendation.
- **REQ-5.3.5**: The application shall not fabricate drink-affinity data; drink affinity that is not explicitly registered shall be presented by the LLM as an inference, not as stored data (consistent with REQ-5.1.11).
- **REQ-5.3.6**: Registration and recommendation shall not depend on the availability of external web search. If the LLM uses external information, it shall cite the source and distinguish it from inference; if external search is unavailable, the LLM may still recommend based on the retrieved recipe content, and `create_recipe` registration shall not be blocked.

---

## 6. MCP（Model Context Protocol）機能

### 6.1 MCP Server

- **REQ-6.1.1**: The system shall implement a local MCP Server using the official MCP TypeScript SDK.
- **REQ-6.1.2**: The MCP Server shall expose a tool named `search_recipes`.
- **REQ-6.1.3**: The `search_recipes` tool description shall clearly describe its purpose and each input parameter so that an MCP client can determine when to call it.
- **REQ-6.1.4**: The `search_recipes` tool shall read recipe data from the same `data/recipes.local.json` used by the Web application.
- **REQ-6.1.4a**: The `search_recipes` tool result shall include, for each matched recipe, at least the fields the LLM needs to judge drink affinity: title, ingredients, category, and cooking time (the tool returns the full recipe record, which already contains these fields).
- **REQ-6.1.5**: The MCP Server shall communicate via stdio.
- **REQ-6.1.6**: When using stdio transport, the system shall not write any non-protocol output to stdout; diagnostic logs shall use stderr.
- **REQ-6.1.7**: The system shall successfully respond to the following query from Kiro: "Recipe MCPを使って、30分以内でシラーズに合う主菜を探してください。"

### 6.2 MCP設定

- **REQ-6.2.1**: The MCP Server configuration shall be registered in Kiro IDE's Workspace MCP settings.
- **REQ-6.2.2**: The MCP configuration shall not include any secrets, API keys, or tokens.
- **REQ-6.2.3**: Auto-approval shall not be enabled for the `create_recipe` tool; the user confirmation step (REQ-6.4.4) shall be preserved so that registration always requires explicit user approval.
- **REQ-6.2.4**: The system shall treat content approval and tool-execution approval as two distinct confirmations: (1) the user approving the proposed recipe content, and (2) the MCP client (Kiro) granting permission to execute the `create_recipe` tool. Neither shall be implied by the other.

### 6.3 `create_recipe` ツール

- **REQ-6.3.1**: The MCP Server shall expose a tool named `create_recipe` that accepts a confirmed, structured (text-only) recipe and persists it.
- **REQ-6.3.2**: The `create_recipe` tool shall accept only text recipe attributes: title, category, ingredients, cookingMinutes, difficulty, and optional cuisineTags, flavorTags, drinkPairings, textureTags, notes. It shall not accept any image bytes, image file path, or image reference.
- **REQ-6.3.3**: The `create_recipe` tool shall persist by calling the API server (REQ-3.1.7); it shall not write `data/recipes.local.json` directly.
- **REQ-6.3.4**: The `create_recipe` tool shall validate its input against the shared Zod schema before persisting, and shall return a descriptive error (not fabricated data) when validation fails.
- **REQ-6.3.5**: The `create_recipe` tool shall perform no image analysis and no drink-affinity judgment; those remain the responsibility of the client LLM (REQ-5.3.1, Section 6.4).
- **REQ-6.3.6**: The `create_recipe` tool description shall instruct the client LLM to call it only after the user has explicitly confirmed the proposed recipe content (REQ-6.4.4).
- **REQ-6.3.7**: The `create_recipe` tool shall return clear, distinct errors for: invalid input (validation failure), the API server being unavailable/not running, API timeout, and a persistence failure reported by the API.
- **REQ-6.3.8**: The `create_recipe` tool's HTTP call to the API shall use a finite timeout of 5 seconds; on timeout it shall return a descriptive error and shall not hang.
- **REQ-6.3.9**: Unknown fields in a `create_recipe` / registration input shall be rejected with a descriptive validation error (strict input), distinct from the read-time tolerance of legacy fields in stored data (REQ-3.3.1).

### 6.4 LLM支援による画像ベース登録フロー

このフローはKiroのLLMが担う運用シナリオであり、アプリケーション側は検証とツールのみを提供する。画像の読み取りはLLMが行い、アプリは画像に一切触れない。

- **REQ-6.4.1**: The system shall support a flow in which the user attaches a recipe image to the Kiro chat and the Kiro LLM reads it. The image is not uploaded to, stored by, or served by the application.
- **REQ-6.4.2**: The LLM shall extract recipe attributes (e.g., title, ingredients, cooking time, category) from the attached image. The application shall not perform in-app OCR or image AI, and shall not add paid external AI APIs.
- **REQ-6.4.3**: When information is unknown or unreadable, the LLM shall not fabricate it and shall ask the user to confirm or supply it.
- **REQ-6.4.4**: The LLM shall present the proposed recipe content to the user, and shall call `create_recipe` to persist it only after the user's explicit confirmation. The LLM shall not register before confirmation.
- **REQ-6.4.5**: The LLM shall propose drink pairings with reasons; drink pairings remain optional (REQ-1.1.8) and a recipe without them is still valid (REQ-5.3.3).
- **REQ-6.4.6**: When the LLM consults external information for a suggestion, it shall cite the source and clearly distinguish it from its own inference and from registered facts (consistent with REQ-5.3.4, REQ-5.3.6).
- **REQ-6.4.7**: After registration, the same recipe data shall be retrievable both in the Web recipe list (REQ-4.5) and via `search_recipes`.

---

## 7. セキュリティ要件

- **REQ-7.1**: The system shall validate all user inputs on the server side before processing.
- **REQ-7.2**: The system shall not construct file paths directly from user-supplied input.
- **REQ-7.3**: The system shall not expose internal paths, stack traces, or error details to the browser or MCP client.
- **REQ-7.4**: The system shall not include secrets, API keys, tokens, personal information, or real user data in the Git repository.
- **REQ-7.5**: The system shall not write secrets to source code.
- **REQ-7.6**: The JSON `POST /api/recipes` endpoint shall enforce a maximum request body size of 65,536 bytes (64 KiB) and reject larger bodies with a descriptive error (413), to avoid unbounded memory use from an oversized or streamed body.
- **REQ-7.7**: The `POST /api/recipes` endpoint shall accept only an `application/json` media type (a charset parameter is allowed); any other or missing `Content-Type` shall be rejected with 415.

---

## 8. 品質・テスト要件

- **REQ-8.1**: The system shall include unit tests for the core search logic.
- **REQ-8.2**: The system shall include property-based tests that verify PROP-1 through PROP-8.
- **REQ-8.2a**: Property-based tests shall be generated or executed through Kiro IDE's Property-based testing or Spec Correctness functionality where that feature is available.
- **REQ-8.2b**: Evidence of the Kiro IDE property-based test generation or execution (e.g., generated test file path, run output) shall be recorded in `docs/kiro-university-evidence.md`.
- **REQ-8.3**: The system shall include API-level tests for the text-only recipe registration (JSON) and retrieval endpoints, including validation errors (missing title, invalid category/difficulty, non-positive cooking time).
- **REQ-8.3a**: The system shall include an integration test covering the end-to-end path: MCP `create_recipe` (persist via API, text only) → recipe appears in `GET /api/recipes` (Web list) → `search_recipes` finds it.
- **REQ-8.3b**: The system shall include a test asserting that concurrent registrations are all persisted with no lost updates (REQ-3.1.8).
- **REQ-8.3c**: The system shall include a test asserting that `create_recipe` returns a clear error when the API server is unavailable and when input is invalid (REQ-6.3.7).
- **REQ-8.4**: All TypeScript code shall pass type checking with no errors, and `npm run build` shall succeed.
- **REQ-8.5**: The search logic shall not be duplicated across the UI, API, and MCP layers; it shall be shared from `src/core/`.
- **REQ-8.6**: Kiro-generated code shall not be marked as complete without running tests.

---

## 9. 開発環境・運用要件

### 9.1 npm scripts

- **REQ-9.1.1**: The project shall provide `npm run dev` to start all services concurrently.
- **REQ-9.1.2**: The project shall provide `npm run dev:web` to start the Vite dev server.
- **REQ-9.1.3**: The project shall provide `npm run dev:server` to start the API server.
- **REQ-9.1.4**: The project shall provide `npm run dev:mcp` to start the MCP Server.
- **REQ-9.1.5**: The project shall provide `npm test` to run all tests.
- **REQ-9.1.6**: The project shall provide `npm run test:property` to run property-based tests.
- **REQ-9.1.7**: The project shall provide `npm run typecheck` to run TypeScript type checking.
- **REQ-9.1.8**: The project shall provide `npm run lint` to run the linter.
- **REQ-9.1.9**: The project shall provide `npm run build` to build the production bundle.

### 9.2 ドキュメント

- **REQ-9.2.1**: The README shall include setup, local startup, MCP registration instructions (including that `create_recipe` auto-approval is disabled), the Web list refresh method for MCP-added recipes, and a Lesson 1–7 summary table.
- **REQ-9.2.2**: A new developer shall be able to reproduce local startup and MCP connection using only the README.
- **REQ-9.2.3**: The repository shall include `docs/kiro-university-evidence.md` documenting Lesson 1–7 with actual file paths and execution results.
- **REQ-9.2.4**: The demo material (`docs/submission/demo-script.md`) shall present the flow: attach image to Kiro → LLM extracts attributes → user confirms → `create_recipe` registers → recipe appears in the Web list → `search_recipes` finds it → LLM explains drink affinity (distinguishing registered facts from inference).

### 9.3 Git管理

- **REQ-9.3.1**: The `.kiro/` directory shall be included in Git tracking.
- **REQ-9.3.2**: The runtime `data/recipes.local.json` shall not be committed; only `data/recipes.json` shall be committed.
- **REQ-9.3.3**: The `.env` file and any secrets shall not be committed.
- **REQ-9.3.4**: The `.gitignore` shall explicitly exclude: `data/recipes.local.json`, `.env`, `.env.*`, and any files containing secrets or tokens.
- **REQ-9.3.5**: The `.gitignore` shall ensure `data/recipes.json` and the `.kiro/` directory remain trackable (i.e., not excluded).
- **REQ-9.3.6**: The repository shall not commit personal information or real user data (REQ-7.4).

### 9.4 Lesson 5: Powers

- **REQ-9.4.1**: When Postman Power is available in Kiro IDE, it shall be used to validate the API (not merely installed).
- **REQ-9.4.2**: The API validation result (e.g., Postman Collection JSON) shall be saved under `docs/postman/recipe-shelf.postman_collection.json`.
- **REQ-9.4.3**: When Postman Power is not available, an alternative Power related to React, TypeScript, Node.js, or API validation shall be selected, and the reason for selection shall be documented in `docs/kiro-university-evidence.md`.
- **REQ-9.4.4**: In all cases, the selected Power shall be actively used in a development or validation task, and the result or artifact shall be recorded.

### 9.5 Lesson 7: Custom Agent

- **REQ-9.5.1**: The custom agent `recipe-quality-reviewer` shall be created in `.kiro/agents/`.
- **REQ-9.5.2**: The agent shall be executed against the completed project.
- **REQ-9.5.3**: Each finding from the agent execution shall be recorded with a decision: fixed, accepted with rationale, or deferred.
- **REQ-9.5.4**: The execution result, findings, and resolutions shall be saved to `docs/reviews/recipe-quality-review.md`.

---

## 10. Kiro University Challenge Lesson対応

| Lesson | 機能 | 対応要件 |
|--------|------|---------|
| 1 | Spec-driven development | 本ドキュメント + design.md + tasks.md |
| 2 | Steering documents | `.kiro/steering/` のSteering files |
| 3 | Hooks | `.kiro/hooks/` のHook（core/*.ts保存時にテスト実行） |
| 4 | Property-based testing | PROP-1〜PROP-8, REQ-8.2 |
| 5 | Powers | 利用可能なPowerの実際の使用（Postman Power優先）。APIバリデーション結果を `docs/postman/` または `docs/kiro-university-evidence.md` に記録 |
| 6 | Model Context Protocol | REQ-6.1.1〜6.4.7（`search_recipes` + `create_recipe`） |
| 7 | Custom agents | `recipe-quality-reviewer` Agent — 実行・指摘記録・修正まで完了。結果は `docs/reviews/recipe-quality-review.md` に保存 |

---

## 11. MVPスコープ外（追加候補）

次の機能はMVP完成後の追加候補であり、本要件には含まない。

- アプリ内での画像保存・配信・表示、画像アップロード機能
- 元画像とレシピの関連付け（画像の保管とひも付け）
- アプリ内のOCR・画像AI・自動属性抽出（抽出はKiroのLLMが担う）
- ベクトル/意味検索
- ログインとユーザー管理
- AWSなどへのデプロイ
- 外部データベース・クラウドストレージ
- 複数ユーザー・複数APIプロセスの同時更新
- iPhone/iPadの共有シートからレシピ画像を送信し、LLMが自動で整理・登録する連携（将来構想）
- 登録済みレシピを元画像と一緒に閲覧する機能（元画像の保管・ひも付けを伴うため、本MVPの画像レス方針の外）
