# column-rename

Gives a column another name.

## Result

The column has the new name. Its values, its type and its constraints stay.

## Parameters

| Parameter | Meaning |
|---|---|
| `table` | The table of the column. |
| `from` | The name the column has now. |
| `to` | The new name. |

## PostgreSQL

In a run without a phase: one statement, `alter table … rename column … to …`.

With the phases `start` and `finish`, a second column and a trigger keep older application versions working. That form comes with the upgrade phases.

## Locks

The rename changes only the catalog. The strong lock on the table is held for a moment.

## After a failure

The action is one step. After a failure nothing is changed, and the next run tries again.

## Notes

- A change of case only, such as `key` to `Key`, is an ordinary rename.
- An older application version that uses the old name stops working after a plain rename.
