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
├─ generated-metadata.json      list of generated files, written by the test tool
└─ invalid/                     snippets that must fail: `# expect: <message>` lines, then markers at the expected places
```

The layout is the one of the generator snapshot tests in [langium-tools](langium-tools.md).

- A construct is not implemented before its folder exists. **[direction]**
- The catalogue is the specification of the language and its test suite at the same time. See [Test concept](../testing/test-concept.md).
- A new database adds one folder per construct: `generated/<database>/`.

## Open

- The details of the multi-step format below.

## Constructs with several steps

Some constructs become several statements, and some statements have to run in a special way. The expected file shows this with comment lines. **[direction]**

```sql
-- part: make-mandatory
-- step 1 of 4
alter table customer add constraint customer_loyalty_level_not_null check (loyalty_level is not null) not valid;
-- step 2 of 4
alter table customer validate constraint customer_loyalty_level_not_null;
-- step 3 of 4
alter table customer alter column loyalty_level set not null;
-- step 4 of 4
alter table customer drop constraint customer_loyalty_level_not_null;
```

| Comment line | Meaning |
|---|---|
| `-- part: <name>` | the statements of one part follow |
| `-- step <n> of <m>` | one of several statements of the same part |
| `-- phase: finish` | the following steps belong to the finish phase |
| `-- outside transaction` | the following statement cannot run inside a transaction, for example `create index concurrently` |
