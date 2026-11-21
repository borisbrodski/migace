---
type: language
status: proposal
date: 2026-11-21
---

# Names and case

**Status:** the rule below was proposed by the project owner on 2026-11-21 and is the working assumption. It is confirmed with question 38 in [Open questions](../questions/open-questions.md).

## What must work

1. The database has every name exactly as the application addresses it. Hibernate with backticks or with quoting switched on for all names, the PostgreSQL provider of EF Core and Prisma all send names in quotes, and then the case counts.
2. A change of case only, such as `key` to `Key`, can be written as a migration.
3. A project that moves to MIG-Ace may already have two names that differ only in case, such as `email` and `Email` in one table.
4. A snippet creates the same name in every database.

## The rule

**A name is exact.** The database gets the name with the characters and the case that the snippet has, as if it were written in quotes in SQL. **[direction]**

| Written in MigQL | Name in the database |
|---|---|
| `customer` | `customer` |
| `Customer` | `Customer` |
| `CUSTOMER` | `CUSTOMER` |
| `"Customer"` | `Customer`, the same name as without quotes |

- Double quotes do not change the meaning. They are needed only for a name that is a keyword of MigQL or that contains a character other than a letter, a digit or an underscore. **[direction]**
- Two names are the same name when their characters are the same. `email` and `Email` are two names.
- Keywords, names of functions and names of the built-in types are not case-sensitive: `ALTER TABLE`, `Upper(…)`, `VARCHAR(20)`. **[direction]**
- A name may contain any character except a double quote and a line break. **[open]**: whether a double quote inside a name is ever needed.

## Why not the rule of SQL

In SQL a name without quotes is not case-sensitive, and each database stores it in its own form: lower case in PostgreSQL, upper case in Oracle. With that rule `add column key` creates `key` in one database and `KEY` in another, and an application that sends `"key"` in quotes finds it in only one of them. Every name would have to be written in quotes to prevent this.

## The case this rule does not serve

An application that sends names **without** quotes, which is what Hibernate does unless it is configured otherwise, on a database that stores such names in upper case. The application then looks for `DUE_DATE` in Oracle and for `due_date` in PostgreSQL, and no single exact name is right in both.

- With PostgreSQL only, this case does not exist: the author writes names in lower case, as they are in the catalog.
- When a database with another default form is added, a project needs a setting that says how its application sends names. **[open]** Liquibase has such a setting (`objectQuotingStrategy`) and so has jOOQ (`RenderQuotedNames`), for the same reason. A possible form: `names: exact` as the default, and a second value with which names are written without quotes and are not case-sensitive.

## Why most of it is already there

- The schema model holds the names as the catalog has them, and compares them character by character.
- The desired database is built from the statements that the ORM really generates. The comparison therefore proves the case of every name, without MIG-Ace knowing the naming rules of any ORM. A column created as `Key` where the application expects `key` is a difference, and the proof fails.
- The ledger, the references between snippets, the runner and the replaceable objects do not handle names of tables or columns.

Checked on PGlite: `email` and `"Email"` exist side by side in one table; `alter table customer rename column key to "Key"` is an ordinary rename; `nextval('OrderSeq')` does not find the sequence `"OrderSeq"`, `nextval('"OrderSeq"')` does; `order by … collate "C"` gives the same order as the comparison in `core`.

## What has to be built

| Area | Work |
|---|---|
| PostgreSQL generator | `names.ts` turns a name without quotes into lower case today. It stops doing that. Quotes are written in the generated SQL where PostgreSQL would read the name differently without them, as today. Every place that puts a name into a text or a catalog query (`regclass`, `nextval`, `attname`) gets a test with a name that has upper-case letters. |
| Comparing names in MigQL | The checks compare names as written, which is now right for names without quotes. A name in quotes and the same name without quotes must be found equal. |
| YAML positions | A column name in quotes as a key of a row written over several lines: `"Line Item": 3`. Needed only for names with other characters. The [YAML profile](yaml-profile.md) excludes quoted keys and needs this one exception. |
| Report of the comparison | When a missing object and an unexpected object differ only in case, they are reported as one finding with the repair: correct the case in the snippet, or `rename … to Key`. An author used to SQL who writes `ALTER TABLE ORDERS …` gets this finding. |
| Editor | A name that does not exist while a name that differs only in case does exist is an error with a quick fix. |
| Names that differ only in case | Allowed. Reported by a check that a project can switch off. An error when the project lists a database in which the two names are one. |
| `mig make` | Writes the names as the catalog has them. Proposes a rename when a column is missing and a column with the same type and a name that differs only in case is unexpected. |
| Fingerprint in the script | The SQL that computes the fingerprint sorts with a fixed collation (`collate "C"` in PostgreSQL), so that it matches the order used by `core`. |
| Tests | A second variant of the bookshop schema with names in mixed case, as an ORM that quotes creates them, with one pair of names that differ only in case. It runs through every proof that the plain bookshop runs through. A property test: any name, written in MigQL, created in PGlite and read back, is the same name; and a name from the catalog, written by `mig make` and parsed again, is the same name. |

## Renaming with phases

In PostgreSQL the columns `key` and `Key` are two columns, so the form with `start` and `finish` works for a change of case as for any other rename. In a database where the case of a column name does not count, both versions of the application find the column under either spelling; the adapter generates a plain rename and no second column. **[direction]**

## Limits that stay

- A snippet that needs `email` and `Email` in one table cannot run on MySQL, or on SQL Server with its default collation. The build reports it; nothing can repair it.
- In MySQL the case of a table name depends on the operating system and a server setting. The MySQL adapter has to deal with this when it is written.

## Rejected alternatives

- **The rule of SQL** (a name without quotes is not case-sensitive, a name in quotes is exact) as the only rule: see above. It may return as the second value of the setting.
- **Quotes for keywords only, and upper case inside quotes is an error:** cannot serve an application whose ORM sends names in mixed case.
