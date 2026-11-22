---
type: journal
date: 2026-11-22
milestones: [M4.1, M4.2, M4.3]
---

# Proof of the tests, and coverage limits

The owner asked three things after M4.3: why the Java runner was not written test-first, whether the tests notice a broken implementation, and for enforced coverage. This note holds the answers and what was found.

## Why the Java runner was not test-first

It was a mistake of the session, not a decision. The reference runner in TypeScript existed and passed the contract cases. The Java library was written as a translation of it, together with its tests, and all 42 tests passed at the first run. A test that never failed proves nothing. The rule in `CLAUDE.md` now says that test-first holds for every language.

## Proof 1: mutation testing of the Java runner (PIT)

- First run: 109 changes, 93 noticed, **85 %**. Sixteen changes were not noticed.
- What the sixteen showed:
  - No test read the messages of a wrong call of the program: an unknown option, a second script file, a script file that cannot be read.
  - No test called the program without the user, or without the script.
  - No test looked at what a guard error says: which line, and what the guard returned.
  - No case had a guard at the end of a script.
  - No test chained two parameters.
  - A parameter of `send` was not needed.
- Tests were written for each, and seen to fail where the code had to change. Six Java tests and one contract case were added; four cases became stricter.
- Now: 105 changes, 101 noticed, **96 %**. The four that remain are listed with their reasons in `clients/java/README.md`.

## Proof 2: breaking the SQL of the script

- Most logic of a migration is SQL inside `databases/postgresql/src/script.ts`. A mutation tool sees it as text. `tools/break-the-script.mjs` breaks eleven rules, one at a time, and runs the script tests and then the server tests.
- **First attempt: misleading.** All eleven were "noticed", but by the stored expected script, which fails on any change of the text. The tool now rewrites the stored texts during the series and restores them, so only tests of behaviour count.
- **Second attempt: ten of eleven.** Not noticed: a part of several steps counts as "ran" when only its first step is done. `ran` conditions and the state of a snippet depend on it.
- A test was added (`a part of several steps that stopped at a later step has not run`). All eleven are noticed now: eight by the tests on PGlite, three only by the tests on a real server (the open transaction of a waiting run, the lock time limit, the number of lock attempts).

## Proof 3: mutation testing of TypeScript (Stryker)

- `core/` alone: 338 changes, 320 noticed, **94.7 %**. Seventeen of the eighteen that survive are in `compare.ts`. They were not worked through.
- All packages: about 4,200 changes. The run with 19 test processes was stopped by the system because memory ran out. **No full run has finished.** The configuration is in `stryker.config.mjs`, now with 4 processes. See open question 55.
- Stryker writes a comment into every file unless `disableTypeChecks` is off. One test compares a generated file with its source and failed because of it.

## Coverage

| | Lines | Branches | Functions | Limit |
|---|---|---|---|---|
| TypeScript, all packages | 99.48 % | 95.44 % | 99.66 % | 99 / 95 / 99 |
| Java runner | 94.5 % | 93.2 % | | 94 / 93 |

- TypeScript is measured in one run over all packages (`vitest.coverage.config.ts`). Per package the numbers mislead: the script of `databases/postgresql/` is tested from `migql/`, and alone that package shows 57 %.
- Both checks were seen to fail with a limit above the level.
- The workflow runs `npm run test:coverage`. The Java limits are part of `npm test` through `./gradlew check`.
- One test of the script timed out once in the first measured run and passed in every later one. The measured run has a time limit of 30 seconds per test.

## Changes to the contract

- A guard without a statement names the line of the guard, also at the end of a script (case 23).
- A guard error names the line of the statement and says what the guard returned (cases 08 to 10).
- A case file had a wrong number in its name (`010-…`); it is `10-…` now.

## Published

- Website: the page "How MIG-Ace is tested" (`website/src/pages/docs/quality.md`), in the navigation under Reference. It goes live with the next push to `main`.
- `README.md`: the section "Tests, coverage and proof".

## Found on the way

- `when: ran a.p` in a snippet that sorts before `a` is accepted. See open question 56.
- The website needs a newer Node (22.23.4) than the tool (22.22.2).

## Not done

- A full Stryker run, and work on the survivors in `compare.ts`.
- Windows: still not checked.
