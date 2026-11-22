# alter table … alter column

Changes one property of an existing column.

```text
alter table <table> alter column <column> set not null
alter table <table> alter column <column> drop not null
alter table <table> alter column <column> type <type>
alter table <table> alter column <column> set data type <type>
alter table <table> alter column <column> set default <value>
alter table <table> alter column <column> drop default
```

## Rules

- One statement changes one property.
- `type` and `set data type` mean the same.
- `set not null` needs every row to have a value. Fill the rows in an earlier part.

## Actions

- `do` runs `set not null` as one statement. It reads the whole table under a lock that blocks everybody. The action [`column-set-not-null`](../column-set-not-null/construct.md) has the same result in four steps that do not.
