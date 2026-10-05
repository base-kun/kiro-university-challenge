# Design Document

## Overview

Recipe Shelf MCP is a locally-run web application that lets users register recipes as text-only structured attributes, then query them from Kiro or any MCP client via a `search_recipes` tool. Recipes can be registered two ways: (1) directly through the Web text form, or (2) through an LLM-assisted flow where the user attaches a recipe image to the Kiro chat, the Kiro LLM reads attributes from the image, confirms them with the user, and persists via the `create_recipe` MCP tool. The system consists of three runtimes:

1. **Vite + React client** — text-only recipe registration form and card list (no image upload, no image display)
2. **Node.js HTTP API server** — recipe validation and persistence (the single writer); accepts text-only JSON
3. **MCP stdio server** — exposes `search_recipes` (read) and `create_recipe` (write-via-API) to AI clients

The application, API, and MCP server never accept, store, serve, or display images. Image reading and drink-affinity judgment are performed by the client LLM, not by the application (REQ-2.1–2.4). All search logic lives in a shared pure-function module (`src/core/`) consumed by both the API and the MCP server. The MCP server never writes `data/recipes.local.json` directly: `create_recipe` persists by calling the API server, keeping the API the single writer (REQ-3.1.7) with serialized writes (REQ-3.1.8).

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (Vite + React)                             │
│  ┌─────────────┐   ┌───────────────────────────┐   │
│  │ RecipeForm  │   │ RecipeList (card grid)    │   │
│  │ (text only) │   │ (text-only cards)         │   │
│  └──────┬──────┘   └───────────┬───────────────┘   │
│   JSON POST /api/recipes       │ GET /api/recipes   │
└─────────┼──────────────────────┼───────────────────┘
          │                      │
┌─────────▼──────────────────────▼───────────────────┐
│  Node.js HTTP API (src/server/)  ── single writer   │
│  POST /api/recipes   (application/json, text only)  │
│  GET  /api/recipes                                  │
│         │   serialized writes (write queue)         │
│  ┌──────▼──────────────────────────────────┐       │
│  │  src/core/ (shared)                     │       │
│  │  ├── recipe.ts / recipeSchema.ts        │       │
│  │  └── searchRecipes.ts (pure function)   │       │
│  └──────┬──────────────────────────────────┘       │
│         │ read / atomic write (API only)            │
│  data/recipes.local.json                                  │
└───▲─────┴───────────────────────────▲──────────────┘
    │ reads data/recipes.local.json          │ HTTP POST /api/recipes (JSON)
    │ (search_recipes, read-only)      │ (create_recipe → persist via API)
┌───┴──────────────────────────────────┴─────────────┐
│  MCP stdio server (src/mcp/recipeMcpServer.ts)     │
│  tools: search_recipes (read), create_recipe (write)│
│  (no image handling)                                │
└────────────────────────────────────────────────────┘
          ▲
          │ MCP stdio   (LLM: reads attached image, affinity, confirm)
