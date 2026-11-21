# insert … select

Copies rows from one table into another.

```text
insert into <table> (<columns>) select <values> from <table> [<alias>] [where <condition>]
```

## Rules

- The `select` reads one table. No join and no grouping.
- There are as many selected values as columns.
