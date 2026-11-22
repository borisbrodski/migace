---
type: testing
status: direction
---

# Test concept

First plan. It follows the usual structure of a test concept: goals, test objects, levels, types, techniques, data, environments, criteria.

## Goals

1. **Trust.** MIG-Ace changes production databases. A wrong statement destroys data. Every behaviour that reaches a database is tested on a real database.
2. **Stable meaning.** Old snippets keep their meaning. See [Language stability](../migql/stability.md).
3. **Fast feedback.** Most tests run in seconds without a database server.
4. **Runs everywhere.** No test needs Docker. All tests run on Linux, macOS and Windows, including locked-down company machines.

## Test objects

| Object | Folder | Risk |
|---|---|---|
| Grammar, checks, language server | `migql/` | wrong parse, missing error, wrong completion |
| Generators | `migql/generators/<db>/` | wrong SQL |
| Schema model, comparison, fingerprint | `core/` | a difference that is not seen |
| Ordering, release files, compiler | `core/` | wrong order, a change that is not detected |
| Catalog reader, script runtime | `databases/<db>/` | ledger errors, lost resume, wrong phase |
| Commands | `cli/` | wrong files written, unclear messages |
| Runner and build plugins | `clients/` | script sent wrongly, errors swallowed |
| Website examples | `website/`, `examples/bookshop/` | an example that does not work |

## Test levels

| Level | Question | Scope | Database | Where | Runs |
|---|---|---|---|---|---|
| Static tests | Is the code well formed? | type check, lint, grammar ambiguity check, link check of the vault | none | whole repository | every commit |
| Unit tests | Does one unit do its job? | one function or class, no I/O | none | next to the code | every commit |
| Integration tests | Do units work together? | parser + generator; model + PGlite; script + PostgreSQL; runner + PostgreSQL | PGlite, real PostgreSQL | next to the code, `clients/contract/` | every commit |
| System tests | Does the whole tool work? | `mig` commands on a project folder, script on a database | real PostgreSQL | `tests/upgrade-paths/`, `examples/bookshop/` | every push |
| Acceptance tests | Does it do what the spec promises? | user scenarios from the specs, seen from outside | real PostgreSQL | `tests/acceptance/` | every push |

The amounts follow the test pyramid: many unit tests, fewer integration tests, few system and acceptance tests.

### Rules per level

- **Unit:** no file system, no network, no database, no clock. Under 10 ms per test.
- **Integration:** one boundary per test. PGlite where the question is about SQL meaning; real PostgreSQL where it is about locks, transactions, `concurrently` or versions.
- **System:** only through the public surface: commands, files, the script.
- **Acceptance:** each acceptance criterion of a spec has an identifier, for example `M1-AC-03`, and at least one scenario that names it.

## Test types

| Type | What | Level |
|---|---|---|
| Functional | behaviour against the spec | all |
| Regression | every fixed bug gets a test first; golden files for generated SQL and messages | unit to system |
| Compatibility: PostgreSQL | every supported major version | integration, system |
| Compatibility: operating system | Linux, macOS, Windows | system |
| Compatibility: language | the catalogues of all released MIG-Ace versions still give the same SQL | integration |
| Compatibility: ledger | a database with an older ledger format is upgraded by a newer script | system |
| Compatibility: upgrade paths | see [Upgrade-path simulation](upgrade-path-simulation.md) | system |
| Robustness | a run that is killed at every part boundary continues correctly; lock timeouts; two runners at once | system |
| Performance | time limits for parse, compare and proof loop on the bookshop; completion answers within a limit | integration, system |
| Security | identifiers and values cannot inject SQL; secrets never appear in output | unit, integration |
| Usability | error messages are golden files and are reviewed as text | system |

## Techniques

