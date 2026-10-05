# Implementation Plan

## Overview

Tasks are ordered by dependency. Each task maps to one or more requirements. Complete and verify each task before starting the next.

Phases:
- **Phase A (Tasks 1–2)** — Project scaffold and core types (no UI yet)
- **Phase B (Tasks 3–5)** — Search logic + tests (Lessons 3 & 4 evidence created here)
- **Phase C (Tasks 6–9)** — API server + persistence
- **Phase D (Tasks 10–11)** — React client
- **Phase E (Task 12–13)** — MCP server (Lesson 6)
- **Phase F (Tasks 14–17)** — Kiro Lessons 2, 3, 5, 7 artifacts
- **Phase G (Tasks 18–19)** — Docs, Git hygiene, final verification
- **Phase H (Tasks 20–28)** — Final direction: text-only model + LLM image-to-MCP registration. The app/API/MCP stop handling images (images are read only by the Kiro LLM); recipes become text-only; `create_recipe` registers text via the API; docs/demo updated. Non-destructive migration of legacy data.

> **Change note (final spec revision — overrides prior image revisions):** Tasks 1–12 are retained as the historical record of the earlier image-based MVP; their completion does NOT count as completing this final text-only direction. The remaining work is captured as new, incomplete Tasks 20–28 below. The pure search function and all 8 Correctness Properties are preserved unchanged.

---

## Task Dependency Graph

> The wave graph below reflects the **final execution order**. Tasks 1–12 are the historical image-based MVP (already built) and are shown only for context; the live demo (13), custom-agent review (16), docs (18), and final audit (19) now run **after** the Phase H text-only migration (Tasks 20–28).

```json
{
  "note": "Tasks 1-12 are historical (image-based MVP, already complete). The final order sequences the text-only migration (20-28) before the live demo, review, docs, and audit.",
  "waves": [
    { "wave": 1, "tasks": [20] },
    { "wave": 2, "tasks": [21, 22] },
    { "wave": 3, "tasks": [23] },
    { "wave": 4, "tasks": [24, 25] },
    { "wave": 5, "tasks": [26, 27] },
    { "wave": 6, "tasks": [13, 14, 15, 17] },
    { "wave": 7, "tasks": [28] },
    { "wave": 8, "tasks": [18] },
    { "wave": 9, "tasks": [16] },
    { "wave": 10, "tasks": [19] }
  ]
}
```

Final-direction dependency graph (text-only). Tasks 1–12 already exist as the historical image-based MVP; the migration transforms that code:

```
[historical: 1 scaffold → 2 core → 3 search(+4,5 tests) → 6 persistence → 7 image upload → 8 API → 9 tests → 10 form → 11 list → 12 MCP server]

Phase H (final, migrates the above to text-only):
20 (text-only core model + RecipeInputSchema)
├── 21 (serialized shared persistence)
├── 22 (remove image handling: upload/, /api/uploads, /uploads, busboy)
└── 23 (JSON text-only POST /api/recipes)      ← needs 20,21,22
    ├── 24 (Web form + list → text-only)         ← needs 23
    └── 25 (MCP create_recipe, write-via-API)    ← needs 20,23; builds on 12
        └── 26 (MCP registration, no auto-approve) ← needs 25
            └── 27 (tests: API, integration, concurrency, error) ← needs 21,23,25

13 (live demo, final text-only flow) — requires 23,24,25,26,27
14 (Steering) — run after the model is stable (after 20); no code dependency
15 (Hook) — requires search logic + unit tests (historical 3,4) to exist
17 (Powers) — validate the final JSON API; after 23 (and 26 if validating MCP)
28 (Docs/Evidence/demo update, text-only) — requires 23,24,25,27
18 (Submission docs: README/evidence/demo/forms/social) — requires 28 + Lessons 13,14,15,17
16 (Custom agent review) — requires final impl 20–28 + 13,14,15,17 complete
19 (Final audit) — requires everything above (13,14,15,16,17,18,20–28)
```

---

## Tasks

- [x] 1. Project scaffold and configuration
  - Initialize `package.json` with all required dependencies and npm scripts
  - Create `tsconfig.json` (client) and `tsconfig.server.json` (server/MCP/core)
  - Create `vite.config.ts` with proxy to API server on port 3001
  - Create `.gitignore` entries: `data/recipes.local.json`, `uploads/*`, `!uploads/.gitkeep`, `.env`, `.env.*`
  - Create directory skeleton: `src/client/`, `src/server/`, `src/core/`, `src/mcp/`, `tests/unit/`, `tests/property/`, `tests/api/`, `data/`, `uploads/`, `docs/`
  - Create `uploads/.gitkeep` and `data/recipes.json`
  - Create minimal TypeScript/Vite entry files sufficient for the toolchain to resolve without error: `src/client/main.tsx` (empty React mount), `index.html`, and placeholder `export {}` stubs for `src/core/recipe.ts`, `src/core/recipeSchema.ts`, `src/core/searchRecipes.ts`, `src/server/index.ts`, `src/mcp/recipeMcpServer.ts`
  - Run `npm install` and verify no errors
  - **Verification**: `npm run typecheck` runs to completion without type errors against the placeholder stubs; `npm install` exits 0; directory structure matches design; no application behaviour is implemented in this task beyond scaffold and config
  - **Requirements**: REQ-9.1.1–9.1.9, REQ-9.3.1–9.3.6

