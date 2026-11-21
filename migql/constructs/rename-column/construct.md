# rename column

Renames a column without stopping older application versions. This statement is an addition to SQL.

```text
rename column <table>.<old> to <new>
```

## Rules

- One statement, two phases. In the phase `start` the new column is added and kept in step with the old one. In the phase `finish` the old column is removed.
- The table is named once, in front of the old name.
