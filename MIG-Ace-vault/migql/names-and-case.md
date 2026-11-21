---
type: language
status: proposal
date: 2026-11-21
---

# Names and case

**Status:** proposed by the review, not yet confirmed by the project owner. See question 38 in [Open questions](../questions/open-questions.md). An earlier proposal ("double quotes are for keywords only, upper case inside quotes is an error") is withdrawn: it cannot serve an application whose ORM puts names in quotes.

## What must work

1. The database has every name exactly as the application addresses it. Hibernate with backticks or `hibernate.globally_quoted_identifiers`, the PostgreSQL provider of EF Core and Prisma all create names in quotes, and then the case counts.
2. A change of case only, such as `key` to `"Key"`, can be written as a migration.
3. A project that moves to MIG-Ace may already have two names that differ only in case, such as `email` and `"Email"` in one table.

## The rule

The rule is the one of SQL, so an author has nothing new to learn. **[direction]**

| Written in MigQL | Meaning |
|---|---|
| `customer`, `Customer`, `CUSTOMER` | One name. Case does not count. It stands for the form the database gives a name without quotes: lower case in PostgreSQL, upper case in Oracle. |
| `"Customer"` | Exactly these characters, in every database. |

- `email` and `"Email"` are two names. `email` and `"email"` are the same name in PostgreSQL and two names in Oracle. For this reason MigQL never turns a name into one fixed form. The name keeps what was written and whether it was in quotes; only the code of one database decides which name in the catalog is meant.
- A name in quotes may contain any character except a double quote and a line break. **[open]**: whether a double quote inside a name is ever needed.

## Why most of it is already there

- The schema model holds the names as the catalog has them, and compares them character by character.
- The desired database is built from the statements that the ORM really generates. The comparison therefore proves the case of every name, without MIG-Ace knowing the naming rules of any ORM. A column created as `key` where the application expects `"Key"` is a difference, and the proof fails.
- The PostgreSQL generator already reads a name in quotes as exact and a name without quotes as lower case, and writes quotes only where PostgreSQL needs them.
- The ledger, the references between snippets, the runner and the replaceable objects do not handle names of tables or columns.

Checked on PGlite: `email` and `"Email"` exist side by side in one table; `alter table customer rename column key to "Key"` is an ordinary rename; `nextval('OrderSeq')` does not find the sequence `"OrderSeq"`, `nextval('"OrderSeq"')` does; `order by … collate "C"` gives the same order as the comparison in `core`.

## What has to be built

| Area | Work |
|---|---|
| YAML positions | A column name in quotes as a key of a row written over several lines: `"Email": 'a@example.org'`. The grammar accepts a name in quotes in a flow map, in `into` and in `key` today, but not there. The [YAML profile](yaml-profile.md) excludes quoted keys and needs this one exception. |
| Comparing names in MigQL | The checks compare names as written. `key: Code` with a row `{ code: … }` is reported as a missing key column. One function decides whether two written names are the same, with the rules of the databases of the project. |
| One place per database | The form of a name without quotes, when quotes are needed, and how quotes are written. For PostgreSQL this is `names.ts`. Every place that puts a name into a text or a catalog query (`regclass`, `nextval`, `attname`) gets a test with a name in quotes. |
| Report of the comparison | When a missing object and an unexpected object differ only in case, they are reported as one finding with the repair: add the quotes in the snippet, or `rename … to "Key"`. This is the mistake that will happen most often. |
| Warning for mixed case without quotes | `add column DueDate date` creates `duedate`. A name with upper-case and lower-case letters and without quotes gets a warning with a quick fix. Names written all in upper case or all in lower case get none. |
| Names that differ only in case | Allowed where the database allows them. Reported by a check that a project can switch off. An error when the project lists a database in which the two names are one. |
| `mig make` | Writes quotes where the name in the catalog is not the form without quotes. Proposes a rename when a column is missing and a column with the same type and a name that differs only in case is unexpected. |
| Fingerprint in the script | The SQL that computes the fingerprint sorts with a fixed collation (`collate "C"` in PostgreSQL), so that it matches the order used by `core`. |
| Tests | A second variant of the bookshop schema, written as an ORM with quoted names creates it, with one pair of names that differ only in case. It runs through every proof that the plain bookshop runs through. A property test: any name, written in MigQL, created in PGlite and read back, is the same name; and a name from the catalog, written by `mig make` and parsed again, is the same name. |

## Renaming with phases

In PostgreSQL the columns `key` and `"Key"` are two columns, so the form with `start` and `finish` works for a change of case as for any other rename. In a database where the case of a column name does not count, both versions of the application find the column under either spelling; the adapter generates a plain rename and no second column. **[direction]**

## Limits that stay

- A snippet that needs `email` and `"Email"` in one table cannot run on MySQL, or on SQL Server with its default collation. The build reports it; nothing can repair it.
- A name without quotes has a different spelling in the catalog of each database. That is intended: an ORM that writes the name without quotes finds it in each of them.
- In MySQL the case of a table name depends on the operating system and a server setting. The MySQL adapter has to deal with this when it is written.
