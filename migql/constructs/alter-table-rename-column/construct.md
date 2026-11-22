# alter table … rename column

Gives a column another name, as SQL writes it.

```text
alter table <table> rename column <old> to <new>
```

## Rules

- `do` runs this one statement.
- An older application version that uses the old name stops working.
- The action [`column-rename`](../column-rename/construct.md) has the same result in a run without a phase. With the phases `start` and `finish` it keeps older versions working.
