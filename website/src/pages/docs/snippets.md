---
layout: ../../layouts/Doc.astro
title: Snippets
description: The file format of a migration, its name, its identity and its parts.
lead: A snippet is one file that describes one change. It is made of named parts, and each part does exactly one thing.
---

## A complete snippet

Release 1.1.0 of the bookshop adds book reviews. `mig make` [wrote this snippet](/docs/generated-snippets/) after the `Review` entity was added.

```yaml
# migrations/20260309-1400-review-table.migql.yaml
migration: 20260309-1400-review-table
uid: 01JF4C9S2M7H5K3P8V6N1Y0E4R
doc: Customers can review books

parts:
  - create-table:
      do: |
        create table review (
          id          bigint         not null,
          book_id     bigint         not null,
          customer_id bigint         not null,
          stars       integer        not null check (stars between 1 and 5),
          review_text varchar(2000),
          created_at  timestamp      not null,
          primary key (id)
        )

  - fk-book:
      do: |
        alter table review
        add constraint fk_review_book foreign key (book_id) references book

  - fk-customer:
      do: |
        alter table review
        add constraint fk_review_customer foreign key (customer_id) references customer

  - index-book:
      do: create index ix_review_book on review (book_id)
```

## Name and identity

```yaml
migration: 20260309-1400-review-table
uid: 01JF4C9S2M7H5K3P8V6N1Y0E4R
```

- **The name** starts with a date and time. Snippets run in name order, so the name decides the position.
- **The `uid`** is the identity. `mig make` generates it once, and you never edit it. The database remembers a snippet by its `uid`.

Because identity and position are separate, you can rename a snippet to move it, even after it was released. Databases that already ran it still recognise it. See [Fixing mistakes](/docs/fixing-mistakes/).

## Parts

Each entry under `parts` has a name and one operation.

```yaml
  - index-book:
      do: create index ix_review_book on review (book_id)
```

Parts are small on purpose:

- **The ledger records each part.** If part three of four fails in production, you see exactly which statement failed and why.
- **A run continues where it stopped.** Parts one and two are not repeated.
- **The database remembers a part by its name** inside the snippet. If you rename a part, say what it was called before with `former-names`. See [Fixing mistakes](/docs/fixing-mistakes/#renaming-a-part-or-a-snippet).

## Operations

A part holds exactly one of these:

| Key | Meaning | Read more |
|---|---|---|
| `do` | One statement in the MIG-Ace statement language. It runs as you wrote it. | [Statements](/docs/statements/) |
| An action, such as `column-set-not-null` | A change for which MIG-Ace chooses the statements. | [Actions](/docs/actions/) |
| `insert`, `upsert` | Insert rows, or insert and update them, written as YAML. | [Statements](/docs/statements/) |
| `native` | A statement in PostgreSQL's own SQL. | [Native SQL](/docs/native-sql/) |
| `stop` | Stop the run with a message for a human. | [Fixing mistakes](/docs/fixing-mistakes/) |

Next to the operation, a part can have these keys:

| Key | Meaning | Read more |
|---|---|---|
| `when` | Run the part only if a condition holds. | [Conditions](/docs/conditions/) |
| `verify-before` | Fail before running if something is not true. | [Data migrations](/docs/data-migrations/) |
| `verify-after` | Fail after running if something is not true. | [Data migrations](/docs/data-migrations/) |
| `batch` | Run a data statement in portions. | [Data migrations](/docs/data-migrations/) |
| `expect-rows` | How many rows the statement may change. | [Data migrations](/docs/data-migrations/) |
| `phase` | `finish` marks a part that may only run when no older version of the application is left. | [Zero-downtime changes](/docs/zero-downtime/) |
| `retired` | The part never runs again. | [Fixing mistakes](/docs/fixing-mistakes/) |
| `former-names` | Names the part had before. | [Fixing mistakes](/docs/fixing-mistakes/) |
| `todo` | An open decision left by `mig make`. The build fails until you remove it. | [Generated snippets](/docs/generated-snippets/) |

## One line or a block

A short statement fits on one line:

```yaml
      do: create index ix_review_book on review (book_id)
```

A longer statement goes into a block. Start it with `|` and indent the lines below:

```yaml
      do: |
        alter table review
        add constraint fk_review_book foreign key (book_id) references book
```

Inside a block you can indent freely and write comments with `--`.

> A snippet is valid YAML. If a one-line statement contains something YAML would misread, such as ` #` or `: `, MIG-Ace tells you to use a block.

## Other keys at the top

| Key | Meaning |
|---|---|
| `doc` | One sentence that says what the snippet is for. |
| `testdata` | Rows inserted after the snippet ran. See [Test data](/docs/test-data/). |
| `testdata-before` | Rows inserted before the snippet runs. |
| `let` | Names for conditions that you use in more than one part. A condition itself always stands on a part. |
| `changed` | The reason for a change to a released snippet. See [Fixing mistakes](/docs/fixing-mistakes/). |
| `retired` | The snippet is never run again. |
| `former-names` | Names the snippet had before, without date and time. |
| `requires-downtime` | The snippet may only run while the application is stopped. See [Zero-downtime changes](/docs/zero-downtime/). |

A repair snippet starts with `repair:` instead of `migration:`.

## Views, functions and triggers

You do not write snippets for views, functions or triggers. They live in the [schema folder](/docs/desired-schema/), and every run replaces those that changed. See [Views, functions and triggers](/docs/views-functions-triggers/).
