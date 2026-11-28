---
type: language
status: mixed
---

# langium-tools

[langium-tools](https://github.com/borisbrodski/langium-tools) is a library of helpers for Langium projects, by the author of MIG-Ace. MIG-Ace uses it for the code and the tests of the language. **[decided]**

This note describes version 0.4.0, read on 2026-11-21, and the changes of version 0.5.0. The library has an `AGENT.md` with the exact rules; read that file before using an API. A worked example is the [statemachine showcase](https://github.com/borisbrodski/langium-tools-showcases).

## Version 0.5.0, taken on 2026-11-28

Version 0.5.0 fixes the issues #1 to #4 in the [journal](../journal/2026-11-21-langium-tools-issues.md). MIG-Ace uses it since 2026-11-28. What changed in MIG-Ace is in the [journal of M4.4](../journal/2026-11-28-m4-4-corrections.md).

- Issue #4: a lexer or parser error is reported once, with its whole range. The test option that hid the second copy is removed. A test in `migql/test/parser/errors.test.ts` holds the fix.
- Issue #3: Vitest is at 5.1.2. `npm audit` went from 19 findings, four of them critical, to 5 moderate ones, all in Stryker.
- Issue #2: named targets would work now. MIG-Ace keeps one sub-folder per database below the default target; see question 69.
- Issue #1: the titles of the snapshot tests are right. Nothing to change in MIG-Ace.

## What MIG-Ace uses

| Part | Import | Used for |
|---|---|---|
| Document issues | `langium-tools/base` | One list of lexer, parser and validation problems with positions. The `mig` commands print it, and message tests compare it. |
| Marked text | `langium-tools/base`, `langium-tools/testing` | A test snippet marks the place where an error is expected. `parseWithMarks` removes the markers and returns their positions. |
| Vitest matchers | `langium-tools/testing` | `toHaveNoErrors`, `toHaveNoIssues`, `toHaveDocumentIssues`, `toContainIssue` for parser and validation tests. |
| Generated content manager | `langium-tools/generator` | Collects generated files in memory, per target, and writes only files that changed. One target per database. |
| Generator snapshot tests | `langium-tools/testing` | Generated SQL is committed. A test run compares; a generate run rewrites the files, and the change is reviewed as a diff. |

Not needed now: the Java helpers in `langium-tools/lang/java`. MIG-Ace generates SQL, not Java.

## How the catalogue of constructs uses it

The snapshot runner expects one folder per test with a `dsls/` folder and writes `generated/`. The catalogue follows that layout. Each database writes into its own folder below `generated/`. **[direction]**

Named targets are not used. With them the runner of version 0.4.0 also expected an empty folder `generated/DEFAULT/`, which git does not keep. Version 0.5.0 corrects this. See the [journal](../journal/2026-11-21-workspace-and-migql-parser.md).

```text
migql/constructs/alter-table-add-column/
├─ construct.md                 meaning and rules, in plain language
├─ dsls/                        valid snippets
├─ generated/
│  └─ postgresql/               expected SQL, written by the generate run
├─ generated-metadata.json      written by the generate run
└─ invalid/                     snippets that must fail, with markers at the expected place
```

- `langiumGeneratorSuite('migql/constructs', …)` turns every construct folder into one test.
- The normal test run verifies. `GENERATOR_TEST=generate` rewrites the expected files.
- Invalid examples are tested with `parseWithMarks` and `toHaveDocumentIssues`.

## What follows for the MIG-Ace tool chain

langium-tools 0.5.0 sets these versions. **[direction]**

| Tool | Version |
|---|---|
| Langium | `^4.4.2` |
| Node | `^22.22.2`, `^24.15.0` or `>=26` |
| TypeScript | `>=5.8` |
| Vitest | `^2.1.9`, `^3.2.6` or `>=4.1.0`, as a peer dependency. MIG-Ace uses `~5.1.2`. |

## Points to settle

1. *Settled 2026-11-28:* the Vitest version. langium-tools 0.5.0 allows current versions, and MIG-Ace uses Vitest 5.
2. **Test helpers in a shipped tool.** langium-tools is one package, and Vitest is its peer dependency. If `cli/` or `migql/` depend on it at run time, installing MIG-Ace asks for Vitest. The roadmap of langium-tools already has the answer: a separate package for the test helpers. MIG-Ace needs that split before its first release.
3. *Settled 2026-11-21:* the invalid examples stay outside the snapshot runner with an `initWorkspace` that loads `dsls/` only.
4. **Generate run on Windows.** `tools/with-env.mjs` sets the variable without a shell feature. It runs on Linux, Windows and macOS in the build since 2026-11-22.
5. **Prototype extensions.** Importing the string and array helpers adds methods to `String.prototype` and `Array.prototype`. MIG-Ace is itself a library for others, so its shipped code should call the function forms (`toFirstUpper(x)`, `arraySortBy(x, …)`).

## Issues found

Two wishes that are not reported yet are written down in [langium-tools: wishes not reported yet](langium-tools-issues.md).

## What MIG-Ace may add to langium-tools

MIG-Ace needs these and they are not specific to MIG-Ace. They are candidates for langium-tools, not decisions.

- A test suite driven by folders of valid and invalid examples, like the generator suite but for parsing and validation.
- Markers for completion tests: a cursor marker and the expected proposals.
- A cross-platform switch for the generate run.

## Known problems

None. The four problems of 0.4.0, issues [#1](https://github.com/borisbrodski/langium-tools/issues/1) to [#4](https://github.com/borisbrodski/langium-tools/issues/4), are fixed in 0.5.0.
