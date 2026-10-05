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
| 5. Powers | 自作PowerとMarkdownlintを使用 / Custom Power and Markdownlint used | [recipe-curator](powers/recipe-curator/README.md) |
| 6. MCP | Kiroで登録・検索Toolを使用 / Creation and search tools used in Kiro | [server](src/mcp/recipeMcpServer.ts), [config](.kiro/settings/mcp.json) |
| 7. Custom Agent | 専用Agentでレビュー / Review using a custom agent | [agent](.kiro/agents/recipe-quality-reviewer.md) |

## Bonuses

### Kiro Web / Cloud Sessions

Kiro Webの「Recipe Shelf MCP 提出前レビュー」セッションで、同じリポジトリを
クラウドからレビューしました。Spec・Steering・Hooks・MCP・Agent、APIの
loopback待受け・Host/Origin制限、保存先、公開サンプルと秘密情報を確認しました。
ローカルIDEは開発とレシピ登録・検索、クラウドは独立した提出前レビューを担当します。
クラウドのテスト合格件数はここでは記載しません。

The Kiro Web cloud session reviewed the same repository's Kiro configuration,
API safeguards, persistence path, public sample, and secret handling. The local
IDE handled development and recipe registration/search; the cloud provided an
independent pre-submission review. Cloud test pass counts are not listed here.

### Packaged Kiro Power

自作のrecipe-curatorをKiroへ導入・使用し、再利用可能なSkill-only Powerとして
公開しています。画像からの情報整理、推定と元情報の区別、承認後のMCP登録・検索を
手順化しています。Recipe MCPサーバーは別途設定します。

recipe-curator was installed and used in Kiro and packaged as a reusable
skill-only Power for image-based recipe curation and approved MCP registration
and search. The Recipe MCP server is configured separately.

- [plugin.json](powers/recipe-curator/plugin.json)
- [Skill](powers/recipe-curator/skills/recipe-curation/SKILL.md)
- [Installation and usage](powers/recipe-curator/README.md)
- [Public Power package](https://github.com/base-kun/kiro-university-challenge/tree/main/powers/recipe-curator)

## Verification

検証結果（2026-10-06）：型検査・lint・build合格、
ローカルで全65テスト合格（PBT 13件）。コマンドは[README](README.md#verify)を参照。

Verification on 2026-10-06: typecheck, lint, and build passed;
65 local tests passed, including 13 property tests. Commands are in the README.

## Submission

動画・SNS投稿・応募フォームは別途提出します。
動画にはローカルIDEの操作とKiro Webのクラウドレビューを含めます。

The video, social post, and entry form are submitted separately.
The video includes local IDE operations and the Kiro Web cloud review.
