---
type: journal
date: 2026-11-27
milestones: []
---

# The website is published with the decisions up to 27 November

Written by the review. The project owner asked for the website to be brought up to date and published, with a list of what exists.

## What changed on the website

| Page | Change |
|---|---|
| What exists today (new) | Every feature with its status: built, specified or designed. The three known defects of the built parts. Linked from the banner and the navigation. |
| Conditions, Fixing mistakes | A condition belongs to one part. `ran` names a part. `retired` on a single part. `former-names` for a renamed part or snippet. |
| Views, functions and triggers | Only what changed is replaced; the ledger remembers what was installed; what the application sees meanwhile; the parameter that replaces everything; several databases; the rule for upgrade phases. |
| Running migrations | One schema per run. Limits as parameters. What a failure leaves behind. The fingerprint is recorded, not computed on the server. The calls follow the Java runner as it is built. |
| Configuration, Getting started, The proof loop | MIG-Ace downloads no PostgreSQL. It uses the installed one, from an official source. |
| Statements, Snippets, Glossary | Types with their short names, checksums, the new keys, new terms. |
| The desired schema | The fingerprint comes from the build. Objects of an administrator are left alone. One schema folder per database for a project with several. |

Three examples show syntax that is decided and not built: `retired` on a part and `former-names`. The test of the website examples leaves them out by a list in `migql/test/examples/website-examples.ts`; an entry is removed when the syntax is built.

## The release list, and what was run

From [Stable state and release](../engineering/stable-state-and-release.md). This was a release of the website only: no package is published.

| Step | Result |
|---|---|
| `npm run lint`, `npm test` of the packages and of `tools/` | pass |
| `npm run test:coverage` | 1355 tests pass, no limit missed |
| `npm run test:generate` | no file changed |
| Build of the website, every internal link and anchor of the built pages | 29 pages, no broken link |
| Workflow on Linux, Windows and macOS for the commit that is published | green |
| Private words | none |
| `npm audit` | 19 findings, 4 of them critical. All come through Vitest 2.0.5, which `langium-tools` 0.4.0 fixes, and through Stryker. Nothing of this is shipped; no package exists. The way out is in [langium-tools](../migql/langium-tools.md): take version 0.5.0 and raise Vitest. |
| Oldest PostgreSQL on Linux, by hand | not run. The job starts only from the workflow on `main`; it can run from now on. |
| Mutation testing, a full run | not run for this publication. |
| The server tests and the Java build here | not run here; the workflow runs both on the three systems. |

## What the published code is

`main` now holds the code of M0 to M4.3 and the spec M4.4, which is not built. The three defects of the [review](2026-11-22-review-of-m3-1-to-m4-3.md) are in the published code and are named on the status page.

## Open after this

- Question 66: who checks the schema of a database that is adopted, now that the script computes no fingerprint.
- The page "How MIG-Ace is tested" still says that the tests start PostgreSQL from a package of binaries. That is true for the code as it is. It changes with M4.4.
