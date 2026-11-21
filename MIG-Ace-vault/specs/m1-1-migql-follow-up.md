---
type: spec
status: ready
milestone: M1.1
---

# M1.1 MigQL follow-up: Windows, checks across a project, syntax decisions

## Goal

Close what M0 and M1 left open, add the checks that need all snippets of a project, and apply the syntax decisions taken after M1.

## Non-goals

- The keys `former-names`, `before` and `after`. They are deferred.
- Generating SQL. That is M3.

## Builds on

- [Session note](../journal/2026-11-21-workspace-and-migql-parser.md) and [review](../journal/2026-11-21-review-of-m0-and-m1.md)
- [MigQL syntax decisions after the first implementation](../decisions/migql-syntax-after-m1.md)
- [Snippets](../architecture/snippets.md), for `upsert`
- [Ordering, changes and releases](../architecture/ordering-and-releases.md), for slugs
- [Coding rules](../engineering/coding-rules.md)

## Order of work

1. Windows.
2. Loading a project.
3. Checks across a project.
4. `upsert`.
5. Syntax decisions.

## Acceptance criteria

### Windows

- **M1.1-AC-01** The workflow runs build, lint and tests on Linux and on Windows for every push. This closes M0-AC-06.
- **M1.1-AC-02** The workflow runs `npm run test:generate` on both systems and fails if a file changed afterwards. This closes M0-AC-04 and proves that the committed expected files are current.
- **M1.1-AC-03** Expected files and snippets have the same content on both systems. Line endings do not change a comparison.

### Loading a project

- **M1.1-AC-04** One call loads every `*.migql.yaml` file below a folder as one project. Files in sub-folders are found.
- **M1.1-AC-05** A file that cannot be parsed does not stop the others. All problems of all files are reported together, each with its file.

### Checks across a project

- **M1.1-AC-06** Two snippets with the same slug are an error. The error appears in both files and names the other file.
- **M1.1-AC-07** Two snippets with the same `uid` are an error, in the same way.
- **M1.1-AC-08** `ran <slug>.<part>` is linked to the snippet and the part in another file. A slug that no snippet has is an error. A part that the snippet does not have is an error that lists its parts.
- **M1.1-AC-09** A snippet that refers to itself with `ran` is accepted.
- **M1.1-AC-10** The checks run again for the snippets that are affected when one file changes. A test changes a slug and sees the error appear in the other file.

### `upsert`

The form is defined in [Snippets](../architecture/snippets.md).

- **M1.1-AC-11** `upsert` with `into`, `key` and `rows` parses. `key` is one column or a list of columns.
- **M1.1-AC-12** A row without a value for a key column is an error at that row.
- **M1.1-AC-13** `upsert` has a folder in the catalogue with valid and invalid examples. This closes M1-AC-08.

### Syntax decisions

- **M1.1-AC-14** A value in a flow map is a literal, a name or `table.column`. Anything else is an error that advises the block form. The comparison with the YAML parser then has no exception for flow maps.
- **M1.1-AC-15** A text value that starts with a quote is an error that advises to remove the quotes or to use a literal block. This holds for `doc`, `stop`, `changed`, `retired` and `todo`.
- **M1.1-AC-16** A name in double quotes is accepted wherever a name is allowed, and it may be a keyword. A keyword used as a name without quotes gives an error that advises the double quotes.
- **M1.1-AC-17** A list at the indentation of its key is an error that tells the author to indent the list.
- **M1.1-AC-18** The values of `fill`, `phase` and `requires-downtime` are keywords of the grammar. Completion offers them.
- **M1.1-AC-19** Tests that name this criterion fix three behaviours that exist already: both spellings of a type change give the same syntax tree; a comment after a one-line statement is accepted; `?` is accepted only in a part with a `todo`.

## Open points

- The security advisories of Vitest 2.0.5 cannot be closed here. They need a new release of langium-tools.
