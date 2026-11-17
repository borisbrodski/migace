---
layout: ../../layouts/Doc.astro
title: The desired schema
description: The schema folder, what MIG-Ace compares, and the schema fingerprint.
lead: The desired schema is what your database should look like. You describe it with ordinary SQL files, and Hibernate writes one of them for you.
---

## The schema folder

```text
schema/
  101-generated.sql     tables, keys and sequences, written by Hibernate
  102-indexes.sql       extra indexes, written by hand
  103-search.sql        PostgreSQL-specific objects, written by hand
  110-views.sql         views
  120-functions.sql     functions and triggers
```

MIG-Ace runs these files in name order on an empty database. The result is the desired schema.

It makes no difference whether a file was generated or written by hand. What counts is the database that results.

## Getting the DDL from your entities

The file `101-generated.sql` comes from Hibernate. Schema generation is a standard feature of Jakarta Persistence, switched on with two properties:

```text
jakarta.persistence.schema-generation.scripts.action=create
jakarta.persistence.schema-generation.scripts.create-target=schema/101-generated.sql
```

Run it as part of your build, with the same Hibernate version and the same settings your application uses in production. Then the file always matches your entity classes.

## Why Hibernate alone is not enough

Hibernate creates tables, columns, keys and simple constraints. A real application needs more: an index for a slow query, a view for a report, a trigger, a PostgreSQL extension.

```sql
-- schema/102-indexes.sql
create index ix_orders_customer on orders (customer_id);
```

```sql
-- schema/103-search.sql
create extension if not exists pg_trgm;
create index ix_book_title_search on book using gin (title gin_trgm_ops);
```

Because MIG-Ace reads the schema from a real PostgreSQL database, everything PostgreSQL can do is allowed in these files.

## What is compared

MIG-Ace reads both databases into a model and compares the models. It does not compare SQL text.

| Compared | Not compared |
|---|---|
| Tables and columns | Order of columns in a table |
| Column types, mandatory or optional, default values | Tablespaces and storage settings |
| Primary keys, foreign keys, unique and check constraints | Owners and permissions |
| Indexes, including their type and columns | |
| Sequences | The current value of a sequence |
| Views, functions and triggers | |
| Comments on tables and columns | |

The right-hand column lists things an administrator may tune in production. Changing them does not make the schema "wrong".

## Names of constraints and indexes

Give every constraint and index a name. MIG-Ace reports an unnamed one in a snippet and suggests a name.

```yaml
  - fk-book:
      do: |
        alter table review
        add constraint fk_review_book foreign key (book_id) references book
```

If two objects have the same definition and different names, MIG-Ace reports that as a naming difference, separately from real differences.

## Views, functions and triggers

These objects are replaced as a whole, never altered step by step. So you only keep their current definition in the schema folder.

```sql
-- schema/110-views.sql
create view v_order_totals as
  select o.customer_id, count(*) as orders, sum(o.total_cents) as total_cents
  from orders o
  group by o.customer_id;
```

The migration script recreates all of them at the end of every run. If a snippet changes a column that a view uses, the view is dropped before the change and recreated afterwards.

## A change is never silent

MIG-Ace keeps a readable snapshot of the desired schema in your repository. When a schema file changes, the snapshot must change with it, or the build fails.

```text
$ mig test
schema      schema/102-indexes.sql changed, the snapshot is out of date
  + index ix_orders_created_at on orders (created_at)
  Run "mig make" to update the snapshot and create a snippet.
```

This applies to the generated file and to hand-written files alike. In a code review you see the change to the schema in plain words.

## The fingerprint

The fingerprint is a hash of the schema model. Two databases with the same fingerprint have the same schema.

- The build computes the fingerprint of the desired schema.
- At the end of every migration run, the script computes the fingerprint of the real database and compares the two.
- The application checks it at start-up. See [Running migrations](/docs/running-migrations/).

The fingerprint is computed from the real database, not copied from a file. If someone changed a table by hand, the check notices.

## Objects your administrators add

A database administrator at one store may add an index to speed up a local report. That should not stop the application.

Tell MIG-Ace which extra objects to ignore when you run the script:

```text
--ignore "index:dba_*"
```

Ignored objects may be *added*. An object the application expects can never be ignored.