┌─────────┴──────────────────────────────────────────┐
│  Kiro IDE / any MCP client                        │
│  (user attaches recipe image here; image stays here)│
└────────────────────────────────────────────────────┘
```

Registration data flow (LLM-assisted path): the user attaches a recipe image to
the Kiro chat; the Kiro LLM reads attributes from the image, asks about anything
unclear, proposes drink pairings with reasons, and shows the proposed recipe.
After the user explicitly confirms, the LLM calls `create_recipe({ ...text fields })`
(no image). The MCP server forwards this to the API's `POST /api/recipes` (JSON);
the API validates, serializes the write, and persists. The recipe then appears
via `GET /api/recipes` (Web list, after reload) and `search_recipes`. The image
never leaves the Kiro chat and is not stored by the application.

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 18 + TypeScript | Component model fits card list + form; no extra framework needed |
| Build tool | Vite 5 | Fast HMR; minimal config for single-page app |
| API server | Node.js built-in `http` + TypeScript | No framework needed at this scale; keeps dependencies minimal. Accepts text-only JSON (no file upload). |
| Validation | Zod | Runtime + compile-time type safety from a single schema definition |
| MCP server | `@modelcontextprotocol/sdk` | Official SDK; handles stdio framing automatically |
| Tests | Vitest | Native ESM + TypeScript; works with Vite config |
| Property-based tests | `fast-check` | Mature PBT library for TypeScript; integrates with Vitest |
| Concurrency | `concurrently` | Run web/server/mcp in parallel with one `npm run dev` |

---

## Repository Structure

```
/
├── .kiro/
│   ├── specs/recipe-shelf/
│   │   ├── requirements.md
│   │   ├── design.md
│   │   └── tasks.md
│   ├── steering/
│   │   └── project-standards.md
│   ├── hooks/
│   │   └── core-test-on-save.json
│   └── agents/
│       └── recipe-quality-reviewer.md
├── src/
│   ├── client/
│   │   ├── components/
│   │   │   ├── RecipeForm.tsx
│   │   │   ├── RecipeCard.tsx
│   │   │   └── RecipeList.tsx
│   │   ├── pages/
│   │   │   └── App.tsx
│   │   ├── styles/
│   │   │   └── index.css
│   │   └── main.tsx
│   ├── server/
│   │   ├── routes/
│   │   │   └── recipes.ts
│   │   ├── storage/
│   │   │   └── recipeStore.ts
│   │   └── index.ts
│   │   (no upload/ — the system does not handle images)
│   ├── core/
│   │   ├── recipe.ts
│   │   ├── recipeSchema.ts
│   │   └── searchRecipes.ts
│   └── mcp/
│       └── recipeMcpServer.ts
├── tests/
│   ├── unit/
│   │   └── searchRecipes.test.ts
│   ├── property/
│   │   └── searchRecipes.property.test.ts
│   ├── api/
│   │   └── recipes.api.test.ts
│   └── integration/
│       └── registerFlow.test.ts
├── data/
│   ├── recipes.json
│   └── recipes.json          ← runtime only, git-ignored
│   (no uploads/ — the system does not handle images)
├── docs/
│   ├── kiro-university-evidence.md
│   ├── postman/
│   │   └── recipe-shelf.postman_collection.json
│   ├── reviews/
│   │   └── recipe-quality-review.md
│   └── submission/
│       ├── demo-script.md
│       ├── social-post.md
│       └── form-responses.md
├── .gitignore
├── .nvmrc
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
└── README.md
```

---

## Data Model

```typescript
// src/core/recipe.ts

export type RecipeCategory =
  | '主菜' | '副菜' | '前菜' | '主食' | 'スープ' | 'デザート';

export type RecipeDifficulty = 'easy' | 'medium' | 'hard';

export interface Recipe {
  id: string;                  // uuid v4 (server-generated)
  title: string;               // required, non-empty
  category: RecipeCategory;
  ingredients: string[];       // split from comma-separated input
  cookingMinutes: number;      // integer ≥ 1
  difficulty: RecipeDifficulty;
  cuisineTags: string[];
  flavorTags: string[];
  drinkPairings: string[];
  textureTags: string[];
  notes: string;               // optional, default ""
  createdAt: string;           // ISO 8601 (server-generated)
}
```

The recipe is text-only — it has no image or image-reference field (REQ-2.1, REQ-2.4).

Zod schema in `src/core/recipeSchema.ts` mirrors this type and is used for both API input validation and MCP input validation.

**Legacy compatibility:** existing `data/recipes.local.json` records may carry a legacy `imageFilename` field from the previous MVP. The loader shall tolerate and ignore unknown/legacy fields rather than failing (REQ-3.3.1); migration is non-destructive and must not delete existing data (REQ-3.3.2).

---

## API Design

Base URL: `http://localhost:3001`

The API accepts and returns text only. There is no image upload endpoint and no static image serving (REQ-2.1).

### `POST /api/recipes`

Accepts `application/json` only (text attributes). The `Content-Type` media type
must be `application/json`; a charset parameter (e.g. `application/json; charset=utf-8`)
is allowed. Any other media type, or a missing `Content-Type`, is rejected with
415. Used by both the Web form and the MCP `create_recipe` tool. Shape:

```json
{
  "title": "...",
  "category": "主菜",
  "ingredients": ["牛肉", "玉ねぎ"],
  "cookingMinutes": 25,
  "difficulty": "medium",
  "cuisineTags": [],
  "flavorTags": [],
  "drinkPairings": [],
  "textureTags": [],
  "notes": ""
}
```

