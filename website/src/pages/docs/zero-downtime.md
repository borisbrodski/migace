---
layout: ../../layouts/Doc.astro
title: Zero-downtime changes
description: Changing the schema while the application keeps running - compatibility between versions, renaming a column in two steps, and table locks.
lead: If your application must stay available during an upgrade, old and new versions run at the same time for a while. MIG-Ace checks that your schema changes allow this.
---

## The situation

Without downtime, an upgrade looks like this:

1. The migration script runs. The application, still the old version, keeps serving customers.
2. New application instances start, one after the other.
3. Old instances stop, one after the other.

Between step 1 and step 3 the **old application version works on the new schema**. A schema change that the old version cannot live with breaks the shop for those minutes.

If you stop the application for every upgrade, you can skip this page.

## Which changes are safe

| Change | Old version keeps working? |
|---|---|
| Add a table | yes |
| Add an optional column | yes |
| Add a mandatory column with a default value | yes |
| Add an index | yes |
| Make a column longer | yes |
| Add a mandatory column without a default | **no**, the old version cannot insert rows |
| Rename a column or a table | **no**, the old version uses the old name |
| Remove a column or a table | **no** |
| Make a column shorter or change its type | **no** |

## MIG-Ace checks this for you

Tell MIG-Ace the oldest application version that may still be running during an upgrade.

```yaml
# migace.yaml
compatible-with: 1.2.0
```

The build compares the schema of that release with the current one and reports every change the older version cannot live with.

This setting is separate from `upgrade-from`, the oldest release a database may be upgraded from. Harbour Books jumps from 1.1.1 to 1.3.0. That upgrade is proven, but version 1.1.1 is older than `compatible-with`, so Harbour Books stops the application while the script runs.

```text
$ mig test
compatibility with 1.2.0
  ✗ 20260907-1000-customer-email, part rename
    "alter table customer rename column mail to email"
    Application 1.2.0 reads and writes customer.mail.

  Use "expand column" now and "contract column" in a later release,
  or raise compatible-with in migace.yaml.
```

You then choose: change the migration, or decide that the old version no longer needs to work and raise the value.

## Renaming a column in two releases

The bookshop wants `customer.email` instead of `customer.mail`. A plain rename would break version 1.2.0 while it is still running. The safe way takes two releases.

**Release 1.3.0: expand.** Both columns exist.

```yaml
# migrations/20260907-1000-customer-email.migql.yaml
migration: 20260907-1000-customer-email
uid: 01JH5P2R4T6V8X0Z2B4D6F8H0K
doc: The e-mail column is renamed from mail to email, step 1 of 2

parts:
  - expand:
      do: expand column customer.mail to email
```

`expand column` does three things:

- It adds the new column `email`.
- It copies the existing values in batches.
- It keeps both columns in step while both exist. A write to `mail` by version 1.2.0 also arrives in `email`, and the other way round.

Version 1.3.0 of the application uses `email`. Version 1.2.0 keeps using `mail`. Both work.

**Release 1.4.0: contract.** Only the new column remains.

```yaml
# migrations/20261116-0900-customer-email-contract.migql.yaml
migration: 20261116-0900-customer-email-contract
uid: 01JK2M4P6R8T0V2X4Z6B8D0F2H
doc: The e-mail column is renamed from mail to email, step 2 of 2

parts:
  - contract:
      do: contract column customer.mail
```

MIG-Ace accepts this snippet only when `compatible-with` is 1.3.0 or later, because version 1.2.0 would not survive it.

## The application check

Each database keeps a list of schema fingerprints it is compatible with. During the upgrade to 1.3.0 that list contains the fingerprints of 1.2.0 and 1.3.0, so instances of both versions pass their [start-up check](/docs/running-migrations/).

## Locks: the second thing that stops a shop

A schema statement locks its table while it runs. Most statements finish in milliseconds. A few take as long as the table is large, and during that time nobody can read or write the table.

MIG-Ace handles the common cases for you:

| You write | What MIG-Ace runs |
|---|---|
| `alter column … set not null` | A sequence of steps that checks the rows without blocking readers and writers. |
| `add constraint … foreign key` | Adds the constraint first and validates the existing rows afterwards. |
| `create index concurrently …` | Builds the index while the table stays usable. |
| Any schema statement | Waits only briefly for its lock and tries again, instead of making other users queue behind it. |

For statements it cannot make safe, it warns you in the build:

```text
$ mig test
locks
  ! 20260914-1100-item-price, part widen
    "alter table order_item alter column price_cents type bigint"
    rewrites the whole table and blocks it meanwhile.
    Measured on release 1.2.0: 4.1 s for 2.4 million rows.
```

The duration is measured on your baseline, not guessed.

## When downtime is the right choice

Some changes are not worth the effort of doing them online. Say so in the snippet:

```yaml
migration: 20260914-1100-item-price
uid: 01JH7R9T1V3X5Z7B9D1F3H5K7M
requires-downtime: true
```

The script runs such a snippet only when started with `--maintenance`, and only when no application instance is connected.
