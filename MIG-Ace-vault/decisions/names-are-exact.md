---
type: decision
status: decided
date: 2026-11-21
---

# A name in MigQL is exact, with or without quotes

## Context

Applications address tables and columns in two ways. Some send every name in quotes: Hibernate with quoting switched on, the PostgreSQL provider of EF Core, Prisma. Then the case of a name counts, and it is the same in every database. Others send names without quotes, and each database stores such a name in its own form: lower case in PostgreSQL, upper case in Oracle.

MIG-Ace must create every name so that the application finds it. It must be able to change the case of a name, and it must accept a project that already has two names that differ only in case.

## Decision

A name of a table, a column or another object is exact. The database gets the name with the characters and the case that the snippet has, as if it were written in quotes in SQL. Double quotes do not change the meaning; they are needed only for a name that is a keyword of MigQL or that contains a character other than a letter, a digit or an underscore.

Keywords, names of functions and names of the types that MigQL knows are not case-sensitive.

The details and the work that follows are in [Names and case](../migql/names-and-case.md).

## Consequences

- `email` and `Email` are two names. `Key` and `"Key"` are one name.
- An author who writes `ALTER TABLE ORDERS …` addresses a table `ORDERS`. With an application that sends names without quotes on PostgreSQL, the table is `orders`, and the build reports the difference.
- An application that sends names without quotes, on a database that stores such names in upper case, cannot be served by exact names alone. This needs a project setting when the first such database is added. See question 39 in [Open questions](../questions/open-questions.md).

## Rejected alternatives

- **The rule of SQL** (a name without quotes is not case-sensitive, a name in quotes is exact): `add column key` creates `key` in one database and `KEY` in another, and an application that sends `"key"` finds it in only one of them. Every name would have to be written in quotes.
- **Quotes for keywords only, and upper case inside quotes is an error:** cannot serve an application whose ORM sends names in mixed case.
- **Forbidding names that differ only in case:** a project that moves to MIG-Ace may already have them. A check reports them instead.
