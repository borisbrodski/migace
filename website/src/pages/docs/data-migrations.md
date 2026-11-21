---
layout: ../../layouts/Doc.astro
title: Data migrations
description: Changing rows safely - batches, checks before and after, and expected row counts.
lead: Many schema changes need the existing rows to change too. MIG-Ace treats these data parts as carefully as the parts that change the schema.
---

## A data part is a normal part

A data part is a part that changes rows. In SQL terms it is DML (`insert`, `update`, `delete`). The parts that change tables and columns are DDL. A data migration is one or more data parts.

In release 1.2.0 every order gets a ship-by date. Existing orders get three days after their creation.

```yaml
  - add-column:
      do: alter table orders add column ship_by date

  - fill-ship-by:
      do: |
        update orders
        set ship_by = cast(created_at as date) + days(3)
        where ship_by is null
```

The `where ship_by is null` matters. It makes the statement safe to continue after an interruption.

## Large tables: `batch`

The `orders` table at Riverside Books has several million rows. One big `update` would lock all of them until it finishes, and customers could not change their orders in the meantime.

```yaml
  - fill-ship-by:
      do: |
        update orders
        set ship_by = cast(created_at as date) + days(3)
        where ship_by is null
      batch: 20000 by id
```

With `batch`, MIG-Ace updates 20,000 rows at a time and saves after each portion.

- Other users wait only briefly.
- If the run is interrupted, it continues with the next portion.
- The ledger shows how far it got.

For small tables you do not need `batch`.

## State what must be true afterwards: `verify-after`

A data part can state its result. If the statement is not true after the part ran, the part fails.

```yaml
  - fill-ship-by:
      do: |
        update orders
        set ship_by = cast(created_at as date) + days(3)
        where ship_by is null
      batch: 20000 by id
      verify-after:
        - all: orders.ship_by is not null
```

There are four kinds of checks:

| Check | True when |
|---|---|
| `all: orders.ship_by is not null` | Every row of `orders` fulfils the condition. |
| `none: book.price_cents < 0` | No row of `book` fulfils it. |
| `exists: order_status.code = 'OPEN'` | At least one row fulfils it. |
| `single: order_status.code = 'UNKNOWN'` | Exactly one row fulfils it. |

When a check fails, MIG-Ace reports how many rows are wrong and shows the ids of a few of them.

## State what you assume: `verify-before`

Release 1.2.0 forbids negative book prices. The constraint can only be added if no such price exists.

```yaml
  - price-not-negative:
      verify-before:
        - none: book.price_cents < 0
      do: alter table book add constraint ck_book_price check (price_cents >= 0)
```

Without the check, PostgreSQL would also refuse the constraint. With it, you get a clear message that names the bad rows before anything is changed.

The difference between the three keys:

| Key | If it is false |
|---|---|
| `when` | The part is skipped. This is normal, not an error. |
| `verify-before` | The part fails and nothing is changed. |
| `verify-after` | The part fails and its change is undone. |

One exception: in a part with `batch`, the portions that were already saved stay. The part is marked as failed, and the next run continues from there.

## Limit the damage: `expect-rows`

Some order items have a quantity of zero. They are leftovers from an old bug, and there should be only a handful.

```yaml
  - remove-empty-items:
      do: delete from order_item where quantity = 0
      expect-rows: 0..50
```

If the statement would delete more than 50 rows, the part fails and nothing is deleted. Your assumption was wrong, and you should look before you delete.

## A longer check

When the four kinds are not enough, write a full condition:

```yaml
      verify-after: |
        not exists (select 1 from orders o
                    where not exists (select 1 from order_status s where s.id = o.status_id))
```

## Data parts are tested on data

The proof loop runs every data part on an older release with rows in it, and on the [test data](/docs/test-data/) of earlier snippets. A data part that only works on an empty table does not pass the build.

The [complete example](/docs/complete-example/) shows these features together in the order-status change.
