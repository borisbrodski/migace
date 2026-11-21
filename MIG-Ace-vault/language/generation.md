---
type: language
status: direction
---

# Generation of database-specific SQL

One statement in a snippet becomes SQL for each supported database. PostgreSQL is the first.

## Principles

- A generator translates. It never adds syntax. What the language accepts is defined by the grammar and the catalogue only. **[direction]**
- A construct that a database cannot express is a build error for that database, with a message that names the construct. Silent approximation is not allowed. **[direction]**
- The generated SQL is deterministic: the same statement always gives the same text. **[direction]**
- Some constructs become several steps, for example a lock-safe `set not null` or a `rename column` with phases. The steps are part of the expected output. **[direction]**

## The catalogue of constructs

Every construct of the language has one folder in `language/constructs/`.

```text
language/constructs/alter-table-add-column/
├─ construct.md              what it means, in plain language, with the rules
├─ valid/                    snippets that must parse
├─ invalid/                  snippets that must fail, each with the expected error
└─ expected/
   └─ postgresql.sql         the SQL that must be generated for the valid snippets
```

- A construct is not implemented before its folder exists. **[direction]**
- The catalogue is the specification of the language and its test suite at the same time. See [Test concept](../testing/test-concept.md).
- A new database adds one file per construct: `expected/<database>.sql`.

## Open

- The exact file format of expected errors.
- How multi-step output is written in the expected files.
