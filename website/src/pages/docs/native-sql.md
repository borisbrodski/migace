---
layout: ../../layouts/Doc.astro
title: Native SQL
description: Using PostgreSQL-specific SQL in a snippet when the statement language is not enough.
lead: The statement language covers everyday changes. For everything else you can write PostgreSQL's own SQL in a native part.
---

## When to use it

Use `native` when you need a feature that only PostgreSQL has, or a statement the [statement language](/docs/statements/) leaves out:

- special index types,
- extensions,
- an `update` that joins several tables,
- PL/pgSQL blocks.

## Example: search by a part of the title

Release 1.2.0 lets customers find a book by typing any part of its title. PostgreSQL can do this quickly with a trigram index, which is a PostgreSQL feature.

```yaml
# migrations/20260608-1500-book-title-search.migql.yaml
migration: 20260608-1500-book-title-search
uid: 01JG3N7V4C8Q1S6W9Y2A5E0H3K
doc: Fast search for a part of a book title

parts:
  - trigram-extension:
      native:
        postgresql: create extension if not exists pg_trgm

  - title-search-index:
      native:
        postgresql: |
          create index ix_book_title_search on book
          using gin (title gin_trgm_ops)
```

The text under `postgresql:` is sent to the database as it is.

## Native parts are still proven

MIG-Ace does not need to understand a native statement. It looks at what the statement did.

- The [proof loop](/docs/proof-loop/) runs the native part on a real PostgreSQL and compares the result with the expected schema. The index above must also exist in the [schema folder](/docs/desired-schema/), or the comparison fails.
- The ledger records the part like any other.
- The other keys work as usual: `when`, `verify-before`, `verify-after`.

## What you give up

For a native part MIG-Ace cannot do what it does for a `do` statement:

- It cannot check the statement while you type. Mistakes show up when the proof loop runs it.
- It cannot tell which rows a native data statement changed. After such a part, the [test data](/docs/test-data/) of all tables is checked, not only of one.
- The part works on PostgreSQL only.

So use `do` where you can and `native` where you must.

## Moving a statement to native

If you write PostgreSQL-specific SQL in a `do` key, MIG-Ace says so:

```text
migrations/20260608-1500-book-title-search.migql.yaml:12
  "using gin" is PostgreSQL-specific and not part of the statement language.
  Move this statement to a native part.
```

In the editor, a quick fix does the move for you.

## Supported databases in one place

`migace.yaml` lists the databases your project supports.

```yaml
# migace.yaml
dialects:
  - postgresql
```

This site covers PostgreSQL. When a project supports more than one database, every native part must provide a variant for each of them, and MIG-Ace reports a missing one.
