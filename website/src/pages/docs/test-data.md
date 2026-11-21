---
layout: ../../layouts/Doc.astro
title: Test data
description: Rows that travel with a snippet so every migration is tested on tables that are not empty.
lead: A migration that works on an empty table proves little. Each snippet therefore brings rows for the tables it changes.
---

## Why rows belong to a snippet

Imagine the `review` table from release 1.1.0 had no rows in any test database. A later snippet adds a mandatory column to it. The statement succeeds in the build, because the table is empty, and fails at the first store that has reviews.

With test data, the table has rows from the moment it is created, in every build from then on.

## Rows for a new table

```yaml
testdata:
  - table: review
    fill: all
    row: { stars: 5, review_text: 'Could not put it down.' }
  - table: review
    fill: required
    row: { stars: 1 }
```

The proof loop inserts these rows after the snippet ran.

## Two kinds of rows

- **`fill: all`** creates a row in which every column has a value.
- **`fill: required`** creates a row in which only the mandatory columns have a value. All others are empty.

Both are needed, because they catch different mistakes:

| Later change | Caught by |
|---|---|
| A column gets a shorter type, and existing values do not fit. | the `all` row |
| A column becomes mandatory, and no value is provided for existing rows. | the `required` row |

## You write what matters, MIG-Ace fills the rest

In the example above you chose the stars and the text. MIG-Ace supplies everything else:

- an `id` from the sequence,
- a `created_at`,
- a `book_id` and a `customer_id` that point to existing rows.

Generated values respect the column type, its length and its check constraints. The same build always produces the same values, so a failure can be repeated.

MIG-Ace never inserts rows on its own. A table gets test rows only where a snippet has a `testdata` entry.

## Refer to other rows

To point at any existing row of the referenced table, write `any`:

```yaml
testdata:
  - table: review
    fill: all
    row: { stars: 4, book_id: any, customer_id: any }
```

To build rows that belong together, give a row a name with `as` and refer to its columns:

```yaml
testdata:
  - table: customer
    as: maria
    fill: all
    row: { name: 'Maria Example', loyalty_level: 'GOLD' }
  - table: orders
    as: first_order
    fill: all
    row: { customer_id: maria.id, status: 'SHIPPED' }
  - table: order_item
    fill: all
    row: { order_id: first_order.id, quantity: 2 }
```

## Rows that must exist before the snippet runs

A data part needs rows in the old shape. The release-1.2.0 snippet that turns the free-text status into a table wants to see the untidy values that exist in real databases.

```yaml
testdata-before:
  - table: orders
    fill: all
    row: { status: 'shipped ' }
  - table: orders
    fill: all
    row: { status: 'Paid' }
```

`testdata-before` rows are inserted before the first part runs. This is exactly the kind of row that would have revealed the bug described in [Fixing mistakes](/docs/fixing-mistakes/).

## The coverage rule

After each snippet, MIG-Ace checks the tables the snippet changed. Each must contain at least one `all` row and one `required` row.

```text
test data
  ✗ review has no row with a value in every column
    missing: review_text
    Add a testdata entry with "fill: all" to 20260309-1400-review-table.
```

Only affected tables are checked: those whose columns changed, and those that a data part wrote to. A snippet that only adds an index triggers no check.

## Let the editor write the skeleton

In VS Code and IntelliJ IDEA, the quick fix on that error inserts a `testdata` entry that lists every column. You replace the values that should be meaningful and delete the rest.
