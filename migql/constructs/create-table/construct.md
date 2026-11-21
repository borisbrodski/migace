# create table

Creates a new table.

```text
create table <table> ( <column or constraint>, … )
```

## Rules

- A column is a name, a type and any of: `not null`, `default <value>`, `check (<condition>)`, `references <table>`, `primary key`, `unique`.
- A constraint of the table is `primary key (…)`, `unique (…)`, `check (…)` or `foreign key (…) references <table>`.
- A constraint may get a name: `constraint <name> …`. Give every constraint a name that later snippets have to refer to.
- A table needs at least one column.
