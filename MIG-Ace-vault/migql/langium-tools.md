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

The snapshot runner expects one folder per test with a `dsls/` folder and writes `generated/`. With named targets it writes `generated/<target>/` and `<target>-metadata.json`. The catalogue follows that layout, with one target per database. **[direction]**

```text
migql/constructs/alter-table-add-column/
├─ construct.md                 meaning and rules, in plain language
├─ dsls/                        valid snippets
├─ generated/
│  └─ postgresql/               expected SQL, written by the generate run
├─ postgresql-metadata.json     written by the generate run
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

1. **Vitest version.** MIG-Ace's Vitest version is fixed by the peer dependency of langium-tools. A newer Vitest needs a new release of langium-tools first.
2. **Test helpers in a shipped tool.** langium-tools is one package, and Vitest is its peer dependency. If `cli/` or `migql/` depend on it at run time, installing MIG-Ace asks for Vitest. The roadmap of langium-tools already has the answer: a separate package for the test helpers. MIG-Ace needs that split before its first release.
3. **Invalid examples and the snapshot runner.** The runner loads a whole folder and fails on parse errors. The invalid examples must stay outside what it loads: another file extension, or an `initWorkspace` that loads `dsls/` only.
4. **Generate run on Windows.** `GENERATOR_TEST=generate vitest run` does not work in the Windows command shell. MIG-Ace needs a script that sets the variable on every system.
5. **Prototype extensions.** Importing the string and array helpers adds methods to `String.prototype` and `Array.prototype`. MIG-Ace is itself a library for others, so its shipped code should call the function forms (`toFirstUpper(x)`, `arraySortBy(x, …)`).

## What MIG-Ace may add to langium-tools

MIG-Ace needs these and they are not specific to MIG-Ace. They are candidates for langium-tools, not decisions.

- A test suite driven by folders of valid and invalid examples, like the generator suite but for parsing and validation.
- Markers for completion tests: a cursor marker and the expected proposals.
- A cross-platform switch for the generate run.
