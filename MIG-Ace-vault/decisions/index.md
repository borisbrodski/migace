---
type: guide
---

# Decisions

One note per decision. Earlier alternatives are listed so that they are not proposed again without a new argument.

| Date | Decision | Status |
|---|---|---|
| 2026-11-16 | [A TypeScript tool at build time, a static SQL script at run time](typescript-tool-and-static-script.md) | direction |
| 2026-11-12 | [The desired schema is read from a real database](desired-schema-from-the-real-database.md) | decided |
| 2026-11-16 | [Snippets are valid YAML with statements in a SQL-like language](snippets-are-yaml-with-sql-like-statements.md) | decided |
| 2026-11-16 | [The grammar supports only the YAML constructs that snippets need](only-the-yaml-we-need.md) | decided |
| 2026-11-16 | [A part that ran is never run again; changes are guarded at build time](a-part-that-ran-is-never-run-again.md) | decided |
| 2026-11-16 | [One release file per release](one-release-file-per-release.md) | decided |
| 2026-11-13 | [Temporary databases without containers](temporary-databases-without-containers.md) | decided |
| 2026-11-16 | [No test rows without a testdata entry](no-test-rows-without-a-testdata-entry.md) | decided |
| 2026-11-17 | [Snippet generation is a main feature; an LLM names, it never writes statements](snippet-generation-is-a-main-feature.md) | decided |
| 2026-11-19 | [Complex data fixes are written in Java and tracked outside MIG-Ace](complex-data-fixes-in-java.md) | decided |
| 2026-11-19 | [Upgrades have two phases: start and finish](upgrade-phases-start-and-finish.md) | decided |
| 2026-11-19 | [Snippets are ordered by branch, then timestamp](branch-plus-timestamp-order.md) | direction |
| 2026-11-21 | [A test run simulates customers upgrading through different paths](upgrade-path-simulation.md) | decided |
| 2026-11-21 | [MigQL syntax decisions after the first implementation](migql-syntax-after-m1.md) | decided |
| 2026-11-21 | [MigQL answers after the PostgreSQL generation](migql-answers-after-m3.md) | decided |
| 2026-11-21 | [A name in MigQL is exact, with or without quotes](names-are-exact.md) | decided |
| 2026-11-22 | [`do` runs what was written; smart actions have their own keys](do-is-literal-actions-have-names.md) | decided |
| 2026-11-21 | [MIG-Ace is licensed under the Apache License 2.0](apache-license.md) | decided |
| 2026-11-21 | [The language is called MigQL, and snippet files end in .migql.yaml](migql-name-and-extension.md) | decided |
| 2026-11-21 | [Snippets are referenced by their slug, and slugs are unique](references-by-slug.md) | decided |
| 2026-11-21 | [Code is written with strict test-driven development](strict-test-driven-development.md) | decided |
| 2026-11-21 | [The language is built and tested with langium-tools](use-langium-tools.md) | decided |
| 2026-11-21 | [An Obsidian vault in the repository; main is the release, work happens on candidate](vault-and-branches.md) | decided |

## Earlier decisions that were replaced

| Earlier | Now |
|---|---|
| Core and runner in Kotlin, on the classpath at migration time | TypeScript tool at build time, static script at run time |
| Snippets as YAML with typed operation maps | Valid YAML envelope with statements in a SQL-like language |
| Own string condition language, then nested YAML conditions | Expressions in the statement language, parsed by the MIG-Ace grammar |
| Released snippets immutable, ids frozen | Snippets changeable and reorderable; build guard plus `changed` marker |
| `if-changed: fail / skip / rerun` per part | Always skip at run time; guard at build time |
| Release information as a property inside each snippet, with a git merge driver | One release file per release |
| Testcontainers as the default scratch database | Real binaries by default, PGlite for the editor, containers optional |
| Rename all constraints after every snippet | Naming convention, lint, definition-first comparison |
| Generated test rows for every new table | No test rows without an explicit `testdata` entry |
| Separate init script for the ledger tables | The migration script creates and upgrades the ledger itself |
| Drop and recreate all views and triggers on every run | Replace only the objects that differ |
