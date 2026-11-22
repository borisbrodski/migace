---
type: spec
status: ready
milestone: M3.1
---

# M3.1 Exact names

## Goal

A name in MigQL is exact, with or without quotes. `email` and `Email` are two names, `Key` and `"Key"` are one name. The language, the PostgreSQL generator and the comparison follow this rule, and it is proven on a schema whose names are in mixed case.

Today the generator turns a name without quotes into lower case. That stops.

## Non-goals

- The second way to read names, in which MIG-Ace follows SQL (question 39). Nothing in this spec may make it harder to add: the written name and the fact that it was in quotes stay available to the generator.
- A double quote inside a name (question 40). It stays an error.
- Completion and quick fixes that need the schema of the project. They come with the editor milestone.
- `mig make`.

## Builds on

- [A name in MigQL is exact](../decisions/names-are-exact.md)
- [Names and case](../migql/names-and-case.md)
- [YAML profile](../migql/yaml-profile.md), the exception for quoted keys
- M2 and M3
- [Coding rules](../engineering/coding-rules.md)

## Order of work

1. One function in `migql/` that says whether two written names are the same name. The checks use it.
2. The PostgreSQL generator.
3. Types.
4. Names with other characters, in every position.
5. The bookshop in mixed case, and the proofs on it.
6. The comparison in `core/`.

## Acceptance criteria

### The rule in the language

- **M3.1-AC-01** Two written names are the same name when their characters are the same after the quotes are removed. `Key` and `"Key"` are the same; `key` and `Key` are not. One function decides this, and no check compares names in another way.
- **M3.1-AC-02** The checks follow the rule. An `upsert` with `key: Code` and a row `{ code: … }` reports a missing key column. With `key: "Code"` and a row `{ Code: … }` it reports nothing.
- **M3.1-AC-03** Every other name follows the same rule: an alias, a name defined under `let`, the name of a part. `when: Buggy` does not find the definition `buggy`. `update customer C set name = 'x' where C.id = 1` is generated with `"C"` in both places.
- **M3.1-AC-04** Keywords and names of functions are not case-sensitive. `ALTER TABLE customer ADD COLUMN x INTEGER` and `Upper(Trim(name))` give the same SQL as their lower-case forms, apart from the names of tables and columns.
- **M3.1-AC-05** A name that is a keyword of MigQL and is written without quotes is an error that proposes the quotes, as today.
- **M3.1-AC-26** `migql/keywords.md` in the vault lists every keyword of the statement language and says whether it can be a name without quotes. A keyword is accepted as a name without quotes wherever this leaves the grammar unambiguous; the others keep the error of M3.1-AC-05. Every keyword that is accepted has a test as the name of a table and of a column, in a statement and in a condition. See "Which words need quotes" in [Names and case](../migql/names-and-case.md).
- **M3.1-AC-06** An empty name `""` and a name with a double quote inside are errors with a message that says what is not supported.

### Types

- **M3.1-AC-07** `migql/types.md` in the vault lists the types that MigQL knows, with their PostgreSQL form. It starts with the types that the catalogue, the bookshop and the website use. The list is marked as a working assumption.
- **M3.1-AC-08** A type name is first compared with that list without regard to case: `VARCHAR(20)`, `Integer` and `bigint` are found. Their generated form is the one of the list.
- **M3.1-AC-09** A type name that is not on the list is the exact name of a type of the schema, such as an enumeration. It is generated like any other name.

### The PostgreSQL generator

- **M3.1-AC-10** A name is generated with the case of the snippet. It is written in double quotes where PostgreSQL would read it differently without them: upper-case letters, a reserved word, other characters. A plain lower-case name is written without quotes. This replaces M3-AC-03.
- **M3.1-AC-11** Every place that puts a name into a text or into a catalog query has a test with a name in mixed case: `nextval`, the code of `ensure column`, the name of the constraint for `set not null`, a condition such as `column "Orders"."DueDate" exists`.
- **M3.1-AC-12** A test with hostile names shows that a name cannot end an identifier or a text literal and start a new statement: names with `'`, `;`, `--`, a backslash and a line that looks like a comment.
- **M3.1-AC-13** The existing tests and expected files that rely on lower-casing are changed, and the diff of the expected files is reviewed. No expected file of the catalogue changes for an example that is written in lower case.

### Names with other characters

- **M3.1-AC-14** A name in quotes is accepted in every position where a name can stand: table, column, `table.column`, constraint, index, sequence, alias, `into`, `key`, a flow map, a condition.
- **M3.1-AC-15** A column name in quotes is accepted as a key of a row that is written over several lines: `"Line Item": 3`. A reference YAML parser reads the same file and gives the same name.
- **M3.1-AC-16** The catalogue has examples with names in mixed case and with a name that contains a space, at least for `create table`, `alter table … add column`, `rename column`, `update`, `upsert`, `ensure column` and `create index`. They pass the three proofs of M3.

### Proven on a database

- **M3.1-AC-17** `examples/bookshop-mixed-case/schema/` holds the bookshop schema as an application that sends names in quotes creates it: tables and columns in mixed case, such as `"Customer"."Email"`. One table has two columns that differ only in case.
- **M3.1-AC-18** The reader of M2 reads this schema. The model has the names exactly as written. Reading it twice gives the same fingerprint, and the fingerprint differs from the one of the plain bookshop.
- **M3.1-AC-19** The order of objects in the canonical form depends only on the characters of the names, never on a locale. A test with `Email`, `email` and `eMail` fixes the order.
- **M3.1-AC-20** A change of case only works on PGlite: after `rename column customer.key to Key` the model has the column `Key` and no column `key`.
- **M3.1-AC-21** The two columns that differ only in case can be changed one at a time: an `update` that sets one of them leaves the other unchanged.
- **M3.1-AC-22** A property test with a fixed seed: for any name made of letters in both cases, digits, underscores, spaces and keywords, a `create table` snippet with this name, generated and run on PGlite, gives a table whose name in the model is that name.

### The comparison

- **M3.1-AC-23** When an object is missing under one name and unexpected under a name that differs only in case, in the same place and with the same definition, the comparison reports one difference with the property `name` and says that the names differ only in case. This holds for tables, columns, constraints, indexes and sequences.
- **M3.1-AC-24** A function of `core/` lists the objects of a model that share a place and whose names differ only in case. For the mixed-case bookshop it returns the one pair of columns; for the plain bookshop it returns nothing.

### An answer after M3

- **M3.1-AC-25** `ensure column` widens a `numeric` when the precision grows and the scale stays the same. A changed scale, a smaller precision and every other difference in the details of a type is an error. Each case has a test on PGlite. See [MigQL answers after the PostgreSQL generation](../decisions/migql-answers-after-m3.md).

## Open points

- Types written with several words, such as `double precision` and `timestamp with time zone`: whether the grammar accepts them is checked while the list of types is written. A gap is recorded as a question, not solved here.
- Whether the check of M3.1-AC-24 is an error, a warning or a setting is decided with the command that uses it.
