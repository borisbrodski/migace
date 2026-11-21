---
type: language
status: open
---

# langium-tools: wishes not reported yet

Two wishes for [langium-tools](langium-tools.md) that came up while MigQL was built. They are not specific to MIG-Ace. Each one is written so that it can be copied into the issue tracker of [langium-tools](https://github.com/borisbrodski/langium-tools/issues) as it is.

The bugs found in version 0.4.0 are reported already. They are listed in the [journal](../journal/2026-11-21-langium-tools-issues.md) as issues #1 to #4.

| # | Kind | Title | Reported |
|---|---|---|---|
| 1 | Feature | Test suite driven by folders of valid and invalid examples | no |
| 2 | Feature | Switch to generate mode that works on every operating system | no |

MIG-Ace has both for itself: `migql/test/constructs/catalogue.test.ts` and `tools/with-env.mjs`.

## 1. Test suite driven by folders of valid and invalid examples

### Idea

A counterpart of `langiumGeneratorSuite` for parsing and validation. A language keeps its examples as files, and one call turns them into tests:

```text
constructs/alter-table-add-column/
├─ dsls/       every file must parse and validate without issues
└─ invalid/    every file must fail at the marked places
```

An invalid example carries its expectation in the file:

```text
# expect: Expected a name, but the value ends here.
…
      do: alter table customer add column loyalty_level<<{||}>>
```

One `# expect:` line per marker, in the order of the markers. The suite strips the markers with `parseWithMarks` and checks with `toHaveDocumentIssues`.

### Why

- The examples are the specification of the language and its tests at the same time.
- The same folders can feed the generator snapshot suite (`dsls/` only).
- Adding a case needs no test code.

### Open points

- The comment sign of the expectation lines depends on the language. It could be an option, or the expectations could live in a file beside the example.
- Severity and source of an expected issue (default: error, any source).

## 2. Switch to generate mode that works on every operating system

`GENERATOR_TEST=generate vitest run` is the documented way to rewrite the snapshots. This form of setting a variable does not work in the Windows command shell, so a `package.json` script written this way runs on Linux and macOS only.

Ideas:

- a small command shipped with the package, for example `langium-tools-generate -- vitest run test/generator`, that sets the variable and starts the given command
- or a documented way without an environment variable, for example a Vitest project or config that sets `generateMode: GeneratorMode.Generate`

Today every project needs its own helper script or the `cross-env` package.
