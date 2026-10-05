---
inclusion: always
---

# Recipe Shelf MCP — Project Standards (persistent rules)

These rules apply to every interaction in this workspace (`inclusion: always`).
They are derived from the current Spec and code, not from memory. The
authoritative sources are referenced below; when in doubt, read them.

- Requirements: #[[file:.kiro/specs/recipe-shelf/requirements.md]]
- Design: #[[file:.kiro/specs/recipe-shelf/design.md]]
- Tasks: #[[file:.kiro/specs/recipe-shelf/tasks.md]]

## Product purpose

Recipe Shelf MCP is a locally-run app for registering recipes as **text-only**
structured attributes and searching/recommending them from Kiro (or any MCP
client). Two registration paths:

1. Web form — manual text entry.
2. LLM-assisted — the user attaches a recipe image to the Kiro chat; the Kiro
   LLM reads attributes from the image, confirms with the user, and (after
   explicit approval) persists text via the `create_recipe` MCP tool.

The application, API, and MCP server never accept, store, serve, or display
images. Image reading is done only by the Kiro LLM on the chat-attached image.

## Technology stack

- Language: TypeScript (strict). Node.js built-in `http` for the API (no web
  framework). React 18 + Vite 5 for the client.
- Validation: Zod (single shared schema module in `src/core/`).
- MCP: official `@modelcontextprotocol/sdk`, stdio transport.
- Tests: Vitest; property-based tests with `fast-check`.
- Lint: ESLint. Scripts: `dev`, `dev:web`, `dev:server`, `dev:mcp`, `build`,
  `test`, `test:property`, `typecheck`, `lint`.

## Repository structure (where things live)

- `src/core/` — pure domain: `recipe.ts` (types), `recipeSchema.ts` (Zod:
  `RecipeSchema`, `RecipeInputSchema`, `SearchParamsSchema`), `searchRecipes.ts`
  (pure search function). No I/O here.
- `src/server/` — HTTP API: `routes/recipes.ts`, `storage/recipeStore.ts`,
  `index.ts`. The API is the single writer to `data/recipes.local.json`.
- `src/mcp/recipeMcpServer.ts` — MCP server exposing `search_recipes` (read) and
  `create_recipe` (write-via-API).
- `src/client/` — React text-only form + card list (no image UI).
- `tests/` — `unit/`, `property/`, `api/`, `integration/`.
- `data/recipes.local.json` is runtime-only and git-ignored; only
  `data/recipes.json` is tracked.

## Glossary

- Recipe: text-only record (title, category, ingredients, cookingMinutes,
  difficulty, cuisine/flavor/drink/texture tags, notes, server-assigned `id` and
  `createdAt`). No image field.
- `search_recipes`: MCP tool; condition search over stored data (pure logic).
- `create_recipe`: MCP tool; persists a confirmed text recipe via the API.
- `drinkPairings`: an explicit tag filter over **registered** pairings only — not
  a drink-affinity recommender.
- Correctness Properties (PROP-1..8): invariants the search function must hold.

## Core engineering rules

1. **Pure search function.** `src/core/searchRecipes.ts` must stay pure: no
   imports from `fs`, `http`, `net`, or any I/O; output depends only on inputs
   and is deterministic. Do not add caching or external calls.
2. **Structured MCP input/output.** Both MCP tools validate input with the shared
   Zod schema. `create_recipe` accepts text attributes only — never image bytes,
   file paths, or an image id. Tool results are structured JSON text.
3. **Registration only after user approval.** The LLM must present the proposed
   recipe and register via `create_recipe` only after the user explicitly
   approves the content. Content approval and the MCP tool-run permission are
   two separate confirmations; `create_recipe` is never auto-approved.
4. **Separate facts from inference.** When extracting from an image or
   recommending drink affinity, clearly distinguish information read/registered
   from the LLM's own inference. If something is unclear or unreadable, ask the
   user — never fabricate. If external sources are consulted, cite them.
5. **Single writer + serialized writes.** The API is the only writer to
   `data/recipes.local.json`; writes go through the serialized, failure-isolating
   queue. MCP `create_recipe` persists via the API, never by writing the file
   directly. Corrupt/unreadable data raises a clear error and must not be
   overwritten.
6. **Secrets & real data excluded.** Never put secrets, API keys, tokens, real
   user data, real images, or `data/recipes.local.json` contents into source, config,
   docs, or evidence. MCP config carries only a non-secret API base URL.
7. **Update tests when search changes.** Any change to search behavior
   (`searchRecipes.ts` or the schemas it uses) must update/extend the unit tests
   and keep all 8 Correctness Properties (`npm run test:property`) passing. Do
   not mark work complete without running the stated verification.
8. **Keep the MVP scope.** Implement only what `requirements.md` defines. Do not
   add image upload/storage/serving/display, a recipe detail screen, polling/SSE
   auto-refresh, vector/semantic search, login, external DB, or paid AI APIs.
   `docs/product-vision.md` is a future-vision note, not an implementation target.

## Verification gate

Before calling any code task done: `npm run typecheck`, `npm test`,
`npm run test:property`, `npm run build`, and `npm run lint` must all pass.

## Good / bad examples

- Pure search — Good: `searchRecipes(recipes, params)` filters the array it was
  given. Bad: `searchRecipes` reading `data/recipes.local.json` or calling `fetch`.
- Registration — Good: show the recipe, wait for explicit user approval, then
  `create_recipe`. Bad: calling `create_recipe` as soon as attributes are
  extracted.
- Facts vs inference — Good: "Title (read from image): …; suggested pairing
  (my inference): Shiraz, because …". Bad: presenting an inferred pairing as if
  it were stored data.
- Persistence — Good: MCP `create_recipe` POSTs to the API. Bad: MCP writing
  `data/recipes.local.json` directly.
- Secrets/data — Good: reference a recipe by title in docs. Bad: pasting
  `data/recipes.local.json` contents or a token into evidence.
