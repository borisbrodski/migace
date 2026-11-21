# delete

Removes rows from one table.

```text
delete from <table> [<alias>] [where <condition>]
```

## Rules

- One table. No join: use a subquery in the condition.
- State how many rows you expect with `expect-rows`.
