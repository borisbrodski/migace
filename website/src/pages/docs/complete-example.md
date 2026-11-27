---
layout: ../../layouts/Doc.astro
title: Complete example
description: One snippet from the bookshop that uses most features together.
lead: The other pages show one feature at a time. This page shows one real snippet that uses most of them, with notes below.
---

## The change

Until release 1.1 the status of an order is free text in `orders.status`. Release 1.2.0 introduces a table `order_status` and a reference to it.

The `Order` entity now has a `@ManyToOne` field for the status, so Hibernate expects a table `order_status` and a mandatory column `orders.status_id`.

## The snippet

```yaml
# migrations/20260518-1000-order-status.migql.yaml
migration: 20260518-1000-order-status
uid: 01JG1D5R8Y3B6F9J2L4N7Q0T3W
doc: The order status moves from free text into the table order_status

parts:
  - create-status-table:
      do: |
        create table order_status (
          id    bigint      not null,
          code  varchar(20) not null,
          label varchar(50) not null,
          primary key (id),
          constraint uq_order_status_code unique (code)
        )

  - add-statuses:
      insert:
        into: order_status
        rows:
          - { id: 1, code: 'OPEN',      label: 'Open' }
          - { id: 2, code: 'PAID',      label: 'Paid' }
          - { id: 3, code: 'SHIPPED',   label: 'Shipped' }
          - { id: 4, code: 'CANCELLED', label: 'Cancelled' }
          - { id: 5, code: 'UNKNOWN',   label: 'Unknown' }

  - add-status-id:
      do: alter table orders add column status_id bigint

  - link-status:
      do: |
        update orders o
        set status_id = (select s.id from order_status s
                         where s.code = upper(trim(o.status)))
        where o.status_id is null
      batch: 20000 by id

  - default-unknown:
      do: |
        update orders
        set status_id = (select id from order_status where code = 'UNKNOWN')
        where status_id is null
      expect-rows: 0..1000
      verify-after:
        - all: orders.status_id is not null

  - status-fk:
      constraint-add-foreign-key: { name: fk_orders_status, table: orders, columns: status_id, references: order_status }

  - status-mandatory:
      column-set-not-null: { table: orders, column: status_id }

testdata-before:
  - table: orders
    fill: all
    row: { status: 'shipped ' }
  - table: orders
    fill: all
    row: { status: 'no idea' }

testdata:
  - table: order_status
    fill: all
    row: { code: 'TEST', label: 'Only in tests' }
  - table: orders
    fill: required
    row: { status_id: any }
```

## What each part shows

| Part | Feature | Read more |
|---|---|---|
| `create-status-table` | A schema statement in a block. The constraint has a name. | [Statements](/docs/statements/) |
| `add-statuses` | Rows inserted in YAML form. | [Statements](/docs/statements/) |
| `add-status-id` | A new column, optional at first, so existing rows are allowed. | [Getting started](/docs/getting-started/) |
| `link-status` | An `update` with a value looked up in another table, run in batches. | [Data migrations](/docs/data-migrations/) |
| `default-unknown` | `expect-rows` limits the damage. `verify-after` states the result. | [Data migrations](/docs/data-migrations/) |
| `status-fk` | A foreign key. MIG-Ace adds it without blocking the table for long. | [Zero-downtime changes](/docs/zero-downtime/) |
| `status-mandatory` | The column becomes mandatory only after every row has a value. | [Zero-downtime changes](/docs/zero-downtime/) |
| `testdata-before` | Untidy rows in the old shape, so the data parts are really tested. | [Test data](/docs/test-data/) |
| `testdata` | A full row for the new table and a minimal row for the changed one. | [Test data](/docs/test-data/) |

## What is not in the snippet

- **No part removes `orders.status`.** The old column stays for one more release. If the mapping turns out to be wrong, the information is still there. [Fixing mistakes](/docs/fixing-mistakes/) tells that story.
- **No conditions.** Every part is needed everywhere, and parts that already ran are skipped anyway.
- **No snippet for views.** A view that changed is replaced at the end of the run from the [schema folder](/docs/desired-schema/); the others are not touched.

## Proving it

```text
$ mig test

from 1.1.0   3 snippets to apply    A = B   ok
from 1.1.1   2 snippets to apply    A = B   ok

20260518-1000-order-status
  link-status       1 of 2 test rows matched
  default-unknown   1 row set to UNKNOWN, within 0..1000
  verify-after      all orders have a status_id

Proven. Fingerprint 4be1…07c2
```

The test row `'shipped '` was matched, because the statement ignores case and spaces. The row `'no idea'` became `UNKNOWN`, which is the intended result.

## Running it at Old Town Books

```text
20260518-1000-order-status
  create-status-table   done
  add-statuses          done   5 rows
  add-status-id         done
  link-status           done   418,220 rows in 21 batches
  default-unknown       done   37 rows
  status-fk             done
  status-mandatory      done
```