**Request fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | Non-empty |
| `category` | string | yes | One of the 6 valid values |
| `ingredients` | string[] | yes | Array of strings |
| `cookingMinutes` | number | yes | Integer ≥ 1 |
| `difficulty` | string | yes | easy / medium / hard |
| `cuisineTags` | string[] | no | Defaults to `[]` |
| `flavorTags` | string[] | no | Defaults to `[]` |
| `drinkPairings` | string[] | no | Defaults to `[]` |
| `textureTags` | string[] | no | Defaults to `[]` |
| `notes` | string | no | Defaults to `""` |

The body is validated by the shared `RecipeInputSchema` with a **strict** policy:
unknown fields (including any image-related field) are rejected with a 400
(REQ-6.3.9). The endpoint enforces a **maximum request body size** (e.g. 64 KB);
larger bodies (> 65,536 bytes) are rejected with 413 before parsing (REQ-7.6). The server
generates `id` and `createdAt` and persists through the single-writer, serialized
`addRecipe`.

Note the asymmetry: input validation is strict (reject unknown fields), while
loading persisted data is tolerant (legacy fields such as `imageFilename` are
ignored/stripped, REQ-3.3.1). These are deliberately different policies.

**Response `201`:**
```json
{ "recipe": { /* Recipe object */ } }
```

**Response `400`:**
```json
{ "error": "descriptive message" }
```

**Response `500`:**
```json
{ "error": "Internal server error" }
```

---

### `GET /api/recipes`

Returns all stored recipes.

**Response `200`:**
```json
{ "recipes": [ /* Recipe[] */ ] }
```

There is no `GET /uploads/:filename` route and no image upload pipeline: the system does not accept, store, or serve images (REQ-2.1). Image reading happens entirely in the Kiro LLM on the chat-attached image, which never reaches the application.

---

## Persistence Layer

**File:** `data/recipes.local.json` (JSON array of `Recipe`)

### MVP concurrency model

This is a local single-user MVP. The concurrency model is deliberately simple:

- The **API server is the only writer** to `data/recipes.local.json` (REQ-3.1.7).
- All writes within the API process are **serialized through a single in-process write queue** so that concurrent registrations — whether from the Web form or forwarded from MCP `create_recipe` — are applied one at a time and cannot lose updates (REQ-3.1.8). Each queued operation performs load → append → atomic save.
- The queue is **failure-isolating**: if one operation rejects, the rejection is confined to that operation's caller and the chain continues processing subsequent writes (REQ-3.1.9). The queue is implemented so a rejected promise does not permanently break the chain (e.g. the tail advances in a `finally`). Before rewriting the data file, the prior contents can be backed up (timestamped, git-ignored) so a failed rewrite does not lose existing recipes (REQ-3.1.10, REQ-3.3.2).
- The **MCP server does not write the data file directly.** `search_recipes` reads `data/recipes.local.json` fresh on each call (read-only). `create_recipe` performs its write by calling the API's `POST /api/recipes` (text-only JSON), so the write still goes through the single API writer and its serialization.
- The **persistence implementation is shared** (`src/server/storage/recipeStore.ts`) rather than duplicated across layers (REQ-3.1.6).
- Multi-process concurrent writes (e.g., two API server instances writing simultaneously) are **out of scope** for this MVP.

This means the atomic rename below, combined with the in-process write queue, protects against both interrupted writes and lost updates from simultaneous same-process registrations. It is not designed to handle multiple API server processes writing the same file.

### Atomic Write

```typescript
// recipeStore.ts
async function saveRecipes(recipes: Recipe[]): Promise<void> {
  const tmpPath = DATA_FILE + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(recipes, null, 2), 'utf8');
  await fs.rename(tmpPath, DATA_FILE);  // atomic on same filesystem
}
```

### Initialization

```typescript
async function loadRecipes(): Promise<Recipe[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw) as Recipe[];
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}
```

---

## Search Logic

**File:** `src/core/searchRecipes.ts`

This is a pure function — no imports from `fs`, `http`, or any I/O module.