- [x] 2. Core types and Zod schema
  - Implement `src/core/recipe.ts` — `Recipe`, `RecipeCategory`, `RecipeDifficulty` types
  - Implement `src/core/recipeSchema.ts` — Zod schema matching the data model; export `RecipeSchema` and `SearchParamsSchema`
  - **Verification**: `npm run typecheck` exits 0
  - **Requirements**: REQ-1.1.2, REQ-1.1.5, REQ-3.1.4, REQ-3.1.5

- [x] 3. Search logic pure function
  - Implement `src/core/searchRecipes.ts`:
    - `normalize(s)` helper applying NFKC + trim + toLowerCase
    - `searchRecipes(recipes, params)` pure function with all filter conditions ANDed
    - Return `SearchResult[]` with `matchedFields`
    - Handle empty params (return all), unspecified params (ignored)
  - **Verification**: `npm run typecheck` exits 0; no imports from `fs` or `http`
  - **Requirements**: REQ-5.1.1–5.1.11

- [x] 4. Unit tests for search logic
  - Implement `tests/unit/searchRecipes.test.ts` using Vitest
  - Cover: empty params returns all, maxCookingMinutes filter, ingredients AND filter, category filter, drinkPairings filter, query substring match, normalization, no-match returns [], no fabrication
  - **Verification**: `npm test` passes all unit tests
  - **Requirements**: REQ-8.1, REQ-5.1.1–5.1.11

- [x] 5. Property-based tests
  - Implement `tests/property/searchRecipes.property.test.ts` using `fast-check` + Vitest
  - Implement all 8 properties: PROP-1 through PROP-8
  - Use `fc.record`, `fc.array`, `fc.integer`, `fc.constantFrom`, `fc.string` arbitraries to generate recipe pools and search params
  - **Verification**: `npm run test:property` passes; all 8 properties confirmed
  - **Note**: After implementation, use Kiro IDE Spec Correctness / Property-based testing feature to generate or run tests; record evidence in `CHALLENGE.md`
  - **Requirements**: PROP-1–PROP-8, REQ-8.2, REQ-8.2a, REQ-8.2b

- [x] 6. Persistence layer
  - Implement `src/server/storage/recipeStore.ts`:
    - `loadRecipes()` — reads `data/recipes.local.json`; returns `[]` on ENOENT
    - `saveRecipes(recipes)` — atomic write via tmp file + rename
    - `addRecipe(recipe)` — load → append → save
  - Create `data/` directory; ensure `data/recipes.local.json` is git-ignored
  - **Verification**: Manual test: call `addRecipe` twice, verify `data/recipes.local.json` contains both; `npm run typecheck` exits 0
  - **Requirements**: REQ-3.1.1–3.1.5, REQ-3.2.1–3.2.2

- [x] 7. Image upload handler
  - Implement `src/server/upload/imageHandler.ts`:
    - Parse `multipart/form-data` using `busboy`
    - Enforce 5 MB size limit during streaming
    - Write to temp file `uploads/<uuid>.tmp`
    - Read first 12 bytes and verify magic bytes for JPEG / PNG / WebP
    - On mismatch: delete temp file, return error
    - On match: rename to `uploads/<uuid>.<ext>`
    - Return `{ filename, fields }` or throw typed error
  - **Verification**: Test with valid JPEG, valid PNG, >5 MB file, renamed .txt file — all behave as specified; `npm run typecheck` exits 0
  - **Requirements**: REQ-2.1.1–2.1.9

- [x] 8. API server routes
  - Implement `src/server/routes/recipes.ts`:
    - `POST /api/recipes` — parse upload, validate fields with Zod, build `Recipe` object, call `addRecipe`, return 201
    - `GET /api/recipes` — call `loadRecipes`, return 200
    - `GET /uploads/:filename` — validate filename regex, serve file with correct Content-Type
  - Implement `src/server/index.ts` — HTTP server, route dispatch, CORS headers for Vite dev proxy
  - **Verification**: `npm run dev:server` starts without error; manual curl tests for each endpoint; `npm run typecheck` exits 0
  - **Requirements**: REQ-1.2.1–1.2.4, REQ-2.1.1–2.1.9, REQ-3.1.1–3.1.5, REQ-4.5, REQ-7.1–7.3

- [x] 9. API-level tests
  - Implement `tests/api/recipes.api.test.ts` using Vitest
  - Test: successful recipe creation, missing title returns 400, invalid category returns 400, oversized file returns 400, GET returns saved recipes
  - Start/stop server in test setup/teardown
  - **Verification**: `npm test` passes all API tests
  - **Requirements**: REQ-8.3, REQ-1.2.1–1.2.4

