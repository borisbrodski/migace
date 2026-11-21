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