```typescript
export interface SearchParams {
  query?: string;
  ingredients?: string[];
  categories?: RecipeCategory[];
  maxCookingMinutes?: number;
  difficulty?: RecipeDifficulty;
  cuisineTags?: string[];
  flavorTags?: string[];
  drinkPairings?: string[];
  textureTags?: string[];
}

export interface SearchResult {
  recipe: Recipe;
  matchedFields: string[];
}

export function searchRecipes(
  recipes: Recipe[],
  params: SearchParams
): SearchResult[]
```

### Normalization helper

```typescript
function normalize(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase();
}
```

Applied to every string before comparison (REQ-5.1.7, PROP-8).

### Filter pipeline (all conditions ANDed)

1. `maxCookingMinutes` — `recipe.cookingMinutes <= params.maxCookingMinutes`
2. `categories` — `params.categories.includes(recipe.category)` (normalized)
3. `difficulty` — exact match after normalization
4. `ingredients` — every ingredient in `params.ingredients` matches at least one element of `recipe.ingredients` (normalized substring match)
5. `cuisineTags` / `flavorTags` / `drinkPairings` / `textureTags` — every specified tag matches at least one element of the recipe's corresponding array (normalized)
6. `query` — at least one of: title, notes, ingredients, cuisineTags, flavorTags, drinkPairings, textureTags contains the normalized query as a substring

---

## Correctness Properties

These properties are verified by property-based tests in `tests/property/searchRecipes.property.test.ts` using `fast-check`.

Property 1: maxCookingMinutes upper bound
For all results when `maxCookingMinutes` is specified, every result's `cookingMinutes` is ≤ the specified value.
fast-check strategy: `fc.integer({ min: 1, max: 120 })` for N; arbitrary recipe pool generated with `fc.array(recipeArbitrary)`.
**Validates: Requirements 5.1.6**

Property 2: ingredients containment
For all results when `ingredients` is specified, every result contains all specified ingredients (after normalization).
fast-check strategy: `fc.array(fc.string({ minLength: 1 }))` for the ingredient filter list; recipes generated to include a superset.
**Validates: Requirements 5.1.5**

Property 3: category membership
For all results when `categories` is specified, every result's `category` is one of the specified categories.
fast-check strategy: `fc.subarray(CATEGORIES, { minLength: 1 })` to pick a non-empty subset of valid categories.
**Validates: Requirements 5.1.4**

