---
type: journal
date: 2026-11-21
milestones: [M0, M1]
---

# Review of M0 and M1

A review of the first implementation session, done in a fresh clone on Linux with Node 22.23. It builds on the [session note](2026-11-21-workspace-and-migql-parser.md).

## What was checked

| Check | Result |
|---|---|
| `npm ci`, `npm run build`, `npm run lint` in a fresh clone | pass |
| `npm test` | 517 tests pass, none skipped, after the website was corrected (see below) |
| The workflow on GitHub for the commit | passed |
| Every acceptance criterion of M1 is named by a test | yes, all except M1-AC-32, which is the journal note |
| Expected SQL of the catalogue, parsed with PostgreSQL's own parser (`libpg-query`) | 29 files, 37 statements, all accepted |
| Comments that tell the history of a change, left-over to-do notes | none found |

## Assessment

- **The open question is answered well.** One grammar, the standard Langium parser, linker and language server, and a lexer of our own. The design has one honest limit: the lexer's table of keys repeats part of the grammar. A test catches a key that is added in one place only.
- **The code is in good shape.** Small files with one task each, error messages written as sentences, tests grouped by what they prove.
- **The session note is reliable.** Every "not done" in it was confirmed by the review, and nothing was found that it leaves out.

## Deviations from the specs

1. **More than the spec asked for.** M1 listed SQL generation and editor features as non-goals. The session built a first PostgreSQL generator (about 220 lines) and hover, completion and two quick fixes. All of it is tested and small. The generator is the starting point of M3. Rule for the future: a non-goal is not built; if it seems needed, write the reason into the journal first.
2. **One commit for everything.** 188 files arrived in one commit. The tests exist, but the history cannot show that each test came before its code. The [coding rules](../engineering/coding-rules.md) now ask for small commits.
3. **Windows is open:** M0-AC-04 and M0-AC-06, as the session note says.

## Findings

1. **Vitest 2.0.5 has known security problems.** `npm audit` reports six findings, three of them critical, all in Vitest 2.0.5 and what it brings along (Vite, tinypool, esbuild). They concern the test runner's own server and user interface, not the code MIG-Ace ships. MIG-Ace cannot move to a newer Vitest, because langium-tools 0.4.0 fixes the version as a peer dependency. Fixed versions of Vitest exist (2.1.9 or newer, 3.2.6 or newer). This needs a new release of langium-tools.
2. **Three bugs in langium-tools 0.4.0 were confirmed** in its source, and the first one was reproduced. The issue texts are in [langium-tools issues](2026-11-21-langium-tools-issues.md).
3. **The new website examples parse.** The examples for `rename column` and `phase: finish` were written after the parser existed and were accepted without a change to the parser.

## Changes made during the review

- **Website:** the page on zero-downtime changes now describes the `start` and `finish` phases and one `rename column` statement. The two examples with `expand column` and `contract column` are gone. This closes question 24.
- **Test:** `migql/test/examples/website.test.ts` had the number of website examples fixed in it and a list of two skipped examples. The numbers were updated and the list is empty.
- **Licence:** Apache License 2.0, see [the decision](../decisions/apache-license.md).

## Recommendations on the open language questions

These are recommendations to the project owner. None of them is decided.

| Question | Recommendation |
|---|---|
| 25 `upsert` | Use the YAML form now described in [Snippets](../architecture/snippets.md). |
| 26 `former-names`, `before`, `after` | Leave them out until the work on ordering starts. References by slug and the release order may make them unnecessary. |
| 27 comment after a one-line statement | Keep it allowed. YAML and MigQL read it the same way, so the rule "reject what YAML reads differently" is not touched. |
| 28 `?` with `todo` | Keep it. |
| 29 values in flow maps | Accept the proposal: literals and names only. It keeps the two parsers in agreement. |
| 30 quoted names | Accept the proposal: double quotes, as in SQL. |
| 31 lists at the indentation of their key | Keep the rule that a list is indented, and give a clear message. One style is easier to read and to parse. |
| Free text in quotes | Accept the proposal: an error with advice. |
| Fixed words as keywords (`fill`, `phase`, `requires-downtime`) | Accept. No snippet changes. |
| Spelling of a type change | Keep both spellings. PostgreSQL accepts both, and the longer one is standard SQL. |
