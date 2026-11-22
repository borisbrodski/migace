---
layout: ../../layouts/Doc.astro
title: Conditions
description: Running a part or a snippet only when it is needed.
lead: Not every database is in the same state. A condition lets a part run only where it is needed.
---

## When you need a condition

Most snippets need none. A part that already ran is skipped anyway, and the action [`column-ensure`](/docs/actions/#column-ensure) handles a column that may already exist.

You need a condition when the right action depends on the state of that one database. The bookshop has three stores on three different releases, so this happens.

## A condition on a part

Release 1.4.0 removes the old free-text column `orders.status`. Before that, one last copy of unusual values is saved, but only if the column is still there.

```yaml
  - keep-odd-values:
      when: column orders.status exists
      do: |
        insert into order_status_legacy (order_id, old_status)
        select o.id, o.status from orders o
        where o.status_id = (select id from order_status where code = 'UNKNOWN')
```

If the condition is false, the part is skipped and recorded as skipped. That is not an error.

## What you can test

**The current schema**

```yaml
      when: table order_status_legacy exists
```

```yaml
      when: column orders.status exists
```

```yaml
      when: not index ix_orders_customer exists
```

**The data**

```yaml
      when: exists (select 1 from orders where ship_by is null)
```

**The history of this database**

```yaml
      when: ran order-status.link-status from 1.2.0
```

This is true if this database ran the part `link-status` in the version that release 1.2.0 shipped. The snippet is named without the date and time at the start of its file name. The reference therefore still works after the snippet was [moved](/docs/fixing-mistakes/). It is how a [repair](/docs/fixing-mistakes/) finds the databases that need it.

You can combine conditions with `and`, `or` and `not`.

## Prefer the state over the history

A condition on the current state works no matter how the database got there:

```yaml
      when: column orders.status exists
```

Use a condition on the history only when the state cannot tell you what you need to know, as in a repair.

## Name a condition: `let`

If you use a condition more than once, give it a name at the top of the snippet.

```yaml
let:
  has_old_status: column orders.status exists

parts:
  - keep-odd-values:
      when: has_old_status
      do: |
        insert into order_status_legacy (order_id, old_status)
        select o.id, o.status from orders o
        where o.status_id = (select id from order_status where code = 'UNKNOWN')

  - drop-old-status:
      when: has_old_status
      do: alter table orders drop column status
```

## A condition on the whole snippet

A `when` at the top applies to every part.

```yaml
repair: 20260622-0900-repair-order-status
uid: 01JG8T3B6X9D2F5H7K1M4Q0W8Z
when: ran order-status.link-status from 1.2.0
```

## Skipped is checked again

A part that ran is done for good. A part that was skipped is different: MIG-Ace evaluates its condition again on the next run.

So a repair that was not needed yesterday still runs tomorrow if the database then needs it.

## Do not repeat the statement

A condition should not say what the statement already says.

```yaml
  # Not needed: the condition repeats the statement
  - note-column:
      when: not column orders.note exists
      do: alter table orders add column note varchar(500)
```

```yaml
  # Better
  - note-column:
      column-ensure: { table: orders, column: note, type: varchar(500) }
```

## Every branch is tested

A condition creates two paths, and an untested path is a risk. After the proof loop, MIG-Ace reports for each condition whether it was seen both true and false across all tested releases.

```text
conditions
  20260622-0900-repair-order-status   when   true on 1.2.0, false on 1.1.0 and 1.1.1   ok
```

If one side was never seen, the build warns you.