- [x] 10. React client — RecipeForm
  - Implement `src/client/components/RecipeForm.tsx`:
    - All input fields from REQ-1.1.1–1.1.10
    - Image file picker with client-side preview (REQ-2.2.1)
    - Client-side validation (title required, cookingMinutes ≥ 1, valid category/difficulty)
    - Submit via `fetch` POST to `/api/recipes`; show error message on failure
    - Call `onSuccess` callback with new recipe on 201
  - **Verification**: `npm run dev:web` renders form; all fields work; preview shows on image select; validation errors display
  - **Requirements**: REQ-1.1.1–1.1.10, REQ-1.2.1–1.2.4, REQ-2.2.1

- [x] 11. React client — RecipeList and RecipeCard
  - Implement `src/client/components/RecipeCard.tsx` — shows image, title, category, cookingMinutes, difficulty
  - Implement `src/client/components/RecipeList.tsx` — fetches `GET /api/recipes` on mount; re-fetches after new recipe added; shows empty state when list is empty
  - Implement `src/client/pages/App.tsx` — composes `RecipeForm` + `RecipeList`; passes `onSuccess` to form
  - Implement `src/client/main.tsx` and `src/client/styles/index.css`
  - **Verification**: Full flow — register recipe → appears in list immediately; refresh page → recipe persists; empty state shown when no recipes
  - **Requirements**: REQ-4.1–4.5, REQ-3.2.1

- [x] 12. MCP server
  - Implement `src/mcp/recipeMcpServer.ts`:
    - Use `@modelcontextprotocol/sdk` `Server` + `StdioServerTransport`
    - Register `search_recipes` tool with full description (all parameters documented)
    - Validate input with `SearchParamsSchema`
    - Call `loadRecipes()` then `searchRecipes()` on each invocation
    - Return results as JSON text content
    - All logs to `stderr` only
  - Build: `tsc -p tsconfig.server.json`
  - **Depends on**: Tasks 3 (search logic), 6 (persistence), 8 (API server — confirms the data path works end-to-end before wiring MCP)
  - **Verification**: `npm run dev:mcp` starts without error; stdio handshake completes; `npm run typecheck` exits 0
  - **Requirements**: REQ-6.1.1–6.1.7, REQ-6.2.1–6.2.2

- [ ] 13. Kiro IDE MCP registration and live demo (final text-only flow)
  - Register the MCP server in Kiro Workspace MCP settings with `RECIPE_API_BASE_URL`; confirm the connection is active in the Kiro MCP panel. `create_recipe` MUST NOT be in `autoApprove` (REQ-6.2.3).
  - Start the API server (and Web) so `create_recipe` can persist via the API.
  - Live registration flow:
    1. Attach a recipe image to the Kiro chat (the image is read only by the LLM; it is never uploaded to or stored by the app).
    2. The LLM extracts attributes (title, ingredients, cooking time, category, etc.) and asks the user about anything unclear or unreadable — no fabrication (REQ-6.4.3).
    3. The LLM proposes drink pairings with reasons, distinguishing registered facts from inference (REQ-5.3.4, REQ-6.4.5).
    4. The LLM presents the proposed recipe; the user explicitly approves the content; then Kiro asks permission to run the `create_recipe` tool (content approval and tool-run approval are separate, REQ-6.2.3). Only after both does `create_recipe` persist the text attributes via the API.
    5. Reload the Web page and confirm the new recipe appears in the list (reload is sufficient; no live refresh, REQ-4.5).
    6. Send: "Recipe MCPを使って、30分以内でシラーズに合う主菜を探してください。" — confirm Kiro calls `search_recipes` with structured conditions (e.g. `categories: ["主菜"]`, `maxCookingMinutes: 30`), then explains drink affinity from the returned recipes, keeping a recipe without any registered drink pairing as a valid candidate (REQ-5.3.1–5.3.3).
  - **Depends on**: Tasks 23 (JSON API), 24 (Web text-only), 25 (`create_recipe`), 26 (MCP registration, no auto-approve), 27 (tests green). (Builds on the historical Task 12 MCP server.)
  - **Verification**: Chat log/screenshots showing: image attached → attribute extraction + clarification → user content approval → separate tool-run approval → `create_recipe` success → recipe visible after Web reload → `search_recipes` call → LLM affinity explanation separating registered vs. inferred facts. No image is uploaded to or stored by the app at any step.
  - **Requirements**: REQ-6.1.7, REQ-6.2.1, REQ-6.2.3, REQ-6.4.1–6.4.7, REQ-5.3.1–5.3.5, REQ-4.5

