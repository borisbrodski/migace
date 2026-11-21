---
layout: ../../layouts/Doc.astro
title: Statements
description: The statement language used in the do key - schema statements, update, delete, insert and expressions.
lead: The statement in a do key looks like the SQL you know. MIG-Ace reads and checks it, and then writes the exact PostgreSQL statement for you.
---

## Why not plain PostgreSQL SQL?

Because MIG-Ace understands each statement, it can do more than send it to the database:

- It reports a typing mistake in the build, with file and line.
- It knows which tables a statement touches, so it knows which [test data](/docs/test-data/) to check.
- It can warn when a statement would [lock a table for a long time](/docs/zero-downtime/).
- It can run the same snippet on another database later.

When you need something only PostgreSQL offers, use [native SQL](/docs/native-sql/).

## Schema statements

Add a column:

```yaml
  - add-column:
      do: alter table customer add column loyalty_level varchar(10)
```

Make it mandatory:

```yaml
  - make-mandatory:
      do: alter table customer alter column loyalty_level set not null
```

Add a constraint. Give every constraint and index a name, so that later snippets can refer to it:

```yaml
  - price-not-negative:
      do: alter table book add constraint ck_book_price check (price_cents >= 0)
```

Create an index:

```yaml
  - index-book:
      do: create index ix_review_book on review (book_id)
```

Remove a column:

```yaml
  - drop-old-status:
      do: alter table orders drop column status
```

## `ensure column`

Sometimes a column may or may not exist already. Suppose a hotfix added `orders.note` as `varchar(100)` at one store, and the next release wants `varchar(500)` everywhere.

```yaml
  - note-column:
      do: ensure column orders.note varchar(500)
```

`ensure column` does what is needed:

- The column is missing: it is added.
- The column is shorter: it is widened.
- The column already matches: nothing happens.
- Anything else, such as a shorter target: the part fails.

You do not write a condition for this. The statement already says what you want.

## Update

```yaml
  - fill-existing:
      do: update customer set loyalty_level = 'BRONZE'
```

With a condition, and a value looked up in another table:

```yaml
  - link-status:
      do: |
        update orders o
        set status_id = (select s.id from order_status s where s.code = o.status)
        where o.status_id is null
```

## Delete

```yaml
  - remove-empty-items:
      do: delete from order_item where quantity = 0
```

## Insert

In SQL form:

```yaml
  - add-unknown-status:
      do: |
        insert into order_status (id, code, label)
        values (next value for bookshop_seq, 'UNKNOWN', 'Unknown')
```

Or in YAML form, where each value stands next to its column. This is easier to read for wide tables:

```yaml
  - add-unknown-status:
      insert:
        into: order_status
        values:
          id:    next value for bookshop_seq
          code:  'UNKNOWN'
          label: 'Unknown'
```

Several rows at once:

```yaml
  - add-statuses:
      insert:
        into: order_status
        rows:
          - { id: 1, code: 'OPEN',    label: 'Open' }
          - { id: 2, code: 'PAID',    label: 'Paid' }
          - { id: 3, code: 'SHIPPED', label: 'Shipped' }
```

Copy rows from another table:

```yaml
  - archive-old-orders:
      do: |
        insert into orders_archive (id, customer_id, created_at, total_cents)
        select o.id, o.customer_id, o.created_at, o.total_cents
        from orders o
        where o.created_at < date '2020-01-01'
```

## Values and expressions

| You can write | Example |
|---|---|
| Text in single quotes | `'BRONZE'` |
| Numbers and dates | `42`, `date '2026-01-31'` |
| Arithmetic and joining text | `total_cents / 100`, `name \|\| ' (old)'` |
| Comparisons | `=`, `<>`, `<`, `between`, `in (...)`, `like`, `is null` |
| Logic | `and`, `or`, `not` |
| Choices | `case when stock = 0 then 'OUT' else 'OK' end` |
| Functions | `upper`, `lower`, `trim`, `substring`, `length`, `coalesce`, `cast(x as date)`, `days(3)` |
| A value from another table | `(select max(id) from order_status)` |
| A check against another table | `exists (select 1 from orders o where o.customer_id = c.id)` |
| The next id | `next value for bookshop_seq` |

Text needs single quotes. A word without quotes is a column name, so `code: OPEN` is reported as an unknown column.

## Your snippets keep their meaning

A snippet you write today is run by databases for years. An update of MIG-Ace therefore never changes what a released statement does: the same statement keeps producing SQL with the same effect.

## What the statement language leaves out

- Joins in `update` and `delete`. Use a subquery, as in the `link-status` example.
- `select` with joins or grouping.
- Anything specific to PostgreSQL, such as special index types.

For these, use [native SQL](/docs/native-sql/). MIG-Ace tells you when a statement belongs there.
