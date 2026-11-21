# update

Changes the values of rows in one table.

```text
update <table> [<alias>] set <column> = <value>, … [where <condition>]
```

## Rules

- One table. No `from` and no join: look a value up with a subquery.
- Write the statement so that it can run again after an interruption, for example with `where <column> is null`.
