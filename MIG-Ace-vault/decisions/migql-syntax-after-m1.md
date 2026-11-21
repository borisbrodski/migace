---
type: decision
status: decided
date: 2026-11-21
---

# MigQL syntax decisions after the first implementation

## Context

The first implementation of the parser raised seven questions and six proposals about the syntax. They are listed in the [session note](../journal/2026-11-21-workspace-and-migql-parser.md). The [review](../journal/2026-11-21-review-of-m0-and-m1.md) gave a recommendation for each, and the project owner accepted all of them.

## Decision

| Topic | Decision |
|---|---|
| Values in a flow map | Only a literal, a name or `table.column`. Anything else is written in the block form. YAML and MigQL then always read a flow map the same way. |
| Free text in quotes | A text value that starts with a quote is an error, with the advice to remove the quotes or to use a literal block. |
| Names that are keywords | Written in double quotes, as in SQL: `"index"`. |
| A list at the indentation of its key | Not allowed. A list is indented below its key. The error says so. |
| `fill`, `phase`, `requires-downtime` | Their values are keywords of the grammar, so the editor offers them. |
| Change of a column type | Both spellings stay: `alter column c type t` and `alter column c set data type t`. |
| Comment after a one-line statement | Allowed. YAML and MigQL read it the same way. |
| `?` in a statement | Stands for a value that is not decided yet. Allowed only in a part with a `todo`. |
| `upsert` | The YAML form with `into`, `key` and `rows`, see [Snippets](../architecture/snippets.md). |
| `former-names`, `before`, `after` | Left out until the work on ordering starts. |

## Rejected alternatives

- Expressions as values in a flow map: YAML splits them at commas and rejects some, so the two parsers disagree.
- One spelling for a type change: PostgreSQL accepts both, and removing one would only surprise authors.
- Lists at the indentation of their key: allowed by YAML, but one style is easier to read and to parse.
