# constraint-add-check

Adds a check constraint without blocking the table while its rows are checked.

## Result

The check constraint exists and is valid. Every row must fulfil the condition.

## Parameters

| Parameter | Meaning |
|---|---|
| `name` | The name of the constraint. The second step needs it. |
| `table` | The table that gets the constraint. |
| `check` | The condition that every row must fulfil, for example `price_cents >= 0`. An expression is written in the block form. |

## PostgreSQL

Two steps:

1. The constraint is added as not valid. New and changed rows are checked from now on.
2. The validation of the constraint checks the rows that exist.

## Locks

Step 1 takes the strong lock on the table for a moment. Step 2 reads the rows under a lock that lets everybody read and write.

## After a failure

- Step 2 fails if a row does not fulfil the condition. The constraint stays, not valid. Correct the rows and run again; the run continues with step 2.

## Notes

- The plain statement `alter table … add constraint … check (…)` under `do` is one step. It checks all rows under the strong lock.
- State what you assume with `verify-before`, so that the message names the rows that are wrong.
