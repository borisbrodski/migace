---
layout: ../../layouts/Doc.astro
title: Editor support
description: A language server that knows your schema - completion, checks and quick fixes for snippets in VS Code and IntelliJ IDEA.
lead: The MIG-Ace editor support knows your database schema. It completes almost everything you type in a snippet, and it reports mistakes before any build runs.
figure: completion
---

## It knows your schema

Most SQL you write in a migration is typed blind: the editor does not know which tables and columns exist. MIG-Ace does. It comes with a language server, the same kind of helper that gives your IDE its Java support, and that server has your schema in memory.

In the picture above, `ship_by` is offered although no database has that column yet. An earlier part of the same snippet adds it.

## What is completed

| Where you type | What is offered |
|---|---|
| A new line in a snippet | The keys that are allowed there, such as `parts`, `testdata`, `when` |
| Inside a part | `do`, `insert`, `native`, `verify-before`, `verify-after`, `batch`, each with a short explanation |
| At the start of a statement | `alter table`, `create index`, `update`, `ensure column` and the other statements |
| After `update`, `from`, `alter table`, `references` | The tables of your schema |
| After `set`, in `where`, in a column list | The columns of that table, with type and whether they are mandatory |
| After `drop constraint`, `drop index` | The constraints and indexes that exist |
| After `next value for` | Your sequences |
| In an expression | Functions such as `upper`, `trim`, `coalesce`, `days` |
| In `ran …` | Snippet names, then the part names of that snippet, then release names |
| In a `testdata` row | The columns of the chosen table that still have no value |
| In `insert … values` | The columns of the target table, mandatory ones first |

## The schema at that point in time

A snippet from last year must not suggest a column that was added last week. So the editor does not use today's schema. For the snippet you are editing, it works out what the schema looks like **at that point**, after all earlier snippets ran.

It follows the parts above your cursor too. A column added in the first part of a snippet is offered in the second.

## Errors while you type

```text
20260525-1100-orders-ship-by.mig.yaml:14
  Unknown column "shipby" in table orders. Did you mean "ship_by"?
```

```text
20260601-0900-book-price-check.mig.yaml:9
  Constraint without a name. Suggested name: ck_book_price
```

The editor also keeps a small PostgreSQL in memory. It runs the statement you are editing there and undoes it right away. That is why you see PostgreSQL's own error messages while you type, not only syntax checks.

## Quick fixes

- Add a missing `testdata` entry with all columns listed.
- Name an unnamed constraint or index.
- Move a PostgreSQL-specific statement to a `native` part.
- Turn a one-line statement into a block, and back.
- Resolve a `todo` left by `mig make`.

## Hover and navigation

- Hover over a column to see its type and the snippet that introduced it.
- Hover over a statement to see the exact PostgreSQL statements MIG-Ace will run for it.
- Jump from `ran order-status.link-status` to that part.
- Find every snippet that touches a table.

## Installation

| Editor | How |
|---|---|
| VS Code | Install the MIG-Ace extension. |
| IntelliJ IDEA | Install the MIG-Ace plugin. |
| Neovim and others | Use `mig ls` as the language server for `*.mig.yaml` files. |

## Without the extension

Snippet files end in `.mig.yaml` and are valid YAML. Any editor shows them with YAML colours.

For basic help without the MIG-Ace extension, point your editor's YAML support at the MIG-Ace schema. It then completes the keys of the file format and shows their documentation. Statements inside `do` are plain text in this mode.

```yaml
# yaml-language-server: $schema=./.migace/schema.json
migration: 20260309-1400-review-table
```

## How it is built

The language server is written in TypeScript with [Langium](https://langium.org), a framework for building languages and their editor support. For the schema it uses [PGlite](https://pglite.dev), a real PostgreSQL that runs in memory inside the language server. Nothing has to be installed or started for it.

## In code review

A snippet is a small YAML file with familiar SQL inside, so it reads well in a pull request on GitHub or GitLab without any tool. The [release file](/docs/releases-and-branches/) and the schema snapshot show the reviewer what a change means for released snippets and for the schema.
