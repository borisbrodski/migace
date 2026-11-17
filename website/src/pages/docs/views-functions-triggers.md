---
layout: ../../layouts/Doc.astro
title: Views, functions and triggers
description: Views, functions, procedures and triggers are not migrated. You keep their current definition in the schema folder, and every run replaces what changed.
lead: You do not write snippets for views, functions, procedures and triggers. You keep their current definition in the schema folder, and every migration run brings the database up to date.
---

## Why they are different

A table holds data, so it has to be changed step by step. That is what snippets are for.

A view, a function or a trigger holds no data. It can be removed and created again at any time. So there is no history to keep, only the current definition.

| Object | You change it with |
|---|---|
| Tables, columns, constraints, indexes, sequences | A [snippet](/docs/snippets/) |
| Types and extensions | A snippet, usually with [native SQL](/docs/native-sql/) |
| Views, functions, procedures, triggers | The file in the [schema folder](/docs/desired-schema/) |

## Changing a view

The bookshop has a view with the totals per customer. The team adds the date of the last order. They edit the file, and that is all:

```sql
-- schema/110-views.sql
create view v_order_totals as
  select o.customer_id,
         count(*)           as orders,
         sum(o.total_cents) as total_cents,
         max(o.created_at)  as last_order_at
  from orders o
  group by o.customer_id;
```

`mig make` sees the change and writes nothing:

```text
$ mig make

Comparing schema/ with the migrated release 1.3.0
  ~ view v_order_totals      replaced by the next run, no snippet needed

Nothing to write.
```

In production, the next run replaces the view:

```text
Views, functions and triggers
  v_order_totals        replaced
Schema fingerprint 77c0…a91e matches.
```

## A function and a trigger

They work the same way. Write them as PostgreSQL wants them, in any file of the schema folder:

```sql
-- schema/120-functions.sql
create function refresh_order_total() returns trigger
language plpgsql as $$
begin
  update orders o
  set total_cents = (select coalesce(sum(i.quantity * i.price_cents), 0)
                     from order_item i
                     where i.order_id = o.id)
  where o.id = coalesce(new.order_id, old.order_id);
  return null;
end $$;

create trigger trg_order_item_total
  after insert or update or delete on order_item
  for each row execute function refresh_order_total();
```

The only rule for the files is the usual one: run in name order on an empty database, they must work. A view that uses another view comes after it.

## What happens in a run

1. **Before the snippets**, functions and procedures that are new are created. A snippet can then use them, for example in an index or in a data step.
2. **The snippets run.**
3. **After the snippets**, changed functions are replaced, views and triggers are created or replaced, and objects you removed from the schema folder are dropped.

Only objects that differ are touched. If nothing changed, nothing happens: an application that runs the script at every start loses no time and blocks nobody.

Each object is replaced in one step. The application never sees a moment in which a function or a view is missing.

## When a view stands in the way

PostgreSQL refuses to change the type of a column, or to drop it, while a view uses it. The bookshop wants a bigger number type for the order total, and `v_order_totals` uses that column.

```yaml
  - widen-total:
      do: alter table orders alter column total_cents type bigint
```

You write nothing else. MIG-Ace drops the view just before this part and creates it again at the end of the run:

```text
20260615-0900-order-total-bigint
  widen-total           done   view v_order_totals dropped first
Views, functions and triggers
  v_order_totals        created
```

In this one case the view is missing for a short time. If your application has to stay available during upgrades, `mig test` reports it. See [Zero-downtime changes](/docs/zero-downtime/).

## Removing and renaming

- **Remove** an object from the schema folder, and the next run drops it.
- **Rename** it, and the next run drops the old one and creates the new one.
- A function with **different parameters** is a new function for PostgreSQL. The old one is dropped.

## Permissions on views are kept

An administrator at Harbour Books gave the reporting user access to `v_order_totals`. When the view is replaced, MIG-Ace puts that permission back.

## Triggers and data steps

Triggers stay active while snippets run. A data step that changes a million rows in `order_item` fires `trg_order_item_total` a million times. Keep that in mind when you plan a large [data migration](/docs/data-migrations/).

## Objects your administrators add

A view that a local administrator created would be dropped, because it is not in the schema folder. Tell the runner to leave such objects alone:

```text
--ignore "view:dba_*"
```

## Coming from Oracle?

- **PostgreSQL has no packages.** Functions and procedures stand on their own. Group them with a name prefix, or put them into a schema of their own.
- **A view does not become invalid.** In Oracle a view is marked invalid when its table changes. PostgreSQL refuses the change instead. MIG-Ace handles this for you, as shown above.
