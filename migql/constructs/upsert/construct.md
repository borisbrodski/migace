# upsert

Inserts the rows that are missing and updates the rows that exist. A row exists when a row with the same key is in the table. A part with `upsert` can therefore run on a database that already has some of the rows.

```yaml
upsert:
  into: <table>
  key: <column>            # or a list: [<column>, <column>]
  rows:
    - { <column>: <value>, … }
```

## Rules

- `key` is one column, or a list of columns in square brackets.
- Every row gives a value for every key column.
- Columns that are not the key are updated when the row exists.
- The key columns need a unique constraint or a primary key in the table.
- A value in a row is a literal, a name or `table.column`, as in every flow map.
