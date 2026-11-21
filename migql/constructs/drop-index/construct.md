# drop index

Removes an index.

```text
drop index [concurrently] <name>
```

## Rules

- The index is named. The table is not needed.
- `concurrently` removes the index while the table stays usable.
