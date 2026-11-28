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
