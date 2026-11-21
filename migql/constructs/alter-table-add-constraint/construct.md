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
