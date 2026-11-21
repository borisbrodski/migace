---
type: language
status: mixed
---

# langium-tools

[langium-tools](https://github.com/borisbrodski/langium-tools) is a library of helpers for Langium projects, by the author of MIG-Ace. MIG-Ace uses it for the code and the tests of the language. **[decided]**

This note describes version 0.4.0, read on 2026-11-21. The library has an `AGENT.md` with the exact rules; read that file before using an API. A worked example is the [statemachine showcase](https://github.com/borisbrodski/langium-tools-showcases).

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

Named targets are not used. With them the runner of version 0.4.0 also expects an empty folder `generated/DEFAULT/`, which git does not keep. See the [journal](../journal/2026-11-21-workspace-and-migql-parser.md).

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

langium-tools 0.4.0 sets these versions. **[direction]**

| Tool | Version |
|---|---|
| Langium | `^4.4.2` |
| Node | `^22.22.2`, `^24.15.0` or `>=26` |
| TypeScript | `>=5.8` |
| Vitest | `~2.0.5`, as a peer dependency |

## Points to settle

1. **Vitest version.** MIG-Ace's Vitest version is fixed by the peer dependency of langium-tools. Vitest 2.0.5 has security advisories, three of them critical; they concern the test runner's own server and user interface. A newer Vitest needs a new release of langium-tools first.
2. **Test helpers in a shipped tool.** langium-tools is one package, and Vitest is its peer dependency. If `cli/` or `migql/` depend on it at run time, installing MIG-Ace asks for Vitest. The roadmap of langium-tools already has the answer: a separate package for the test helpers. MIG-Ace needs that split before its first release.
3. *Settled 2026-11-21:* the invalid examples stay outside the snapshot runner with an `initWorkspace` that loads `dsls/` only.
4. **Generate run on Windows.** `tools/with-env.mjs` sets the variable without a shell feature. It was run on Linux only and has to be tried on Windows.
5. **Prototype extensions.** Importing the string and array helpers adds methods to `String.prototype` and `Array.prototype`. MIG-Ace is itself a library for others, so its shipped code should call the function forms (`toFirstUpper(x)`, `arraySortBy(x, …)`).

## What MIG-Ace may add to langium-tools

MIG-Ace needs these and they are not specific to MIG-Ace. They are candidates for langium-tools, not decisions.

- A test suite driven by folders of valid and invalid examples, like the generator suite but for parsing and validation.
- Markers for completion tests: a cursor marker and the expected proposals.
- A cross-platform switch for the generate run.

## Known problems in 0.4.0

Four problems are reported as issues [#1](https://github.com/borisbrodski/langium-tools/issues/1) to [#4](https://github.com/borisbrodski/langium-tools/issues/4) of langium-tools. A summary is in [langium-tools issues](../journal/2026-11-21-langium-tools-issues.md). When one is fixed, remove its workaround in MIG-Ace.
