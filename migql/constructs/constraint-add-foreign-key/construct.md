# constraint-add-foreign-key

Adds a foreign key without blocking the table while its rows are checked.

## Result

The foreign key exists and is valid. Every row must point to an existing row of the other table.

## Parameters

| Parameter | Meaning |
|---|---|
| `name` | The name of the constraint. The second step needs it. |
| `table` | The table that gets the foreign key. |
| `columns` | The column that points to the other table, or a list of columns: `[book_id, currency]`. |
| `references` | The table that is pointed to. |
| `referenced-columns` | Optional. The columns of the other table. Without it, its primary key. |

## PostgreSQL

Two steps:

1. The constraint is added as not valid. New and changed rows are checked from now on.
2. The validation of the constraint checks the rows that exist.

## Locks

Step 1 takes a strong lock on both tables for a moment. Step 2 reads the rows under a lock that lets everybody read and write.

## After a failure

- Step 2 fails if a row points to nothing. The constraint stays, not valid. Correct the rows and run again; the run continues with step 2.

## Notes

- The plain statement `alter table … add constraint … foreign key …` under `do` is one step. It checks all rows under its lock.
- A rule for a deleted row, such as `on delete cascade`, has no parameter yet. Use the plain statement in a `native` part until it has.