Property 4: monotone restriction (adding conditions cannot increase the result set)
For any search with condition set C and C' = C ∪ {one additional condition}, `results(C')` ⊆ `results(C)`.
fast-check strategy: generate base params, then generate one extra condition to add; assert result IDs of C' are a subset of C's result IDs.
**Validates: Requirements 5.1.4**

Property 5: empty params returns all recipes
With empty search conditions `{}`, the function returns all stored recipes.
fast-check strategy: `fc.array(recipeArbitrary, { minLength: 0, maxLength: 20 })` as the recipe pool; assert output length equals input length.
**Validates: Requirements 5.1.3**

Property 6: determinism
Given the same recipe data and the same search conditions, calling `searchRecipes` twice returns identical results.
fast-check strategy: generate one (data, params) pair; call twice; compare result arrays by ID and order.
**Validates: Requirements 5.1.1**

Property 7: no fabrication
Every element in the search results is present in the input recipe set.
fast-check strategy: compare each result's `id` against the set of input recipe IDs; assert no unknown IDs.
**Validates: Requirements 5.1.11**

Property 8: normalization equivalence
Tags that are equal after NFKC + trim + toLowerCase normalization produce the same search results.
fast-check strategy: generate a tag string, then produce a variant with extra surrounding spaces and mixed case; assert both produce identical result sets.
**Validates: Requirements 5.1.7**


---

## MCP Server Design

**File:** `src/mcp/recipeMcpServer.ts`

Transport: `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio`

Tool: `search_recipes`

```typescript
{
  name: 'search_recipes',
  description: `Search locally stored recipes by conditions.
Use this tool when the user asks to find recipes matching criteria such as
cooking time, ingredients, drink pairings, cuisine style, or flavor.

Parameters:
- query: Free-text substring matched against title, ingredients, tags, and notes.
- ingredients: All listed ingredients must be present in the recipe.
- categories: Recipe category must be one of the specified values (主菜, 副菜, 前菜, 主食, スープ, デザート).
- maxCookingMinutes: Recipes requiring more than this many minutes are excluded.
- difficulty: easy | medium | hard.
- cuisineTags: All specified cuisine styles must match (e.g. 和食, 洋食).
- flavorTags: All specified flavor tags must match (e.g. 辛い, さっぱり).
- drinkPairings: Explicit tag filter. When specified, matches only recipes whose REGISTERED drink pairings contain these tags (e.g. シラーズ, ビール). Do NOT use this to find recipes that merely "go well with" a drink — leave it empty and judge affinity yourself from the returned title, ingredients, category, and cooking time.
- textureTags: All specified texture tags must match.

Unspecified parameters are ignored. All conditions are combined with AND.
Returns an empty array when no recipes match — never fabricates data.

Drink-affinity note for the client LLM: this tool does not compute how well a
recipe pairs with a drink. To answer "what goes well with シラーズ", retrieve
candidates by structured conditions (e.g. category, maxCookingMinutes), then
judge affinity yourself from each recipe's title, ingredients, category, and
cooking time. Clearly separate registered facts from your own inference, and
explain the reason for each recommendation.`,
  inputSchema: { /* Zod-derived JSON Schema */ }
}
```

Tool: `create_recipe`

```typescript
{
  name: 'create_recipe',
  description: `Persist a confirmed, text-only recipe to the local store.

Call this ONLY after you have shown the full proposed recipe to the user and the
user has explicitly confirmed it. If something read from the image is unknown or
unreadable, ask the user first — never fabricate. drinkPairings is optional.

This tool takes TEXT attributes only. Do NOT pass any image, image bytes, file
path, or image id — the application does not handle images. You (the LLM) read
the attached image yourself; only the extracted text fields are registered.

On success the recipe is saved via the API server and will appear in the Web
list (after reload) and in search_recipes.`,
  inputSchema: { /* Zod-derived from RecipeInputSchema (text only): title, category,
     ingredients[], cookingMinutes, difficulty, cuisineTags[], flavorTags[],
     drinkPairings[], textureTags[], notes */ }
}
```

`create_recipe` behavior:

1. Validate input (text only) against the shared Zod schema (`RecipeInputSchema`) (REQ-6.3.4). On failure, return a descriptive validation error.
2. POST the recipe as JSON to the API server's `POST /api/recipes` (REQ-6.3.3). The API assigns `id`/`createdAt` and persists through the shared single-writer, serialized path. No image is involved.
3. Return the created recipe (or a descriptive error) as JSON text content. It performs no image analysis and no affinity judgment (REQ-6.3.5).

`create_recipe` returns clear, distinct errors for invalid input, API-unavailable, API timeout, and persistence failure (REQ-6.3.7). The HTTP call uses a **finite 5-second timeout** (`AbortController`); on timeout it returns a descriptive "API did not respond" error and does not hang (REQ-6.3.8). The API base URL is read from an environment variable (e.g. `RECIPE_API_BASE_URL`, default `http://localhost:3001`) in the MCP config env — never a hardcoded secret (REQ-6.2.2).

Two distinct approvals gate a registration (REQ-6.2.3, REQ-6.2.4): (1) the user approves the proposed recipe **content**, and (2) the MCP client (Kiro) grants permission to **execute** the `create_recipe` tool. `create_recipe` is not in `autoApprove`, so neither approval is implied by the other.

All diagnostic output goes to `stderr`. No non-protocol text is written to `stdout` (REQ-6.1.6).

`search_recipes` reads `data/recipes.local.json` on each tool call (no in-process cache) so it always reflects the latest state written by the API server. `create_recipe` does not read or write the data file directly; it writes only via the API (REQ-3.1.7).

### Division of responsibility: drink affinity (REQ-5.3.1–5.3.5)

Drink-affinity judgment is deliberately kept out of the pure search function and
placed in the MCP client's LLM:

- **Application (`searchRecipes` + MCP)** — retrieves candidate recipes by
  explicit structured conditions and returns the full recipe records (title,
  ingredients, category, cooking time, and any registered tags). `drinkPairings`
  remains an explicit tag filter (REQ-5.1.4a) and is unchanged. The pure
  function and all 8 Correctness Properties are preserved as-is.
