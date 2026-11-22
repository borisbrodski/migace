# column-set-not-null

Makes a column mandatory without blocking the table while its rows are read.

## Result

The column is `not null`. Every row must have a value before; fill the rows in an earlier part.

## Parameters

| Parameter | Meaning |
|---|---|
| `table` | The table of the column. |
| `column` | The column that becomes mandatory. |

## PostgreSQL

Four steps:

1. A check constraint `<table>_<column>_not_null` that says the column is not null, added as not valid.
2. The validation of that constraint.
3. `alter table … alter column … set not null`. PostgreSQL sees the valid constraint and does not read the table again.
4. The removal of the constraint.

## Locks

Steps 1, 3 and 4 take the strong lock on the table for a moment. Step 2 reads all rows under a lock that lets everybody read and write.

## After a failure

- Step 1 fails if a constraint with the helper name exists already. Nothing is changed then.
- Step 2 fails if a row has no value. The helper constraint stays, not valid. Fill the rows and run again; the run continues with step 2.
- After a failure in step 3 or 4 the next run continues there.

## Notes

- The plain statement `alter table … alter column … set not null` under `do` is one step. It reads the whole table under the strong lock.
