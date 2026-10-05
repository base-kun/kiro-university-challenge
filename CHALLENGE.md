# Kiro University Challenge

Kiroを主な開発ツールとしてRecipe Shelf MCPを作成しました。
Spec、Steering、Hooks、PBT、Powers、MCP、Custom Agentを使用しています。

Recipe Shelf MCP was built primarily with Kiro, using Specs, Steering, Hooks,
PBT, Powers, MCP, and a Custom Agent.

## Lessons

| Lesson | 作成・使用したもの / Created and used | Files |
|---|---|---|
| 1. Spec | 要件・設計・タスク / Requirements, design, tasks | [requirements](.kiro/specs/recipe-shelf/requirements.md), [design](.kiro/specs/recipe-shelf/design.md), [tasks](.kiro/specs/recipe-shelf/tasks.md) |
| 2. Steering | 永続的な開発ルール / Persistent development rules | [project-standards.md](.kiro/steering/project-standards.md) |
| 3. Hooks | core保存後に単体・PBTを実行 / Unit and property tests on core saves | [core-test-on-save.json](.kiro/hooks/core-test-on-save.json) |
| 4. PBT | IDEのSpecで生成・実行した13のPBT / 13 property tests generated and run through the IDE Spec workflow | [property tests](tests/property/searchRecipes.property.test.ts) |
| 5. Powers | 自作PowerとMarkdownlintを使用 / Custom Power and Markdownlint used | [recipe-curator](powers/recipe-curator/README.md), [Markdownlint](docs/reviews/markdownlint-power-review.md) |
| 6. MCP | Kiroで登録・検索Toolを使用 / Creation and search tools used in Kiro | [server](src/mcp/recipeMcpServer.ts), [config](.kiro/settings/mcp.json) |
| 7. Custom Agent | 専用Agentでレビュー / Review using a custom agent | [agent](.kiro/agents/recipe-quality-reviewer.md), [review](docs/reviews/recipe-quality-review.md) |

## Verification

検証結果（2026-10-06）：型検査・lint・build合格、
全49テスト合格（PBT 13件）。コマンドは[README](README.md#verify)を参照。

Verification on 2026-10-06: typecheck, lint, and build passed;
49 tests passed, including 13 property tests. Commands are in the README.

## Submission

動画・SNS投稿・応募フォームは別途提出します。Bonusは達成を主張しません。

The video, social post, and entry form are submitted separately.
No bonus lesson completion is claimed.