- **Client LLM (Kiro)** — reasons about affinity from the returned recipe
  content. A recipe with an empty `drinkPairings` field is still a valid
  candidate (REQ-5.3.3). The LLM must distinguish registered facts from
  inference and explain each recommendation (REQ-5.3.4).

Recommended flow for a query like "シラーズに合う30分以内の主菜":
`search_recipes({ categories: ["主菜"], maxCookingMinutes: 30 })` →
LLM inspects titles/ingredients → LLM recommends with reasons, marking which
parts are registered vs. inferred. The LLM may optionally add
`drinkPairings: ["シラーズ"]` only when the user explicitly wants recipes that
already have that tag registered.

---

## Error Handling

| Scenario | HTTP status | Client sees | Server logs |
|----------|-------------|-------------|-------------|
| Missing required field (e.g. title) | 400 | `{ "error": "title is required" }` | info |
| Invalid category/difficulty | 400 | `{ "error": "invalid category: ..." }` | info |
| cookingMinutes not a positive integer | 400 | `{ "error": "cookingMinutes must be a positive integer" }` | info |
| Non-JSON Content-Type (or missing) | 415 | `{ "error": "Content-Type must be application/json" }` | info |
| Malformed JSON body | 400 | `{ "error": "invalid JSON body" }` | info |
| Unknown field in body | 400 | `{ "error": "unexpected field: ..." }` | info |
| Request body too large (> 65,536 bytes) | 413 | `{ "error": "request body too large" }` | info |
| Corrupt data file on read (non-array / invalid record) | 500 | `{ "error": "Internal server error" }` | error to stderr; **no write/overwrite performed** |
| JSON parse error on startup | 500 | `{ "error": "Internal server error" }` | error + stack to stderr |
| Unexpected error | 500 | `{ "error": "Internal server error" }` | error + stack to stderr |

MCP `create_recipe` error cases (REQ-6.3.7):

| Scenario | `create_recipe` returns |
|----------|-------------------------|
| Invalid input (schema validation fails) | descriptive validation error (does not call API) |
| API server not running / unreachable | descriptive "API unavailable — start the API server" error |
| API call exceeds the finite timeout | descriptive "API did not respond (timeout)" error (REQ-6.3.8) |
| API returns 4xx/5xx | surfaces the API's error message |

There is no image-related error path (no size limit, MIME, or magic-bytes checks), since the system does not handle images.

Internal paths and stack traces are never sent to the browser or MCP client (REQ-7.3).

---

## Security Design

| Risk | Mitigation |
|------|-----------|
| No image attack surface | The system does not accept, store, or serve images; there is no upload endpoint, static file route, filename handling, or image-path construction (REQ-2.1) |
| Input validation (server-side) | All recipe input validated by the shared Zod schema before persisting (REQ-7.1) |
| Lost update on concurrent register | Single API writer + in-process serialized write queue (REQ-3.1.8) |
| Secret leakage | No `.env` in repo; no secrets in source; `.gitignore` covers `data/recipes.local.json`; MCP `create_recipe` reads only a non-secret API base URL from env |
| Stack trace exposure | All unhandled errors caught; only generic message sent to client (REQ-7.3) |

---

## TypeScript Configuration

Two tsconfig files:

- `tsconfig.json` — client (DOM lib, `"moduleResolution": "bundler"`, Vite)
- `tsconfig.server.json` — server + MCP + core (Node lib, `"moduleResolution": "node16"`, `"module": "node16"`)

Both extend a shared base and use `"strict": true`.

---

## npm Scripts

```json
{
  "dev": "concurrently \"npm run dev:web\" \"npm run dev:server\" \"npm run dev:mcp\"",
  "dev:web": "vite",
  "dev:server": "node --import tsx/esm src/server/index.ts",
  "dev:mcp": "node --import tsx/esm src/mcp/recipeMcpServer.ts",
  "build": "tsc -p tsconfig.server.json && vite build",
  "test": "vitest run",
  "test:property": "vitest run tests/property",
  "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.server.json --noEmit",
  "lint": "eslint src tests --ext .ts,.tsx"
}
```

---

## Kiro University Lesson Integration

