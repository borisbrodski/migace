---
type: journal
date: 2026-11-21
---

# Issues for langium-tools

Four issues for [langium-tools](https://github.com/borisbrodski/langium-tools), version 0.4.0. Each was checked against the source of langium-tools. They were posted on 2026-11-21:

| Issue | Topic |
|---|---|
| [#4](https://github.com/borisbrodski/langium-tools/issues/4) | `getDocumentIssues` returns lexer and parser errors twice |
| [#2](https://github.com/borisbrodski/langium-tools/issues/2) | named targets need an empty `generated/DEFAULT` folder |
| [#1](https://github.com/borisbrodski/langium-tools/issues/1) | snapshot tests are titled "(generating)" in the comparing run |
| [#3](https://github.com/borisbrodski/langium-tools/issues/3) | the peer dependency on Vitest 2.0.5 |

The texts below are the drafts. The issues on GitHub are the current version.

## 1. getDocumentIssues returns lexer and parser errors twice after validation

**What happens.** After a document was validated, `getDocumentIssues(document)` returns every lexer or parser error twice: once with source `PARSER` or `LEXER` and without an end position, once with source `VALIDATION` and the full range.

**How to reproduce.** Parse and validate a document with one syntax error, then call `getDocumentIssues`. Result for one misspelled keyword:

```json
[
  { "source": "PARSER",     "startLine": 4, "startColumn": 17, "message": "Expected \"from\", but found \"form\"." },
  { "source": "VALIDATION", "startLine": 4, "startColumn": 17, "endColumn": 21, "message": "Expected \"from\", but found \"form\"." }
]
```

**Expected.** One issue per problem.

**Cause.** Langium's `DocumentValidator` copies lexer and parser errors into `document.diagnostics`. Such a diagnostic carries `data.code` with the value `DocumentValidator.LexingError` (`lexing-error`) or `DocumentValidator.ParsingError` (`parsing-error`). `getDocumentIssues` in `src/base/document-issues.ts` reads the errors from `document.parseResult` and then reads all of `document.diagnostics`, so these errors are added a second time.

**Possible fix.** When reading `document.diagnostics`, handle diagnostics with these two codes separately. Either skip them, or prefer them and drop the copy from `parseResult`. The second option also gives parser errors a reliable end position.

**Workaround in use.** Tests pass `{ ignoreLexerErrors: true, ignoreParserErrors: true }` to the matchers and check the diagnostic only.

## 2. Generator snapshot tests with named targets need an empty generated/DEFAULT folder

**What happens.** `langiumGeneratorSuite(dir, options, targets)` with named targets also treats the default target as a target of its own. For every test folder it expects a folder `generated/DEFAULT/` and a file `DEFAULT-metadata.json`. A generator that writes only to its named targets leaves `generated/DEFAULT/` empty. Git does not keep empty folders, so the comparing run fails in a fresh clone.

**Cause.** In `src/testing/generator-testing.ts`, `dirsAndTargets` is built from `generatedContentManager.getTargets()`. `GeneratedContentManager` always registers `DEFAULT_TARGET` in its constructor, so it is returned together with the named targets. In the comparing run, `verifyFiles` calls `fs.readdirSync` for `generated/DEFAULT`, which throws when the folder does not exist.

**Expected.** A target without generated content needs no folder and no metadata file.

**Possible fix.** In `verifyFiles`, treat a missing folder as an empty one. Or leave the default target out when named targets are given and nothing was generated for it.

**Workaround in use.** No named targets. The generator writes into sub-folders of the default target, for example `generated/postgresql/`.

## 3. Generator snapshot tests are titled "(generating)" in the comparing run

**What happens.** The tests created by `langiumGeneratorSuite` are titled `DSL-Workspace "<name>" (generating)` in the comparing run. In the generate run the suffix is missing. It is the wrong way round.

**Cause.** In `src/testing/generator-testing.ts` the title uses `generateMode ? ' (generating)' : ''`. The enum is `GeneratorMode { Generate, Verify }`, so `Generate` is `0` and false, and `Verify` is `1` and true.

**Possible fix.** `generateMode === GeneratorMode.Generate ? ' (generating)' : ''`.

## 4. The peer dependency on Vitest 2.0.5 keeps users on a version with security advisories

**What happens.** `package.json` declares `"vitest": "~2.0.5"` as a peer dependency. A project that uses langium-tools cannot install a newer Vitest. `npm audit` in such a project reports critical advisories for Vitest 2.0.5 (GHSA-9crc-q9x8-hgqq, GHSA-5xrq-8626-4rwp) and further ones for Vite, tinypool and esbuild, which that version brings along.

**Expected.** A project can use a Vitest version without known advisories.

**Possible fix.** Widen the peer range to current Vitest versions and test against them. The planned split into a separate package for the test helpers would also keep Vitest away from projects that use only the other parts.

This fourth issue was found in the review, not in the implementation session.
