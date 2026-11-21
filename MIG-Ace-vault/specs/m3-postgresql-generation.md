---
type: spec
status: ready
milestone: M3
---

# M3 PostgreSQL generation of statements

## Goal

Every construct of the catalogue is translated into correct PostgreSQL. The result is proven in three ways: as committed expected files, by PostgreSQL's own parser, and by running it on a database.

M1 left a first generator in `migql/generators/postgresql/`. This milestone completes it.

## Non-goals

- The migration script around the statements: ledger, conditions at run time, batches, retries, lock timeouts. That is the next milestone.
- `rename column` with its sync trigger. It comes with the upgrade phases.
- Databases other than PostgreSQL.
- Evaluating `when`, `verify-before` and `verify-after`. Their expressions are translated; nothing runs them yet.

## Builds on

- [Generation](../migql/generation.md), including the format for several steps
- [Statement language](../migql/statement-language.md)
- [Stability](../migql/stability.md)
- [Upgrade phases](../architecture/upgrade-phases.md), section "Lock safety"
- M2, for the check on a database
- [Coding rules](../engineering/coding-rules.md)

## Order of work

1. The check with PostgreSQL's parser, for what exists.
2. Names and literals.
3. Functions.
4. The constructs that are not generated yet.
5. The lock-safe forms.
6. Running the result on PGlite.

## Acceptance criteria

### Proven by PostgreSQL's parser

- **M3-AC-01** A test parses every expected file of the catalogue with PostgreSQL's own parser, for example the package `libpg-query`. It needs no server and no Docker.
- **M3-AC-02** No expected file contains "not generated yet".

### Names and literals

- **M3-AC-03** A name that PostgreSQL would read differently is written in double quotes: a name with upper-case letters that must be kept, a reserved word, a name with other characters. A plain lower-case name is written without quotes.
- **M3-AC-04** A quote inside a text literal is doubled. A test with hostile input shows that a value cannot end the literal and start a new statement.
- **M3-AC-05** The generated text is the same for the same statement, whatever its formatting in the snippet.

### Functions

- **M3-AC-06** `migql/functions.md` in the vault lists the functions a snippet may call, with their meaning and their PostgreSQL form. It starts with the functions the website uses. The list is marked as a working assumption.
- **M3-AC-07** A call of a function that is not on the list is an error that names the function and points to the list.
- **M3-AC-08** `next value for <sequence>` becomes `nextval('<sequence>')`.

### Constructs

- **M3-AC-09** `ensure column` is generated as code that decides on the database: it adds the column if it is missing, widens it if it is narrower, does nothing if it matches, and fails with a clear message in every other case. Each of the four cases has a test on PGlite.
- **M3-AC-10** `insert` in YAML form and `do: insert …` generate the same SQL.
- **M3-AC-11** `upsert` generates one statement that inserts missing rows and updates existing ones by the key.
- **M3-AC-12** `native` gives the text of its `postgresql` entry unchanged. A part without that entry is an error.

### Lock-safe forms

- **M3-AC-13** `alter column … set not null` is generated in four steps: a check constraint that is not validated, its validation, `set not null`, removal of the constraint.
- **M3-AC-14** A new foreign key is generated in two steps: the constraint as `not valid`, then its validation.
- **M3-AC-15** `create index concurrently` is marked with `-- outside transaction` in the expected file.
- **M3-AC-16** The expected files use the comment lines of the format for several steps.

### Proven on a database

- **M3-AC-17** For every valid example of the catalogue, the generated SQL runs without an error on a PGlite database that holds the bookshop schema the example needs.
- **M3-AC-18** After the run, the model of M2 shows the change the construct promises. Each construct has at least one such test: the column exists, the constraint exists, the rows are changed.
- **M3-AC-19** A construct in a lock-safe form leaves the same model as its simple form.

### Stability

- **M3-AC-20** A change to an expected file of the catalogue is visible in the diff of the commit. The generate run is never part of the normal test run.

## Open points

- Question 33: should `create index` always be generated as `concurrently`?
- How a statement that must run outside a transaction is passed to the script is decided in the next milestone.