| Lesson | Integration point | Location |
|--------|------------------|----------|
| 1 — Spec | This document + requirements.md + tasks.md | `.kiro/specs/recipe-shelf/` |
| 2 — Steering | Project standards steering file | `.kiro/steering/project-standards.md` |
| 3 — Hooks | PostFileSave hook on `src/core/**/*.ts` runs `vitest run tests/unit` | `.kiro/hooks/core-test-on-save.json` |
| 4 — PBT | `fast-check` property tests; generated/run via Kiro Spec Correctness | `tests/property/searchRecipes.property.test.ts` |
| 5 — Powers | Postman Power (if available) used to validate API; Collection saved | `docs/postman/recipe-shelf.postman_collection.json` |
| 6 — MCP | `search_recipes` tool; registered in Kiro Workspace MCP settings | `src/mcp/recipeMcpServer.ts` |
| 7 — Custom Agent | `recipe-quality-reviewer` agent; executed and results recorded | `.kiro/agents/recipe-quality-reviewer.md` |

---

## Components and Interfaces

### src/core/recipe.ts
Exports: `Recipe`, `RecipeCategory`, `RecipeDifficulty`
No runtime dependencies. Pure type definitions.

### src/core/recipeSchema.ts
Exports: `RecipeSchema` (Zod), `SearchParamsSchema` (Zod), and a new `RecipeInputSchema` (Zod) for text-only JSON/MCP registration (fields: `title`, `category`, `ingredients[]`, `cookingMinutes`, `difficulty`, optional tag arrays, `notes` — no image field); inferred types `RecipeInput`, `SearchParams`, `RecipeRegistrationInput`
Depends on: `zod`, `src/core/recipe.ts`
Note: `RecipeInputSchema` is the single shared schema used by both the API's JSON path and the MCP `create_recipe` tool (no duplicated validation). The persisted `Recipe` type drops the legacy `imageFilename` field.

### src/core/searchRecipes.ts
Exports: `searchRecipes(recipes: Recipe[], params: SearchParams): SearchResult[]`, `SearchResult`
Depends on: `src/core/recipe.ts`, `src/core/recipeSchema.ts`
No I/O imports. Pure function.

### src/server/storage/recipeStore.ts
Exports: `loadRecipes(): Promise<Recipe[]>`, `saveRecipes(r: Recipe[]): Promise<void>`, `addRecipe(r: Recipe): Promise<Recipe>`
Depends on: `node:fs/promises`, `src/core/recipe.ts`
Change: `addRecipe` is routed through a module-level **serial write queue** (a promise chain) so concurrent calls apply one at a time (REQ-3.1.8). This is the single shared persistence path for both Web and MCP registrations (REQ-3.1.6).

### src/server/upload/imageHandler.ts — REMOVED
This module and the `src/server/upload/` directory are removed. The system no longer handles image uploads, so `busboy` and the magic-bytes/size pipeline are gone.

### src/server/routes/recipes.ts
Exports: `handleRecipes(req, res): Promise<boolean>`
Routes: `POST /api/recipes` (`application/json`, text only), `GET /api/recipes`. No `POST /api/uploads` and no `GET /uploads/:filename`.
Change: parses the JSON body, validates with `RecipeInputSchema`, then `addRecipe`. No image/`imageId` handling.
Depends on: `recipeStore`, `recipeSchema`, `searchRecipes`

### src/server/index.ts
Entry point for the HTTP server. Wires routes and CORS headers (no static file serving).
Listens on `PORT` env var (default `3001`).

### src/mcp/recipeMcpServer.ts
Entry point for the MCP stdio server. Registers `search_recipes` (read, unchanged) and `create_recipe` (write-via-API).
Exports nothing (side-effect: starts server).
`create_recipe` validates with `RecipeInputSchema` (strict: unknown fields rejected) then performs `fetch(POST ${RECIPE_API_BASE_URL}/api/recipes)` with a JSON body under a finite timeout (`AbortController`). It does **not** import `recipeStore` for writing (write goes through the API). It is not auto-approved; content approval and tool-run approval are separate (REQ-6.2.3, REQ-6.2.4).
Depends on: `@modelcontextprotocol/sdk`, `searchRecipes`, `recipeSchema`, `recipeStore` (read-only, for `search_recipes`), and the global `fetch` (for `create_recipe`).
Env: `RECIPE_API_BASE_URL` (default `http://localhost:3001`), `RECIPES_DATA_FILE` (for `search_recipes` reads).

