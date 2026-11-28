---
type: language
status: mixed
---

# Statement language

The statement language follows common SQL where a portable form exists and adds only what is missing. **[decided]** The MIG-Ace grammar parses every statement, so a syntax error in a statement is a build error. **[decided]**

- **Schema statements:** `create table`, `alter table … add column`, `alter table … alter column`, `alter table … add constraint`, `alter table … rename column`, `create index`, `drop …` in standard form.
- **`do` runs the statement that was written.** Operations for which MIG-Ace chooses the statements are [actions](actions.md) with keys of their own: making a column mandatory without a long lock, adding a constraint without a long lock, renaming a column over two phases, ensuring that a column exists. The statements `ensure column` and `rename column <table>.<old> to <new>` of the first implementation are removed. **[decided]**
- **`create index`** is generated as written. `concurrently` is never added by the generator. **[decided]**
- **`update`:** `update <table> [alias] set col = expr, … [where …]`. No `from` join.
- **`delete`:** `delete from <table> [alias] [where …]`.
- **`insert`:** `insert into <table> (cols) values (…)`, or with a `select` from one table.
- **Subqueries:** scalar subqueries and `exists (…)` / `in (…)`, each over one table.
- **Expressions:** arithmetic, `||`, comparisons, `and/or/not`, `is null`, `in`, `between`, `like`, `case`, `cast`, and a list of portable functions.
- **Sequences:** `next value for <sequence>`.
- Keywords, names of functions and names of the types that MigQL knows are case-insensitive. A name of a table, a column or another object is exact, with or without quotes. See [Names and case](names-and-case.md). **[decided]**
- A name that is a keyword, or that contains other characters than letters, digits and underscores, is written in double quotes: `"index"`, `"Line Item"`. The quotes do not change the case rule. **[decided]**
- A change of a column type has two accepted spellings: `alter column c type t` and `alter column c set data type t`. **[decided]**
- `?` stands for a value that is not decided yet. It is allowed only in a part with a `todo`. **[decided]**

A condition must never restate what the operation already says. **[decided]**

## Conditions and verification

- `when` decides whether a part runs. A snippet has no `when` since M4.4; a condition that several parts share is named under `let`. Conditions test the current state where possible (`column orders.legacy_due exists`) and the history where necessary (`ran <slug>.<part> …`, where the slug is the snippet name without its timestamp). **[direction]**
- A snippet or part whose condition is false is recorded as skipped and is evaluated again on the next run. **[direction]**
- `verify-before` and `verify-after` accept a boolean expression or a list of quantifier checks. **[decided]**

```yaml
verify-after:
  - all:    orders.status_id is not null
  - none:   orders.status_text = ''
  - single: order_status.code = 'UNKNOWN'
  - exists: order_status.code = 'OPEN'
```

The table is taken from the column qualifier. For `all`, a row where the condition is unknown counts as a violation. **[direction]**