- **Test-driven development.** Code is written in strict test-first cycles, see [Coding rules](../engineering/coding-rules.md). The acceptance criteria of a spec say which tests must exist at the end.
- **The catalogue of constructs.** Each construct has valid snippets, invalid snippets with the expected error, and expected SQL. The expected SQL is a committed snapshot: a normal run compares, a generate run rewrites it and the diff is reviewed. See [Generation](../migql/generation.md).
- **Golden files** for generated SQL, scripts, release files and messages. A changed golden file is always reviewed.
- **Property-based tests** for the schema comparison, the ordering and the checksums. Example: formatting a snippet never changes its checksum.
- **Differential tests.** Two ways to the same result must agree: the MIG-Ace parser and a reference YAML parser; PGlite and real PostgreSQL; installing and migrating.
- **Mutation tests** for `core/` and the generators, to measure whether the tests would notice a wrong change.
- **Fuzzing** of the parser: random input never crashes it and always gives an error with a position.
- **Fault injection** in the script runtime: fail at a chosen part, then run again.

## Test data

- All test data comes from the bookshop example. Nothing comes from a real project.
- Baselines of earlier bookshop releases are built by the tests themselves, not stored as dumps.
- Generated data (property-based tests, fuzzing) uses fixed seeds that are printed on failure.

## Environments and stages

| Stage | Content | Target time |
|---|---|---|
| Commit | static tests, unit tests, integration tests on PGlite | under 2 minutes |
| Push | integration and system tests on real PostgreSQL, acceptance tests, one operating system | under 10 minutes |
| Nightly | all PostgreSQL versions, all operating systems, mutation tests, fuzzing, full upgrade-path simulation | no limit |

Real PostgreSQL runs from binaries as a child process. Snapshots use PostgreSQL template databases.

## Entry and exit criteria

- A milestone starts when its spec exists with numbered acceptance criteria.
- A milestone is done when every acceptance criterion has a passing scenario, all stages are green, and no golden file changed without review.
- Coverage is measured and enforced since 2026-11-22. **[direction]** The limits are the levels reached at that day; they are raised when the coverage rises.
  - TypeScript, all packages in one run (`npm run test:coverage`, `vitest.coverage.config.ts`): lines 99 %, statements 99 %, functions 99 %, branches 95 %. Not counted: the files that Langium writes, and the temporary server, which only the server stage tests.
  - Java runner (`./gradlew check`, JaCoCo): lines 94 %, branches 93 %.
- Mutation score is reported, not enforced. Tools: Stryker (`npm run test:mutation`), PIT (`./gradlew pitest`), and `node tools/break-the-script.mjs` for the SQL inside the migration script, which a mutation tool sees only as text.
- Numbers that are published on the website (`website/src/pages/docs/quality.md`) and in `README.md` are updated together.

## Proposed tools

To be confirmed in the first milestone. **[open]**

| Purpose | Tool |
|---|---|
| TypeScript tests | Vitest, in the version that langium-tools requires |
| Language tests | [langium-tools](../migql/langium-tools.md): matchers, marked text, generator snapshot tests |
| Property-based tests | fast-check |
| Mutation tests | Stryker |
| Java tests | JUnit 5 |
| Acceptance scenarios | folders with a project, a command and the expected result; no extra framework |

## Plan for the first milestones

| Milestone | Tests that come with it |
|---|---|
| M0 Workspace | the three stages exist and run an empty test of each level |
| M1 MigQL parser | the catalogue format; parser tests from the catalogue; differential test against a YAML parser; fuzzing |
| M2 Model | comparison tests on PGlite; property-based tests for the model; fingerprint stability |
| M3 PostgreSQL generation | expected SQL parsed by PostgreSQL's parser; generated SQL run on PGlite |
| M4 Script | script runtime on real PostgreSQL; fault injection; the client contract suite |
| M5 Proof loop | the bookshop as system test; install against migrate |
| M7 Releases and phases | upgrade-path simulation |

## Open

- The format of acceptance scenarios.
- A threshold for the mutation score, and where the full Stryker run happens. See open question 55.
- How performance limits are measured reliably in CI.
