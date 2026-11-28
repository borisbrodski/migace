---
type: journal
date: 2026-11-28
milestones: [M4.4]
---

# M4.4 Corrections

What was found and chosen while [M4.4](../specs/m4-4-corrections.md) was built.

## Before the work: langium-tools 0.5.0 and Vitest 5

The steps in [langium-tools](../migql/langium-tools.md) were done first.

| | Before | After |
|---|---|---|
| langium-tools | 0.4.0 | 0.5.0 |
| Vitest and its coverage | 2.0.5 | 5.1.2 |
| Stryker | 8.7.1 | 10.1.1 |
| `npm audit` | 19 findings, 4 critical | 5 moderate, all brought by Stryker 10 (`minimatch`, `qs`), no fix available |

- **Issue #4 is fixed.** With 0.5.0, 77 tests failed at first: they asked to ignore parser errors, which until then came twice, and now there was nothing else. The option is removed, and the helper `error()` no longer names the source. A new test says that a syntax error comes once, from the parser, with its whole range.
- **The coverage of branches fell from 95.4 % to 93.9 %** with no change of the code. Since Vitest 4 the branches are counted from the syntax tree, not from V8's byte ranges. The limit is now 93 %, with the reason in `vitest.coverage.config.ts`. The option `all` no longer exists; `include` decides which files are counted.
- **Vitest 5 hides what a passing test prints.** The timing line of the bookshop on the server appears only with `--silent=false`.

## The bookshop before the changes (M4.4-AC-15)

Measured on 2026-11-28, before the first correction, on this computer (Linux, PostgreSQL 18.7 from the package that M4.4 removes), five runs:

| | Value |
|---|---|
| Statements of the bookshop script | 58 |
| Lines of the script | 561 |
| First run | 36 to 51 ms, middle value 44 ms |
| Second run | 16 to 23 ms, middle value 17 ms |

## One schema, nothing shared (M4.4-AC-01 to 05)

- **The parameter is `migace.other_schemas`**: further schemas, separated by commas. The search path of a run is the schema of the migration and these, nothing else.
- **The bookshop's `pg_trgm` now lives in a schema `extensions`** in every test database, on PGlite and on the real server. The bookshop run names it with `other_schemas`. Without it, the title-search index fails with `operator class "gin_trgm_ops" does not exist`, and a test shows it.
- **The ledger tables are named with their schema.** The schema is known only when the script runs, so a statement that names them is the text of an `execute` with the name put in. A hand-made break that drops the schema from the names is caught by the test of M4.4-AC-04.
- **The lock key** is `MIGA` in the upper 32 bits and the `oid` of the schema in the lower 32 bits. To show that the old key, `hashtext('migace ' || schema)`, could be shared, 300 000 names were hashed on PGlite. `tenant_28465` and `tenant_132194` have the same hash. The test of M4.4-AC-05 uses these two names: with the old key the run on the second schema waited 2.3 s for the first; with the new one it does not wait.
- Three of the five new tests fail on the code before M4.4. The other two, M4.4-AC-04 and AC-05 with ordinary names, passed already; AC-04 is held by the hand-made break, AC-05 by the two colliding names.

## What a run leaves in its session (M4.4-AC-06 to 10)

- **The contract has a new marker, `-- @migace finally`.** The statements after it are sent also after an error. An error among them is passed over: the runner sends the next one and reports the first error of the run. The format number stays 1, because no runner of format 1 was released. Seven new cases (24 to 30); the reference runner and the Java runner pass all 30.
- **The script's last part** sets the search path, `lock_timeout` and `statement_timeout` back to what the session had, releases its own lock (and no lock of the application), drops its functions in `pg_temp`, and empties every setting of the run.
- **Placeholder settings are not listed in `pg_settings`.** `migace.failed` and the others cannot be found by a query, so the script keeps one list, `RUN_SETTINGS`, and empties each by name. A test checks that every setting the script names is in the list.
- **Every run in the PGlite tests now checks its session.** The tests share one session, like the connections of a pool. Until now the helper released all locks and reset the search path after every run, and so hid finding 4. Without that help, 35 of 38 script tests failed on the old script; they all pass now.
- **A leftover parameter leaked into the next run.** A test that ran the bookshop without `other_schemas` passed when it ran alone and failed after the others: the value of an earlier run was still in the session. It passes now in both orders.
- **The Java tests did not run again when a case changed.** Gradle did not know the folder of cases, so it called `test` up to date after seven new cases. The folder is now an input of the task.
- M4.4-AC-10 is shown for the Java library with a scripted pool of one connection: after a failure the last part is sent before the connection is given back, and the next run uses it. What the database keeps is shown by M4.4-AC-09 on a real server.
