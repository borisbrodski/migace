# create index

Creates an index on one or more columns of a table.

```text
create [unique] index [concurrently] <name> on <table> (<columns>)
```

## Rules

- The index has a name.
- `concurrently` builds the index while the table stays usable.
- Index types and expressions that only one database knows belong in a `native` part.
