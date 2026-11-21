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

Every construct of the language has one folder in `migql/constructs/`.

```text
migql/constructs/alter-table-add-column/
├─ construct.md                 what it means, in plain language, with the rules
├─ dsls/                        valid snippets
├─ generated/
│  └─ postgresql/               the SQL that must be generated for the valid snippets
├─ postgresql-metadata.json     list of generated files, written by the test tool
└─ invalid/                     snippets that must fail, with markers at the expected place
```

The layout is the one of the generator snapshot tests in [langium-tools](langium-tools.md).

- A construct is not implemented before its folder exists. **[direction]**
- The catalogue is the specification of the language and its test suite at the same time. See [Test concept](../testing/test-concept.md).
- A new database adds one folder per construct: `generated/<database>/`.

## Open

- How invalid examples are kept away from the snapshot runner, see [langium-tools](langium-tools.md).
- How multi-step output is written in the expected files.
