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
Schema fingerprint 77c0…a91e recorded.
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

You can keep all views in one file or one view per file. MIG-Ace splits the files into statements with PostgreSQL's own parser, so code with semicolons inside is no problem.

## What happens in a run

1. **Before the snippets**, functions and procedures that are new are created. A snippet can then use them in an index, a default or a constraint.
2. **The snippets run.**
3. **After the snippets**, changed functions are replaced, views and triggers are created or replaced, and objects you removed from the schema folder are dropped.

Only objects that changed are touched. If nothing changed, nothing happens: an application that runs the script at every start loses no time and blocks nobody.

## How a run knows what changed

The migration script carries the current definition of every view, function, procedure and trigger. The ledger of each database remembers which definition MIG-Ace installed there. A run compares the two, object by object:

| The ledger says | The run |
|---|---|
| The same definition is installed | does nothing |
| Another definition is installed | replaces the object |
| The object was never installed, or is gone | creates it |
| An object is installed that the script no longer has | drops it |

Formatting and comments do not count. Tidying up a file replaces nothing.

A database that jumps over several releases needs no history. Its ledger holds the definition of the release it comes from, the script holds the one of today, and the object is replaced once. The definitions in between are never needed.

Because the ledger is asked and not the database, a function that somebody changed by hand on the server is not noticed. For that case, and for anyone who prefers it after a maintenance window, a run can replace everything:

```text
--param replace_objects=all
```

## What the application sees meanwhile

Each object is replaced in one transaction. A statement of the application that arrives during a replacement waits for a moment and then uses the new object. It does not fail.

| Replaced | A statement that arrives meanwhile |
|---|---|
| A function | Does not wait at all. A call that is running ends with the old code, the next call uses the new code. |
| A trigger | An insert or update waits, then runs with the new trigger. No row is written without a trigger. |
| A view | A query waits, then reads the new view. It never sees the view missing. |

The replacement of a view itself has to wait for open transactions that have read the view. How long a run waits for that, and how often it tries again, are [limits you can set](/docs/running-migrations/#limits).

What the new definition means to an application that still runs the old version is a different question. See [Zero-downtime changes](/docs/zero-downtime/).

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
- A **materialized view** holds data that has to be computed. It is not replaced by a run. Change it with a snippet.

## Permissions on views are kept

An administrator at Harbour Books gave the reporting user access to `v_order_totals`. When the view is replaced, MIG-Ace puts that permission back.

## Triggers and data parts

Triggers stay active while snippets run. A data part that changes a million rows in `order_item` fires `trg_order_item_total` a million times. Keep that in mind when you plan a large [data migration](/docs/data-migrations/).

## Do not call them from a data part

When a database jumps over several releases, an old snippet runs with the functions and views of today. A data part that calls a function of yours can then compute something else than it did when the snippet was new.

MIG-Ace reports a data statement that uses a view or a function from the schema folder. Write the logic into the statement itself. Using a function in an index, a default or a constraint is fine.

## Objects your administrators add

MIG-Ace drops only what it installed itself. A view that a local administrator created is left alone, and the run lists it.

## More than one database

A function for PostgreSQL does not run on another database. A project that supports several databases has one schema folder per database, and may have one more for files that every database understands. A project with one database keeps the single folder shown here.

## During a zero-downtime upgrade

New and changed objects are installed when the upgrade starts, because the new version of your application needs them. Objects that you removed are dropped when the upgrade is finished, because the old version may use them until then. A replaced view therefore serves both versions for a while. If the old version cannot live with the new definition, give the new one a new name. See [Zero-downtime changes](/docs/zero-downtime/).

## Coming from Oracle?

- **PostgreSQL has no packages.** Functions and procedures stand on their own. Group them with a name prefix, or put them into a schema of their own.
- **A view does not become invalid.** In Oracle a view is marked invalid when its table changes. PostgreSQL refuses the change instead. MIG-Ace handles this for you, as shown above.
