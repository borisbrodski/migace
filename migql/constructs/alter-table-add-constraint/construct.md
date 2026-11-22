# alter table … add constraint

Adds a constraint to an existing table.

```text
alter table <table> add constraint <name> primary key (<columns>)
alter table <table> add constraint <name> unique (<columns>)
alter table <table> add constraint <name> check (<condition>)
alter table <table> add constraint <name> foreign key (<columns>) references <table> [(<columns>)]
```

## Rules

- Give the constraint a name. A later snippet can only drop a constraint it can name.
- Existing rows must fulfil the constraint.

## Actions

- `do` runs `add constraint` as one statement. It checks all rows under its lock. The actions [`constraint-add-foreign-key`](../constraint-add-foreign-key/construct.md) and [`constraint-add-check`](../constraint-add-check/construct.md) have the same result in two steps that check the rows under a weak lock.
