---
layout: ../../layouts/Doc.astro
title: Zero-downtime changes
description: Changing the schema while the application keeps running - compatibility between versions, the start and finish phases, renaming a column, and table locks.
lead: If your application must stay available during an upgrade, old and new versions run at the same time for a while. MIG-Ace checks that your schema changes allow this.
---

## The situation

Without downtime, an upgrade has two phases:

1. **Start.** The migration script runs its start phase. The application, still the old version, keeps serving customers. New application instances start, old ones stop, one after the other.
2. **Finish.** When no old instance is left, the script runs its finish phase.

Between the two phases, **old and new application versions work on the same schema**. So the start phase may only contain changes that the old version can live with. Everything else waits for the finish phase.

If you stop the application for every upgrade, you can skip this page. Started without a phase, the script does everything in one run.

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
  ✗ 20260907-1000-customer-email, part drop-fax
    "alter table customer drop column fax"
    Application 1.2.0 reads and writes customer.fax.

  Mark the part with "phase: finish",
  or raise compatible-with in migace.yaml.
```

You then choose: move the part to the finish phase, or decide that the old version no longer needs to work and raise the value.

## Parts for the finish phase

A part that the old version cannot live with gets one more line:

```yaml
  - drop-fax:
      phase: finish
      do: alter table customer drop column fax
```

It runs only in the finish phase, when the old version is gone. `mig make` writes this line itself when it generates such a part.

## Renaming a column

The bookshop wants `customer.email` instead of `customer.mail`. A plain rename would break version 1.2.0 while it is still running. In MigQL it is still one statement:

```yaml
# migrations/20260907-1000-customer-email.migql.yaml
migration: 20260907-1000-customer-email
uid: 01JH5P2R4T6V8X0Z2B4D6F8H0K
doc: The e-mail column is renamed from mail to email

parts:
  - rename-mail:
      do: rename column customer.mail to email
```

MIG-Ace splits it over the two phases:

| Phase | What happens |
|---|---|
| Start | The new column `email` is added, and the existing values are copied in batches. Both columns are kept in step: a write to `mail` by version 1.2.0 also arrives in `email`, and the other way round. |
| Finish | The link between the columns is removed, and `mail` is dropped. |

Version 1.3.0 of the application uses `email`. Version 1.2.0 keeps using `mail`. Both work until you finish.

## Running the two phases

```text
$ java -jar migace-runner.jar --phase start  --url ... migration-script-pg.sql
  ... roll out the new application version ...
$ java -jar migace-runner.jar --phase finish --url ... migration-script-pg.sql
```

- Until you run `finish`, you can go back to the old application version. The database still works with it.
- `finish` is the point of no return. Run it when you are sure that no old instance is left; MIG-Ace cannot see your instances.
- An application that runs the script itself when it starts must pass the phase too, because several versions start during a rolling upgrade.

The build proves both states: after `start` the schema works for the old and the new version, and after `finish` it is exactly the schema your application expects.

## The application check

Each database records which application versions it supports in its current state. Between `start` and `finish` of the upgrade to 1.3.0 these are 1.2.0 and 1.3.0, so instances of both versions pass their [start-up check](/docs/running-migrations/). After `finish` only 1.3.0 passes.

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