### src/client/components/RecipeForm.tsx
Props: `onSuccess: (recipe: Recipe) => void`
State: text form fields, submitting, error (no image file, no preview). Submits `application/json` to `POST /api/recipes`.

### src/client/components/RecipeCard.tsx
Props: `recipe: Recipe`
Renders: title, category, cookingMinutes, difficulty badge (no image thumbnail).

### src/client/components/RecipeList.tsx
Props: `recipes: Recipe[]`
Renders: grid of RecipeCard; empty state when `recipes.length === 0`

### src/client/pages/App.tsx
State: `recipes: Recipe[]`
Fetches list on mount; appends new recipe from form `onSuccess`. The README documents reloading to see MCP-added recipes (no live refresh required, REQ-4.5).

---

## Data Models

### Recipe (runtime)
```typescript
interface Recipe {
  id: string;            // uuid v4 (server-generated)
  title: string;
  category: RecipeCategory;
  ingredients: string[];
  cookingMinutes: number;
  difficulty: RecipeDifficulty;
  cuisineTags: string[];
  flavorTags: string[];
  drinkPairings: string[];
  textureTags: string[];
  notes: string;
  createdAt: string;     // ISO 8601 (server-generated)
}
```
Text-only; no image field. Legacy `imageFilename` in old data is ignored on load (REQ-3.3.1).

### SearchParams (MCP + API input)
```typescript
interface SearchParams {
  query?: string;
  ingredients?: string[];
  categories?: RecipeCategory[];
  maxCookingMinutes?: number;
  difficulty?: RecipeDifficulty;
  cuisineTags?: string[];
  flavorTags?: string[];
  drinkPairings?: string[];
  textureTags?: string[];
}
```

### SearchResult (function output)
```typescript
interface SearchResult {
  recipe: Recipe;
  matchedFields: string[];  // e.g. ["drinkPairings", "category"]
}
```

### RecipeRegistrationInput (JSON / MCP `create_recipe` input)
```typescript
interface RecipeRegistrationInput {
  title: string;
  category: RecipeCategory;
  ingredients: string[];
  cookingMinutes: number;     // integer >= 1
  difficulty: RecipeDifficulty;
  cuisineTags?: string[];
  flavorTags?: string[];
  drinkPairings?: string[];   // optional
  textureTags?: string[];
  notes?: string;
}
```
Text only; no image field. The server assigns `id` and `createdAt`. Validated by
the shared `RecipeInputSchema`.

### data/recipes.local.json (persistence)
A JSON array of `Recipe` objects. Initialized to `[]` when file does not exist.

---

## Testing Strategy

### Unit tests — `tests/unit/searchRecipes.test.ts`
Vitest. Cover each filter type individually plus combination cases. Fixed recipe fixtures. Fast, no I/O.

### Property-based tests — `tests/property/searchRecipes.property.test.ts`
Vitest + fast-check. Verify all 8 Correctness Properties with generated inputs. Run via `npm run test:property`. Also run through Kiro IDE Spec Correctness feature (Lesson 4 evidence).

### API tests — `tests/api/recipes.api.test.ts`
Vitest. Start real HTTP server on random port. Test `POST /api/recipes` (JSON): happy path (201); validation errors — missing title, invalid category/difficulty, non-positive `cookingMinutes`, malformed JSON (each 400); unknown field rejected (400); oversized body rejected (413). Test `GET /api/recipes`. Uses an isolated data dir per test run. No image/upload tests (feature removed).

### Integration test — `tests/integration/registerFlow.test.ts`
Vitest. Starts the real API server; simulates the MCP `create_recipe` persistence path by calling the API as the MCP tool would (text-only JSON). Covers the end-to-end flow (REQ-8.3a): `create_recipe` → recipe present in `GET /api/recipes` → `searchRecipes` over the loaded data finds it. Also asserts: single-writer serialization — concurrent registrations are all persisted with no lost updates (REQ-8.3b); queue recovery — after one write fails, a subsequent registration still persists (REQ-3.1.9); and that `create_recipe` returns a clear error on invalid input, when the API is unavailable, and on API timeout (REQ-8.3c, REQ-6.3.8).

### Type checking
`npm run typecheck` runs `tsc --noEmit` on both tsconfig files. Must pass before any task is marked complete.
