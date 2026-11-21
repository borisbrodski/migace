---
type: journal
date: 2026-11-22
milestones: [M3.1, M4.1, M4.2, M4.3]
---

# Review after M3, and the next specs

Written by the review, for the session that continues the implementation.

## Decided since the last session

| Topic | Decision | Note |
|---|---|---|
| Case in names | A name is exact, with or without quotes. `email` and `Email` are two names. | [Decision](../decisions/names-are-exact.md), [Names and case](../migql/names-and-case.md) |
| `rename column` without a phase | The plain rename is the right form. | [Answers after M3](../decisions/migql-answers-after-m3.md) |
| `create index` | Generated as written. `concurrently` is never added. | same |
| `ensure column` and `numeric` | Widened when the precision grows and the scale stays. | same |
| Key columns of `upsert` | `key: [book_id, currency]`. | same |
| Commits | One commit is one logical change. Larger commits are fine for now. | [Coding rules](../engineering/coding-rules.md) |

The decision on names changes existing code: the generator turns a name without quotes into lower case today. That is the first task.

The answer for `numeric` in `ensure column` is new behaviour too. It is M3.1-AC-25.

## Order of work

1. [M3.1 Exact names](../specs/m3-1-exact-names.md)
2. [M4.1 Plan and script](../specs/m4-1-plan-and-script.md)
3. [M4.2 Real PostgreSQL](../specs/m4-2-real-postgresql.md) and [M4.3 Client contract and Java runner](../specs/m4-3-client-contract-and-java-runner.md), in any order

## What the findings of M3 became

| Finding | Where it goes |
|---|---|
| A failing `set not null` in four steps leaves the helper constraint, and the next run fails at step 1 | M4.1-AC-29: the ledger knows the step, and the next run continues there |
| `alter column … type` fails when a view uses the column | Not in these specs. It is solved with views as replaceable objects (M4.4) |
| How a statement outside a transaction reaches the script | "Inside the script" in [Execution and ledger](../architecture/execution-and-ledger.md), M4.1-AC-36 and 37 |
| Rows of `insert` and `upsert` must give the same columns | Stays an error of the generator for now |

## Direction for the script

The section "Inside the script" in [Execution and ledger](../architecture/execution-and-ledger.md) is new. It says how a script that is sent by an adapter without logic can still record a full error, stop everything after a failure and continue at the right step. It is a direction, not a decision: where a test shows that it does not work, change it and write the reason into that note.

## Checked on PGlite during the review

- `email` and `"Email"` exist side by side in one table.
- `alter table customer rename column key to "Key"` is an ordinary rename.
- `nextval('OrderSeq')` does not find the sequence `"OrderSeq"`; `nextval('"OrderSeq"')` does.
- `order by … collate "C"` sorts `Email`, `Key`, `email`, `id`: upper case first, as the comparison in `core/` does.

## langium-tools

Issues 1 to 4 are reported, see the [note](2026-11-21-langium-tools-issues.md). The two wishes in [langium-tools issues](../migql/langium-tools-issues.md) are not reported yet.
