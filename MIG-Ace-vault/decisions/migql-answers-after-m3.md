---
type: decision
status: decided
date: 2026-11-21
---

# MigQL answers after the PostgreSQL generation

## Context

The work on the schema model and the PostgreSQL generation raised four questions about the meaning of statements. They are listed in the [session note](../journal/2026-11-21-m1-1-m2-m3.md). The project owner accepted the proposed answer for each.

## Decision

| Topic | Decision |
|---|---|
| `rename column` in a run without a phase | The plain `alter table … rename column` is the form for a run without a phase. The form with a second column and a sync trigger is generated for `start` and `finish`, see [Upgrade phases](../architecture/upgrade-phases.md). |
| `create index` and `concurrently` | MIG-Ace generates what the author wrote. It never adds `concurrently` on its own. `mig make` writes `concurrently` by default. The zero-downtime check reports a plain `create index` on a table that exists before the snippet. |
| A type with details in `ensure column` | The length of `varchar` and `char` can grow. A `numeric` is widened when the precision grows and the scale stays the same. Every other difference in the details of a type is an error for now. |
| A list of key columns in `upsert` | `key: [book_id, currency]`, a YAML flow list of names. One column is written without brackets: `key: code`. |

## Changed on 2026-11-22

`rename column` and `ensure column` are no longer statements under `do`. They are the actions `column-rename` and `column-ensure`, see [`do` runs what was written](do-is-literal-actions-have-names.md). The two answers above hold for the actions.

## Rejected alternatives

- Adding `concurrently` to every `create index`: the statement then cannot run in a transaction, and an author who wrote the plain form on a new or small table gets a slower and less safe script than the one written. The choice stays visible in the snippet.
- Waiting with `rename column` until the phases exist: a project that stops the application for an upgrade needs the plain form anyway.
- Widening a `numeric` when the scale changes: stored values are rounded or the table is rewritten. That is a change of data, not a widening.
