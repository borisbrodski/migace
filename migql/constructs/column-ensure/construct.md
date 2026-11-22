# column-ensure

Makes sure that a column exists with at least the given type.

## Result

The column exists and has exactly the given type after the action, whether it was missing, narrower or already right.

## Parameters

| Parameter | Meaning |
|---|---|
| `table` | The table that gets the column. |
| `column` | The name of the column. |
| `type` | The type the column must have, for example `varchar(500)`. |
| `default` | Optional. The default value of the column, used when the column is added. |
| `not-null` | Optional. `true` makes the column mandatory when it is added. |

## PostgreSQL

One block of code that decides in the database:

- The column is missing: it is added.
- The column has the type: nothing happens.
- The column is narrower: it is widened. This holds for a longer `varchar` or `char`, and for a `numeric` with a larger precision and the same scale.
- Anything else: the part fails with a message that shows the type the column has.

## Locks

Adding a column without a default and widening a `varchar` change only the catalog; the strong lock on the table is held for a moment. Widening a `numeric` can rewrite the table and holds the lock meanwhile.

## After a failure

The action is one step and one transaction. After a failure nothing is changed, and the next run decides again.

## Notes

- No condition is needed around this action. It says what is wanted.
- `default` and `not-null` are used only when the column is added. An existing column keeps its own.
