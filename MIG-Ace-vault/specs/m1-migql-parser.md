---
type: spec
status: ready
milestone: M1
---

# M1 MigQL: parser and checks

## Goal

`migql/` parses complete snippet files (`*.migql.yaml`) and reports every problem with an exact position and a message that tells the author what to do.

The milestone also answers an open question: can one Langium grammar carry the YAML envelope and the statements, with literal blocks, values that are read differently depending on their key, and good error recovery?

## Non-goals

- Generating SQL. That is M3.
- Knowing tables and columns. Names are parsed, not looked up. That needs the schema model.
- Editor features beyond what Langium gives without extra work.
- The file `schema.json`, formatting, and renaming.
- Control flow inside a part.

## Builds on

Read these first. Where they disagree with the website, the vault is right.

- [MigQL overview](../migql/overview.md)
- [YAML profile](../migql/yaml-profile.md)
- [Statement language](../migql/statement-language.md)
- [Snippets: files, structure, test data](../architecture/snippets.md)
- [Generation](../migql/generation.md), for the layout of the catalogue of constructs
- [langium-tools](../migql/langium-tools.md)
- [Coding rules](../engineering/coding-rules.md)

The website shows the intended syntax with many examples: `website/src/pages/docs/snippets.md`, `statements.md`, `data-migrations.md`, `conditions.md`, `test-data.md`, `native-sql.md`, `complete-example.md`.

## Starting points

Hints, not requirements.

- Langium has an indentation-aware token builder and lexer for languages that nest by indentation. See the [Langium recipe](https://langium.org/docs/recipes/lexing/indentation-sensitive-languages/). Evaluate it first.
- A value is read differently depending on its key: free text after `doc:`, a statement after `do:`. This probably needs lexer modes or a custom token builder.
- A statement inside a literal block may be indented freely. The block ends where the indentation falls back.

## Order of work

Each step is a slice that works from file to result. Inside each step, work in test-first cycles.

1. Envelope: mappings, sequences, comments, plain values, nesting by indentation.
2. Snippet structure: top-level keys and parts.
3. Literal blocks, and values that depend on their key.
4. Statements that change the schema.
5. Statements that change rows, and expressions.
6. Conditions and verification.
7. Test data and the remaining keys.
8. Error messages and recovery.
9. The examples of the website, the comparison with a YAML parser, random input.

## Acceptance criteria

### Envelope

- **M1-AC-01** A file with `migration`, `uid` and one part with one `do` parses without problems.
- **M1-AC-02** Comment lines, comments after a value, and blank lines are accepted between all entries.
- **M1-AC-03** A tab in the indentation is an error that names the tab and its position.
- **M1-AC-04** Each YAML construct that MigQL does not support gives an error that names the construct: anchors, aliases, tags, several documents, folded `>` blocks, plain values over several lines, quoted keys.
- **M1-AC-05** A flow map on one line, such as `{ state: 'open' }`, parses where the format allows it.

### Structure

- **M1-AC-06** A snippet has exactly one of `migration` and `repair`. An unknown top-level key is an error that lists the allowed keys. A key that appears twice is an error at the second place.
- **M1-AC-07** The name has the form `YYYYMMDD-HHMM-slug`. The file name must be the name plus `.migql.yaml`.
- **M1-AC-08** A part has exactly one operation: `do`, `insert`, `upsert`, `native` or `stop`. None or two is an error at the part name.
- **M1-AC-09** Part names are unique in a snippet.
- **M1-AC-10** The keys beside the operation are accepted: `when`, `verify-before`, `verify-after`, `batch`, `expect-rows`, `phase`, `todo`. `phase` accepts only `finish`. Any other key is an error.

### Values

- **M1-AC-11** The value of `doc` is free text, on one line or as a literal block.
- **M1-AC-12** The same statement on one line and in a literal block gives the same syntax tree, apart from positions.
- **M1-AC-13** A statement in a literal block may span lines and be indented freely.
- **M1-AC-14** A statement on one line that a YAML parser would read differently is an error that advises a literal block. This covers ` #`, `: `, and a first character such as `@`, `*`, `{` or a quote.

### Statements

- **M1-AC-15** Each of these constructs has a folder in `migql/constructs/` with `construct.md`, at least two valid and two invalid examples, and parses: `create-table`, `alter-table-add-column`, `alter-table-drop-column`, `alter-table-alter-column`, `alter-table-add-constraint`, `create-index`, `drop-table`, `drop-index`, `ensure-column`, `rename-column`, `update`, `delete`, `insert-values`, `insert-select`.
- **M1-AC-16** Expressions parse with the usual precedence: literals, names with and without table, arithmetic, `||`, comparisons, `and`, `or`, `not`, `is null`, `in`, `between`, `like`, `case`, `cast`, function calls, a scalar subquery, `exists`.
- **M1-AC-17** Keywords and unquoted names are not case-sensitive.
- **M1-AC-18** `next value for <sequence>` parses.

### Conditions

- **M1-AC-19** `when` accepts a boolean expression, the state conditions (`column t.c exists`, `table t exists`), the history condition `ran <slug>.<part>` with the optional `from <release>`, and names defined in `let`.
- **M1-AC-20** `verify-before` and `verify-after` accept a boolean expression, or a list with `all`, `none`, `exists` and `single`.
- **M1-AC-21** A name that `let` does not define is an error. A definition that refers to itself, directly or through others, is an error.

### Test data and other keys

- **M1-AC-22** `testdata` and `testdata-before` accept entries with `table`, `fill` (`all` or `required`) and `row`.
- **M1-AC-23** The `insert` key in YAML form gives the same operation as the equal `do: insert …`.
- **M1-AC-24** `native` has one entry per database. Its content is kept as text and is not parsed.
- **M1-AC-25** `stop`, `batch` (`<number> by <column>`) and `expect-rows` parse.

### Errors

- **M1-AC-26** Every error has a line, a column and a length that cover the wrong token. The tests use marked text.
- **M1-AC-27** A syntax error in one part does not hide a syntax error in a later part. A file with two broken parts reports both.
- **M1-AC-28** An error inside a literal block is reported at its place in the file, not relative to the block.

### Examples, comparison, random input

- **M1-AC-29** Every example on the website that shows snippet content parses without errors. The test reads the examples from `website/src/pages/` at run time. On 2026-11-21 these were 17 complete snippets, 30 fragments with parts and 15 fragments with single keys; fragments are placed into a minimal snippet first. The 11 examples of settings and release files are skipped.
- **M1-AC-30** Every valid file of the catalogue and of M1-AC-29 is accepted by a reference YAML parser, and both parsers see the same keys, the same list lengths and the same values.
- **M1-AC-31** A thousand random changes to valid files never crash the parser and never make it hang. Each result is either a clean parse or at least one problem with a position. The random seed is printed on failure.

### Result of the evaluation

- **M1-AC-32** A journal note says how literal blocks, key-dependent values and error recovery were solved, and what the limits are. Open question 9 is closed.
- **M1-AC-33** The time to parse a snippet of 500 lines is measured and written into the journal. There is no limit yet.

## When an example on the website does not parse

- If the example is wrong, correct the example.
- If it shows syntax that the vault does not define, do not guess. Write the question into [Open questions](../questions/open-questions.md) and skip that example with a visible note in the test.

## Open points

- The exact list of functions that expressions may call.
- Whether names may be quoted, and how.