- [x] 14. Steering document (Lesson 2)
  - Create `.kiro/steering/project-standards.md` with:
    - Product purpose
    - Technology stack
    - Repository structure
    - TypeScript conventions (strict mode, explicit return types)
    - Pure-function rule for `src/core/`
    - Security rules (no path construction from user input, no secrets in source)
    - Test rules (no task marked complete without tests passing)
    - MCP implementation rules (stderr only for logs)
    - MVP scope freeze (no features beyond requirements.md)
    - Good/bad examples for each major rule
  - **Verification**: File exists at correct path; Kiro applies it in subsequent sessions
  - **Verification done**: `.kiro/steering/project-standards.md` created (`inclusion: always`); applied in-session (system-injected rules observed).
  - **Requirements**: Lesson 2

- [x] 15. Hook — core test on save (Lesson 3) — DONE: `.kiro/hooks/core-test-on-save.json` (PostFileSave, matcher `src/core/.*\.ts$`, runs unit+property tests); **fired in the IDE on a `src/core` save (user-confirmed)**, tests ran in the Output panel
  - Create `.kiro/hooks/core-test-on-save.json`:
    - Trigger: `PostFileSave`
    - Matcher: `src/core/.*\\.ts$`
    - Action type: `command`
    - Command: `npm run test -- --run tests/unit`
    - On failure: output is surfaced to Kiro
  - Save a `src/core/` file from within Kiro to confirm the hook fires and test results appear
  - **Verification**: Hook fires; test output visible in Kiro; record evidence in `CHALLENGE.md`
  - **Requirements**: Lesson 3

