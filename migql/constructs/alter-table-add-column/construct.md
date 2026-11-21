# alter table … add column

Adds one column to an existing table.

```text
alter table <table> add column <column> <type> [not null] [default <value>] …
```

## Rules

- The column is written as in `create table`.
- A column that is `not null` without a default fails on a table with rows. Add it as optional, fill it, then set `not null`.
