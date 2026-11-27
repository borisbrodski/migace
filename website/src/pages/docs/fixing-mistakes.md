---
layout: ../../layouts/Doc.astro
title: Fixing mistakes
description: Changing a released snippet, repairing databases that ran the old version, and other tools for the day something went wrong.
lead: Sooner or later a migration that was already released turns out to be wrong. MIG-Ace expects this and gives you a clear way through.
---

## The mistake

Release 1.2.0 of the bookshop moved the order status from free text into a table. One part matched each order to its new status:

```yaml
  - link-status:
      do: |
        update orders o
        set status_id = (select s.id from order_status s where s.code = o.status)
        where o.status_id is null
```

The match is exact. But real databases contain `shipped`, `Shipped ` and `PAID ` next to `SHIPPED` and `PAID`. Those orders found no match, and the next part set them to `UNKNOWN`.

Riverside Books has already installed 1.2.0. Old Town Books and Harbour Books have not.

So two things are needed:

1. Stores that have **not** run the snippet must get a correct version.
2. Stores that **have** run it must be repaired.

## Step 1: fix the snippet

Correct the part, and say why:

```yaml
migration: 20260518-1000-order-status
uid: 01JG1D5R8Y3B6F9J2L4N7Q0T3W
changed: Status values were matched exactly; now case and spaces are ignored

parts:
  # ...
  - link-status:
      do: |
        update orders o
        set status_id = (select s.id from order_status s
                         where s.code = upper(trim(o.status)))
        where o.status_id is null
```

What happens at each store:

| Store | Has it run `link-status`? | What the script does |
|---|---|---|
| Riverside Books | yes, the old version | Skips the part. A part that ran is never run again. |
| Old Town Books | no | Runs the corrected version. |
| Harbour Books | no | Runs the corrected version. |

The ledger at Riverside Books keeps the statement that really ran there. Nothing is rewritten.

## Why `changed` is required

Without the `changed` line, the build fails:

```text
$ mig test
released snippets
  ✗ 20260518-1000-order-status, part link-status
    differs from what release 1.2.0 shipped.
    If this change is intended, add "changed: <reason>" to the snippet.
```

This protects you from the opposite mistake: changing an old snippet by accident, for example through search-and-replace. Such a change would otherwise go unnoticed, because databases that ran the part skip it.

The next release records the new version and removes the `changed` line. From then on the snippet is protected again.

## Step 2: repair where the old version ran

A repair snippet runs only where it is needed.

```yaml
# migrations/20260622-0900-repair-order-status.migql.yaml
repair: 20260622-0900-repair-order-status
uid: 01JG8T3B6X9D2F5H7K1M4Q0W8Z
doc: Orders wrongly set to UNKNOWN by release 1.2.0 get their real status

parts:
  - relink:
      when: ran order-status.link-status from 1.2.0
      do: |
        update orders o
        set status_id = (select s.id from order_status s
                         where s.code = upper(trim(o.status)))
        where o.status_id = (select id from order_status where code = 'UNKNOWN')
          and exists (select 1 from order_status s
                      where s.code = upper(trim(o.status)))
```

The condition is true only for databases that ran `link-status` in the version shipped with 1.2.0. That is Riverside Books. At the other two stores the part is skipped.

A condition always stands on a part and names a part. See [Conditions](/docs/conditions/).

The repair is possible because release 1.2.0 kept the old `status` column. Removing an old column one release later is a good habit for exactly this reason.

## When a repair cannot be automatic

Sometimes the information needed for a repair is gone. Then say so, and stop.

```yaml
  - no-source-left:
      when: not column orders.status exists
      stop: |
        The original status text is no longer in this database.
        Restore the column orders.status from a backup taken before release 1.2.0,
        then run the migration script again.
```

`stop` ends the run with your message. After the administrator has acted, the next run evaluates the condition again and continues.

## A snippet that should never run again

If a snippet was a bad idea altogether, retire it.

```yaml
migration: 20260415-1600-orders-extra-index
uid: 01JFZ2K4M6P8R0T2V4X6Z8B0D2
retired: The index slowed down the nightly import. Removed again in 20260420-0900.

parts:
  - index:
      do: create index ix_orders_extra on orders (customer_id, created_at, status)
```

Databases that have not run it never will. Databases that have run it keep their record. The file stays, because those records refer to it.

## A part that should never run again

Often only one part of a snippet was the bad idea. Retire that part and leave the rest.

```yaml
parts:
  - status-table:
      do: create table order_status (id bigint primary key, code varchar(20) not null)

  - guess-status:
      retired: Guessed the status from free text and was wrong too often. See the repair of 20260622.
      do: |
        update orders set status_id = (select id from order_status where code = 'UNKNOWN')
        where status_id is null
```

The part never runs again on any database. A condition in another snippet can still name it: `ran order-status.guess-status` stays true where it ran, and that is how a repair finds those databases.

## Renaming a part or a snippet

The ledger knows a part by its snippet and its name. If you simply change the name, the part looks new and would run a second time.

Say what the old name was:

```yaml
  - link-status:
      former-names: [link-staus]
      do: |
        update orders o
        set status_id = (select s.id from order_status s where s.code = upper(trim(o.status)))
```

- Databases that ran the part under its old name know it as done.
- Conditions in other snippets that still say `ran order-status.link-staus` keep working. This matters for released snippets, which you do not edit.

A snippet has the same key for its own name, without the date and time:

```yaml
migration: 20260518-1000-order-status
uid: 01JG0V7C9E1G3J5L7N9Q1S3U5W
former-names: [order-state]
```

If you forget, MIG-Ace notices. A database that has a record of a part the script does not know, in a snippet with a part that has not run, stops before that snippet and tells you to add `former-names`. The build makes the same check against your releases.

## Moving a snippet

Snippets run in name order. To move one, rename the file and the `migration` line.

```yaml
migration: 20260510-0800-order-status-table     # was 20260520-1700-…
uid: 01JG0V7C9E1G3J5L7N9Q1S3U5W
```

Databases that already ran it recognise it by its `uid` and do nothing. Databases that have not run it now run it earlier.

## A repair that needs the shop closed

Some repairs cannot be done while the application is running. Mark them:

```yaml
repair: 20260701-0600-rebuild-order-totals
uid: 01JGA6H8K0M2P4R6T8V0X2Z4B6
requires-downtime: true
```

The script refuses to run such a snippet unless you start it with `--maintenance`, and it checks that no application instance is connected.

## Summary

| Situation | Tool |
|---|---|
| A released part is wrong | Fix it and add `changed: <reason>` |
| Databases already ran the wrong part | A `repair` snippet with `when: ran …` |
| A repair is impossible without a human | `stop` with instructions |
| A snippet or one part should never run again | `retired` |
| A part or a snippet gets a new name | `former-names` |
| A snippet must run earlier or later | Rename it |
| A repair needs the application stopped | `requires-downtime` |