- [x] 16. Custom agent — recipe-quality-reviewer (Lesson 7) — DONE: agent created (read-only + verify-commands, no write/commit) and **run via the agent picker**; no critical findings; one minor fix (#7 backup glob) applied; outcome summarized in `CHALLENGE.md` (detailed review draft kept locally, not published)
  - Create `.kiro/agents/recipe-quality-reviewer.md` with:
    - Role (final text-only direction): review requirements-vs-implementation alignment; search logic correctness and preserved Properties; **JSON input validation** at the API and MCP (shared Zod schema, unknown-field policy); **MCP `create_recipe` registration path** (write-via-API, no direct data-file write, finite timeout); **user-confirmation flow** (content approval and tool-run approval are separate; `create_recipe` not auto-approved); **concurrent-write persistence** (single writer + serialized queue, no lost updates, queue recovers after a failed write); **secrets & real-data hygiene** (no secrets in source/config, `data/recipes.local.json` and real images never committed); README accuracy; Lesson 1–7 evidence completeness
    - Explicitly: the app handles no images — there is no image upload/validation surface to review
    - Tools: read files, run shell commands (typecheck, test, test:property, build, git status)
    - Scope: minimal — only files listed in the agent definition
  - Execute the agent against the completed project
  - Summarize findings and fix/accept/defer decisions in `CHALLENGE.md` (detailed draft kept locally, not published)
  - **Depends on**: the final implementation and Lesson artifacts must exist first — Tasks 20–28 (text-only migration, API, Web, MCP `create_recipe`, tests, docs), Task 13 (live demo), Task 14 (Steering), Task 15 (Hook), Task 17 (Powers). Run Task 16 only after these are complete.
  - **Verification**: Agent ran against the final text-only implementation; findings recorded with fixed/accepted/deferred decisions; no unresolved critical findings
  - **Requirements**: REQ-9.5.1–9.5.4, Lesson 7

- [x] 17. Powers usage (Lesson 5)
  - Check available Powers in Kiro IDE
  - Select and actually use at least one Power in a development or validation task, save any artifact
  - Record Power name, reason, actions taken, and result in `CHALLENGE.md`
  - **Verification**: Power actually used; usage recorded
  - **Verification done**: custom `recipe-curator` Power packaged under `powers/recipe-curator/` and used in Kiro; markdownlint Power actually run (`lint_markdown`, `get_configuration`); recorded in `CHALLENGE.md` (Lesson 5).
  - **Requirements**: REQ-9.4.1–9.4.4, Lesson 5

- [x] 18. Documentation and submission artifacts
  - Create `README.md` with: overview, architecture diagram, prerequisites, install, dev start, MCP registration, test/typecheck/build commands, link to the Lesson summary, known constraints
  - Create `CHALLENGE.md` — Lesson 1–7 table with file paths, operations, verification results
  - Create `docs/submission/form-responses.md` — English answers for Challenge application form (local-only, git-ignored)
  - Create `docs/submission/social-post.md` — X/LinkedIn post draft with placeholders (local-only, git-ignored)
  - Create `docs/submission/demo-script.md` — 3-minute English/Japanese demo script (local-only, git-ignored). The drink-pairing segment shall follow the flow "retrieve candidates by structured conditions via `search_recipes` → Kiro judges drink affinity from the returned recipes", explicitly showing that Kiro separates registered facts from its own inference and that recipes without registered drink pairings are still considered (REQ-5.3.1–5.3.5)
  - **Verification**: README enables cold-start setup; `CHALLENGE.md` references real artifacts; demo script reflects the "条件検索で候補取得 → Kiroが相性を判断" flow
  - **Verification done**: Created `README.md`, `CHALLENGE.md`, and `docs/submission/{demo-script,social-post,form-responses}.md` (submission drafts are local-only / git-ignored). Demo script 30s–3min. Shared 2–3 sentence blurb reused in social-post + form-responses.
  - **Requirements**: REQ-9.2.1–9.2.3, REQ-5.3.1–5.3.5, Lesson 1–7 evidence

- [ ] 19. Final audit (run last)
  - Clean-state install WITHOUT deleting the working `node_modules`: copy/checkout the repo into a separate temporary directory and run `npm ci` there (reproduces a cold install from `package-lock.json` without disturbing the local dev environment).
  - In that clean checkout run: `npm run typecheck` (exit 0), `npm test` (all pass), `npm run test:property` (all 8 properties pass), `npm run build` (exit 0), `npm run lint` (no errors).
  - Verify `git status`: no `data/recipes.local.json`, no real images under `uploads/` committed (the `uploads/*` ignore rule is retained to prevent accidental image commits — see Task 22), no `.env`.
  - Verify `.kiro/` is tracked by Git.
  - Confirm the final text-only live flow end-to-end: attach image to Kiro → attribute extraction + clarification → content approval → separate tool-run approval → `create_recipe` → recipe visible after Web reload → `search_recipes` returns it with LLM affinity explanation (reuse Task 13).
  - **Depends on**: all of Phase H (Tasks 20–28), the live demo (Task 13), Lessons 1–7 (Tasks 14–17), and documentation (Task 18) must be complete first.
  - **Verification**: All checks pass in the clean checkout; the final demo flow completes in < 3 minutes; local `node_modules` is left intact.
  - **Requirements**: All REQ-* (final direction), all Lessons 1–7

---

## Phase H — Text-only model + LLM image-to-MCP registration (final direction; not yet started)

> **Supersedes the earlier image-upload revision.** This is the final direction and overrides any previous image-related tasks. Tasks 1–12 remain as **historical record of the old (image-based) MVP**; completing them does NOT count as completing the new text-only direction. All items below are **incomplete**.
>
> Key change: the application/API/MCP no longer handle images. Images are read only by the Kiro LLM on a chat-attached image. Recipes are text-only. `create_recipe` registers text attributes via the API. The pure search function and the 8 Correctness Properties are preserved unchanged.
>
> **Migration unit (Tasks 20–24 + existing tests + example data):** Tasks 20–24 and the updates to the existing tests (including JSON-ifying the existing `tests/api/recipes.api.test.ts`) and `data/recipes.json` are mutually dependent and shall be treated as **one atomic migration unit**. The existing API test MUST compile and pass against the JSON text-only endpoint at the migration-unit gate (Task 24); Task 27 then ADDS the new MCP/integration/concurrency/error tests on top. Removing `imageFilename` makes intermediate states fail to typecheck/compile; **do not stop work merely because typecheck/compile fails mid-migration.** Verify the unit only at its completion by running `npm run typecheck`, `npm test`, `npm run test:property`, and `npm run build` — all must pass. Search behavior and the 8 Properties are preserved; test fixtures may have their legacy image field removed/updated as needed. (Task 27 then adds the new MCP/integration/concurrency/error tests on top of the migrated baseline.)
>
> **Data safety (distinct concerns):**
> - *Legacy field tolerance* — when loading `data/recipes.local.json`, unknown/legacy attributes (e.g. `imageFilename`) are ignored by the text-only model (REQ-3.3.1).
> - *Non-destructive original files* — existing recipe records and any existing real images under `uploads/` are not deleted or overwritten by the migration (REQ-3.3.2). If a step would rewrite `data/recipes.local.json`, take a timestamped backup first (e.g. `data/recipes.backup-<ISO>.json`, git-ignored) so no existing recipe is lost. These two concerns are separate: ignoring a field on read is not the same as deleting the stored file.
>
> **Web list refresh:** MCP-registered recipes appearing after a page reload is sufficient (REQ-4.5). Do not add polling or SSE.

> **Tasks 20–24 form a single migration unit (see Phase H header).** Do not stop mid-unit on typecheck/compile failures. Run the full verification (`npm run typecheck`, `npm test`, `npm run test:property`, `npm run build`) once at the END of Task 24, when the unit is coherent.

- [x] 20. Text-only core model + shared registration schema  *(migration unit: 20–24)* — DONE (imageFilename removed; RecipeInputSchema added; migration-unit gate passed)
  - Remove `imageFilename` from the `Recipe` type (`src/core/recipe.ts`) and from `RecipeSchema`
  - On load, `loadRecipes`/`RecipeSchema` shall tolerate unknown/legacy fields (e.g. `imageFilename`) and **strip them from the in-memory model** (ignore-and-drop, not reject), so legacy data keeps loading (REQ-3.3.1)
  - Add `RecipeInputSchema` (Zod) + inferred `RecipeRegistrationInput` to `src/core/recipeSchema.ts`: `title`, `category`, `ingredients[]`, `cookingMinutes`, `difficulty`, optional tag arrays, `notes` (NO image field). For **registration input**, unknown fields shall be rejected with a descriptive 400 (strict input), while **persisted legacy records** are tolerated on read — state this distinction in code comments.
  - This single schema is reused by the API JSON path and MCP `create_recipe` (no duplicated validation)
  - Update test fixtures that carry a legacy image field as needed (search behavior and the 8 Properties are preserved).
  - **Verification**: deferred to the end of the migration unit (Task 24). Intermediate typecheck failures are expected and are not a reason to stop.
  - **Requirements**: REQ-2.1, REQ-2.4, REQ-3.1.6, REQ-3.3.1, REQ-6.3.2, REQ-8.5

- [x] 21. Serialized shared persistence (storage)  *(migration unit: 20–24)* — DONE (serial failure-isolating write queue + backup-before-rewrite; covered by writeQueue tests)
  - Route `addRecipe` in `src/server/storage/recipeStore.ts` through a module-level serial write queue (promise chain) so concurrent registrations apply one at a time with no lost updates
  - The queue shall **recover after a failed write**: if one queued operation rejects (e.g. a transient write error), the failure is isolated to that operation and subsequent queued writes still run and persist (the chain is not left permanently broken)
  - Keep the atomic tmp+rename write and the existing `loadRecipes`/`saveRecipes` API; `loadRecipes` must not fail on legacy `imageFilename` fields and strips them from the in-memory model (REQ-3.3.1)
  - If an operation rewrites `data/recipes.local.json`, write a timestamped backup first so no existing recipe is lost (REQ-3.3.2); the backup file is git-ignored
  - **Depends on**: Task 20
  - **Verification**: deferred to the end of the migration unit (Task 24). The specific behaviors (N parallel writes persist N recipes; queue still works after a failed write) are asserted by tests in Task 27.
  - **Requirements**: REQ-3.1.3, REQ-3.1.6, REQ-3.1.7, REQ-3.1.8, REQ-3.3.1, REQ-3.3.2

- [x] 22. Remove image handling from API/server  *(migration unit: 20–24)* — DONE (src/server/upload removed; busboy removed from package.json; no /api/uploads or /uploads route)
  - Delete `src/server/upload/imageHandler.ts` and the `src/server/upload/` directory; remove all `busboy` usage from the code
  - Remove `POST /api/uploads` and `GET /uploads/:filename`; remove static file serving from `src/server/index.ts`
  - **Keep the `uploads/` directory and its `.gitignore` rule (`uploads/*`, `!uploads/.gitkeep`)** so that any existing real images are NOT deleted and cannot be accidentally committed later (REQ-7.4). Do not delete existing files under `uploads/`.
  - Dependency cleanup (do after all usage is removed): remove `busboy` and `@types/busboy` from `package.json`.
  - Keep `.gitignore` covering `data/recipes.local.json`, `.env`, `.env.*`.
  - **Depends on**: Task 20
  - **Verification**: deferred to the end of the migration unit (Task 24); then `grep` finds no `busboy`/upload/`/uploads` references in `src/server`, and `package.json` no longer lists `busboy`/`@types/busboy`.
  - **Requirements**: REQ-2.1, REQ-7.4, REQ-9.3.2, REQ-9.3.4, REQ-9.3.5

- [x] 23. JSON (text-only) registration (API)  *(migration unit: 20–24)* — DONE (application/json only; 415 non-JSON, 413 >65536, 400 validation; API tests pass)
  - Change `POST /api/recipes` to accept `application/json` only, validated by `RecipeInputSchema`; assign server `id`/`createdAt`; persist via the shared serialized `addRecipe`
  - Enforce a **maximum request body size** for the JSON endpoint (e.g. 64 KB; reject larger bodies with 413 and a descriptive error) so an oversized/streamed body cannot exhaust memory
  - Unknown fields in the registration body are rejected with a descriptive 400 (strict input, consistent with Task 20)
  - Return clear 400s for missing title, invalid category/difficulty, non-positive `cookingMinutes`, malformed JSON; never leak stack traces (REQ-7.3)
  - **Depends on**: Tasks 20, 21, 22
  - **Verification**: deferred to the end of the migration unit (Task 24). (curl spot-checks are fine during development; the pass/fail gate is the unit-level run.)
  - **Requirements**: REQ-1.2.1–1.2.4, REQ-3.1.4, REQ-3.1.5, REQ-3.1.7, REQ-7.1–7.3

- [x] 24. Web form + list to text-only — AND migration-unit verification  *(closes migration unit: 20–24)* — DONE (form/cards text-only; example data updated; gate typecheck/44 tests/8 PBT/build all pass)
  - Update `RecipeForm.tsx`: remove the image file picker and preview; submit `application/json` to `POST /api/recipes` (REQ-1.1.11)
  - Update `RecipeCard.tsx`/`RecipeList.tsx`: remove the image thumbnail; show title, category, cookingMinutes, difficulty
  - Update `data/recipes.json` and any existing test fixtures to drop the legacy image field (search behavior and the 8 Properties unchanged)
  - JSON-ify the existing `tests/api/recipes.api.test.ts`: switch from multipart/image to the JSON text-only endpoint (happy path 201 + validation 400s); remove image/upload assertions. This is part of the migration unit and must pass at the gate.
  - Document in README that MCP-added recipes appear after page reload (no live refresh; no polling/SSE — REQ-4.5)
  - **Run the migration-unit verification now** (first point where the codebase is coherent): `npm run typecheck` (exit 0), `npm test`, `npm run test:property` (all 8 pass), `npm run build` (exit 0). The web form round-trips and the recipe appears in the list after reload.
  - **Depends on**: Tasks 20, 21, 22, 23 (same migration unit)
  - **Verification**: all of typecheck/test/test:property/build pass together at unit completion; Web text-only round-trip works
  - **Requirements**: REQ-1.1.1–1.1.11, REQ-4.1–4.5, REQ-8.4

- [x] 25. MCP `create_recipe` tool (text-only, write-via-API) — DONE (strict schema, writes via API, 5s AbortController timeout; stdio integration test confirms register/reject/timeout/API-down)
  - Register `create_recipe` in `src/mcp/recipeMcpServer.ts`: validate with `RecipeInputSchema` (text only), then `fetch` `POST ${RECIPE_API_BASE_URL}/api/recipes` (JSON); return the created recipe or a clear error (invalid input / API unavailable / persistence failure)
  - Apply a **finite timeout** to the API call (e.g. `AbortController` with a few-second limit); on timeout, return a clear "API did not respond" error rather than hanging
  - Tool description: the LLM reads the image itself and passes TEXT fields only (no image/path/id); call only after the user has approved the content. Note that **content approval (the user agreeing to the proposed recipe) and tool-run approval (Kiro's permission prompt to execute the tool) are separate steps** (REQ-6.2.3); the tool performs no image analysis or affinity judgment
  - Read `RECIPE_API_BASE_URL` from env (default `http://localhost:3001`); no secrets; logs to stderr only; do not write `data/recipes.local.json` directly
  - Keep `search_recipes` unchanged
  - **Depends on**: Tasks 20, 23; builds on Task 12
  - **Verification**: `npm run dev:mcp` starts; stdio `tools/list` shows `search_recipes` and `create_recipe`; `tools/call create_recipe` (API running) persists and returns the recipe; with the API stopped it returns a clear error within the timeout; `npm run typecheck` exits 0
  - **Requirements**: REQ-6.3.1–6.3.7, REQ-6.1.5, REQ-6.1.6, REQ-6.2.2, REQ-6.2.3

- [x] 26. MCP registration config (no auto-approve for writes) — `.kiro/settings/mcp.json` is published with a repository-relative launcher; `autoApprove` contains only `search_recipes`. The machine-specific backup `mcp.local.json` is ignored.
  - Document/register the MCP server in Kiro Workspace MCP settings with `RECIPE_API_BASE_URL`; ensure `create_recipe` is NOT in `autoApprove` so the user confirms each registration (REQ-6.2.3)
  - **Depends on**: Task 25
  - **Verification**: MCP panel shows the server active; invoking `create_recipe` prompts for user approval; config contains no secrets
  - **Requirements**: REQ-6.2.1, REQ-6.2.2, REQ-6.2.3

- [x] 27. Tests — API, integration, concurrency, error paths — DONE (tests/integration/registerFlow + writeQueue; real create_recipe over stdio; 44 tests pass incl concurrency/queue-recovery/corrupt-data/timeout)
  - Update `tests/api/recipes.api.test.ts` to the JSON path: happy path (201), validation errors (missing title, invalid category/difficulty, non-positive cookingMinutes, malformed JSON → 400), unknown field rejected (400), oversized body rejected (413). Remove all image/upload tests.
  - Add `tests/integration/registerFlow.test.ts` that invokes the **real `create_recipe` MCP tool over stdio** (via a small stdio client that spawns the actual MCP server; not a hand-rolled imitation of the API call): start the API server, start the MCP server as a child process, perform the stdio handshake, call `create_recipe`, then assert the recipe is present via `GET /api/recipes` and that the real `search_recipes` tool finds it (REQ-8.3a). Error cases also call the real tool: unknown field → rejected and not persisted; invalid input (non-positive cookingMinutes) → tool returns a validation error; API stopped → clear API-unavailable error; non-responsive API → ~5s timeout error (REQ-8.3c, REQ-6.3.8). The concurrency case asserts all parallel registrations persist with no lost updates (REQ-8.3b).
  - Add `tests/integration/writeQueue.test.ts` exercising the real persistence layer directly (isolated data file per test): concurrent `addRecipe` persists all; **queue recovery** — after one write fails (obstructed tmp path), the queue still processes a later write and the failed recipe is absent (REQ-3.1.9); corrupt data (non-array JSON, malformed JSON, invalid record) raises `RecipeDataError` and leaves the file unchanged with no overwrite (REQ-3.2.2); a legacy `imageFilename` on an otherwise-valid record loads and is stripped (REQ-3.3.1).
  - Test data is isolated from real data via `RECIPES_DATA_FILE` pointing at per-test temp dirs; no real data/images touched.
  - Keep the existing search unit tests and PBT passing (fixtures may drop the legacy image field)
  - **Depends on**: Tasks 21, 23, 25
  - **Verification**: `npm test` passes (unit, property, API, integration); `npm run test:property` passes; `npm run typecheck` exits 0; `npm run build` succeeds; `npm run lint` passes
  - **Requirements**: REQ-8.1, REQ-8.2, REQ-8.3, REQ-8.3a, REQ-8.3b, REQ-8.3c, REQ-8.4, REQ-3.1.9, REQ-3.2.2, REQ-3.3.1

- [x] 28. Docs & demo update (text-only flow) — DONE: `README.md`, `CHALLENGE.md`, and the local-only `docs/submission/{demo-script,social-post,form-responses}.md` updated to the text-only flow; `data/recipes.json` sample is text-only. Video recording, public posting, and the application-form submission are separate activities, not part of this task.
  - Update `README.md`: text-only registration, no image handling, MCP registration with `RECIPE_API_BASE_URL`, `create_recipe` auto-approve disabled, Web list reload behavior; remove image/upload instructions
  - Update `CHALLENGE.md` and `data/recipes.json` to drop image fields (keep example valid; non-destructive to runtime data)
  - Update `docs/submission/demo-script.md` (local-only, git-ignored) to the final flow: attach image to Kiro → LLM extracts attributes → asks about unclear items → proposes drink affinity with reasons (registered vs. inferred, cite sources) → user confirms → `create_recipe` registers → appears in Web list (reload) → `search_recipes` finds it → LLM explains affinity, including a candidate with no drink tag
  - **Depends on**: Tasks 23, 24, 25, 27
  - **Verification**: Docs match the implemented text-only behavior; demo script matches the final flow; `data/recipes.json` validates against the new schema
  - **Requirements**: REQ-9.2.1–9.2.4, REQ-9.3.2

---

## Notes

- **Final execution order:** migration unit 20→21,22→23→24 (verify at Task 24) → 25 → 26 → 27 → then live demo 13 and Lessons 14/15/17 → docs 28 → submission docs 18 → custom-agent review 16 → final audit 19.
- **Migration unit (20–24):** treat as one atomic change; do not stop on mid-migration typecheck/compile failures. Verify typecheck/test/test:property/build together at the end of Task 24. Task 27 adds the new MCP/integration/concurrency/error tests afterward.
- Task 13 (live demo) reflects the final flow: attach image to Kiro → attribute extraction + clarification → content approval → separate tool-run approval → `create_recipe` → Web list (reload) → `search_recipes` → LLM affinity explanation. No Web image upload anywhere.
- **Two distinct approvals:** (1) the user approving the proposed recipe content, and (2) Kiro's permission prompt to execute the `create_recipe` tool. `create_recipe` is never in `autoApprove` (REQ-6.2.3).
- **Data safety:** ignoring unknown/legacy fields on read (REQ-3.3.1) is separate from preserving the original files; the migration never deletes existing recipes or existing real images, and takes a backup before rewriting `data/recipes.local.json` (REQ-3.3.2).
- Web list refresh is reload-only; no polling or SSE (REQ-4.5).
- Task 5 (property-based tests) must be run through Kiro IDE's Spec Correctness / Property-based testing feature to count as Lesson 4 evidence. Record the Kiro-generated output in `CHALLENGE.md`.
- Never mark a task complete without running its stated verification command (for the migration unit, the gate is Task 24).
- Do not add features or files not listed in these tasks without updating requirements.md first.
- **Historical record:** Tasks 1–12 document the earlier image-based MVP. Their completion is retained for history but does NOT satisfy the final text-only direction; Phase H (Tasks 20–28) tracks the remaining work.
- Phase H must not alter `src/core/searchRecipes.ts` behavior or the 8 Correctness Properties; `npm run test:property` must still pass at the migration-unit gate and after Task 27.
- Task 25 (`create_recipe`) requires the API server to be running to persist; the MCP tool writes only via the API (never the data file directly), uses a finite timeout, and is not auto-approved.
- The MVP remains single-user and single-API-process; multi-process concurrent writers stay out of scope (see design.md concurrency model).
- The application never handles images; image reading is done by the Kiro LLM only (REQ-2.1–2.4).
- **Out of scope (future, not in these tasks):** sharing an image from an iPhone/iPad share sheet so the LLM auto-organizes and registers it, and later viewing a recipe together with its original image. Recorded as a future idea only; no implementation task is added for it (see requirements.md §11).
