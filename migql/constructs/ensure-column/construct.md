# ensure column

Makes sure that a column exists with at least the given type. This statement is an addition to SQL.

```text
ensure column <table>.<column> <type>
```

## Rules

- The column is missing: it is added.
- The column is narrower: it is widened.
- The column matches: nothing happens.
- Anything else, such as a narrower target: the part fails.
- No condition is needed around this statement. It says what is wanted.
