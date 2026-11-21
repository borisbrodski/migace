# alter table … drop column

Removes one column and its values.

```text
alter table <table> drop column <column>
```

## Rules

- The values are gone after this part. Keep the column for one more release when a repair may still need it.
- Older application versions that read the column stop working. Such a part belongs to the phase `finish`.
