---
layout: ../../layouts/Doc.astro
title: Releases and branches
description: Release files, hotfixes, cherry-picks, skipped versions and archiving old snippets.
lead: MIG-Ace remembers what each release shipped. That is what lets it protect released snippets, test every upgrade path and handle hotfixes.
---

## Released and unreleased

A snippet is **unreleased** until a release includes it. While unreleased, you can change, rename or delete it freely.

Once **released**, a snippet may already have run at a customer. From then on MIG-Ace watches it: a change needs a reason. See [Fixing mistakes](/docs/fixing-mistakes/).

## The release command

Your release build runs one command:

```text
$ mig release 1.1.0
Wrote releases/1.1.0.yaml
  2 new snippets
```

It writes a small file that lists the snippets that are new in this release, with a short hash of each part.

```yaml
# releases/1.1.0.yaml
release: 1.1.0
date: 2026-03-20
based-on: [1.0.0]
snippets:
  01JF2A6QW3ZK8M4T7R9B5X0C1D: { add-column: 9f3e21, fill-existing: ab12cd, make-mandatory: 77a0b4 }
  01JF4C9S2M7H5K3P8V6N1Y0E4R: { create-table: 3c9e10, fk-book: a44b07, fk-customer: 0d51fe, index-book: 51c0aa }
```

Commit this file. You never edit it by hand.

## Branches merge without ceremony

Two developers work on two branches. Each adds a snippet.

```text
feature/reviews     migrations/20260309-1400-review-table.migql.yaml
feature/loyalty     migrations/20260302-0900-customer-loyalty.migql.yaml
```

Both branches are merged. Git sees two new files and has nothing to resolve. The snippets run in name order.

Whether the two changes fit together is decided by the [proof loop](/docs/proof-loop/) in CI. If both snippets add the same column, the merged build fails with a clear message. There are no merge migrations to write.

## A hotfix

Harbour Books is on 1.1.0 and complains that the order list is slow. An index fixes it, and they need it now.

The snippet is written on the main branch and copied to the 1.1 branch with `git cherry-pick`.

```yaml
# migrations/20260401-0830-orders-customer-index.migql.yaml
migration: 20260401-0830-orders-customer-index
uid: 01JFM8W1Y3A5C7E9G1J3L5N7Q9
doc: The order list of a customer loads quickly

parts:
  - index:
      do: create index ix_orders_customer on orders (customer_id)
```

Release 1.1.1 is built from the 1.1 branch:

```yaml
# releases/1.1.1.yaml   (on the 1.1 branch)
release: 1.1.1
based-on: [1.1.0]
snippets:
  01JFM8W1Y3A5C7E9G1J3L5N7Q9: { index: e802f3 }
```

Later, release 1.2.0 is built from the main branch. It contains the same snippet.

Each release wrote its own file, so the two branches never changed the same file. When the 1.1 branch is merged back, git has nothing to resolve here either.

## What each store runs

| Store | Before | After | The index snippet |
|---|---|---|---|
| Harbour Books | 1.1.0 | 1.1.1 | Runs. |
| Harbour Books | 1.1.1 | 1.3.0 | Skipped, it already ran. |
| Old Town Books | 1.1.0 | 1.2.1 | Runs. |

A database always applies every snippet it has not run yet, in name order. That also works when a snippet is older than others that already ran, which is normal after a hotfix.

## Skipped versions

Harbour Books jumps from 1.1.1 to 1.3.0. There is no special path for this. The script applies everything that database is missing.

The proof loop tests this jump in every build, because 1.1.1 is one of the releases it starts from.

One more check runs at release time: a snippet that an older release shipped must still exist. If a hotfix was never merged back to the main branch, `mig release` fails and names it.

## Which releases are tested

`migace.yaml` says which is the oldest release a database may still be on.

```yaml
# migace.yaml
upgrade-from: 1.1.0
```

Every release from this one on is a starting point of the proof loop. When no store is on 1.1.0 any more, raise the value.

## Archiving old snippets

After some years a project has hundreds of snippets that every store ran long ago.

```text
$ mig archive --up-to 1.1.0
Moved 2 snippets to migrations/archive/
The starting schema is now release 1.1.0.
Set upgrade-from: 1.1.0 in migace.yaml.
```

- The old snippets move to a backup folder and leave the migration script.
- The starting point of all migrations moves forward to that release.
- `upgrade-from` in the [project file](/docs/configuration/) is set to that release, because older databases can no longer be upgraded in one step.
- MIG-Ace still knows the archived snippets by their `uid`, so the records in older databases stay meaningful.

A database that is older than the new starting point is told which release to install first.
