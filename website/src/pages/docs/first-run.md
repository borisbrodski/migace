---
layout: ../../layouts/Doc.astro
title: New and existing databases
description: How the ledger tables are created, how a new database is installed, and how a database that existed before MIG-Ace is adopted.
lead: You never set up MIG-Ace in a database by hand. The migration script looks at the database it is given and decides what to do.
---

## Three situations

| The script finds | What it does |
|---|---|
| The ledger tables | It **migrates**. Parts that are missing are applied. This is the normal case, described in [Running migrations](/docs/running-migrations/). |
| An empty database | It **installs**. It creates the ledger tables and the complete schema of the current release. |
| Tables, but no ledger | It **stops**. This database was not created by MIG-Ace. You adopt it once, see below. |

In all three situations you run the same script in the same way.

## A new, empty database

A fourth store, Lakeside Books, starts with release 1.4.0 of the bookshop. Its database is empty.

```text
$ java -jar migace-runner.jar \
    --url jdbc:postgresql://db.lakeside.example/bookshop --user bookshop_owner \
    migration-script-pg.sql

Empty database. Installing release 1.4.0.
  ledger tables                   created
  tables, indexes, sequences      created
  views, functions and triggers   created
  14 snippets                     recorded as included
Schema fingerprint 4be1…07c2 matches.
```

Three things happened:

- **The ledger tables were created.** There is no separate set-up script.
- **The schema was created in its final form**, from the files in the [schema folder](/docs/desired-schema/). No snippet ran. A new database does not need to repeat the history from 1.0.0 to 1.4.0.
- **Every snippet was recorded as `included`.** The ledger now says that this database already contains them. The next release applies only its own new snippets.

This is safe because the [proof loop](/docs/proof-loop/) checks it in every build: installing on an empty database and migrating an older release must give exactly the same schema.

### Rows a new database needs

Some tables need rows from the first day. In the bookshop that is `order_status`. The existing stores got these rows from the part `add-statuses` of a snippet. A new database runs no snippets, so the same rows also belong in the schema folder:

```sql
-- schema/130-reference-data.sql
insert into order_status (id, code, label) values
  (1, 'OPEN',      'Open'),
  (2, 'PAID',      'Paid'),
  (3, 'SHIPPED',   'Shipped'),
  (4, 'CANCELLED', 'Cancelled'),
  (5, 'UNKNOWN',   'Unknown');
```

Name such tables in the [project file](/docs/configuration/), and the proof loop compares their rows as well:

```yaml
# migace.yaml
reference-tables:
  - order_status
```

If the snippet and the schema file ever disagree, the build fails and shows the rows that differ.

## A database from an older release

This is the normal case. The ledger tells the script which snippets the database already has, and the script applies the rest. See [Running migrations](/docs/running-migrations/).

## A database that existed before MIG-Ace

The bookshop was already in production at three stores when the team started to use MIG-Ace, at release 1.0.0. Those databases had tables and no ledger. The script does not guess what such a database is:

```text
This database has tables but no MIG-Ace ledger.
If it is on a known release, run again with --adopt <release>.
Known releases: 1.0.0
```

You tell it once which release the database is on:

```text
$ java -jar migace-runner.jar \
    --url jdbc:postgresql://db.riverside.example/bookshop --user bookshop_owner \
    --adopt 1.0.0 migration-script-pg.sql

Adopting this database as release 1.0.0.
  schema fingerprint    9a40…e1d3 matches release 1.0.0
  ledger tables         created
Continuing with the migration.
```

From Java it is one more line:

```java
MigAce.fromJar(BookshopApp.class, "/migace/migration-script-pg.sql")
      .adopt("1.0.0")
      .exec(dataSource);
```

MIG-Ace does not simply believe you. It reads the real schema and compares its [fingerprint](/docs/desired-schema/) with the one of the release you named. If they differ, nothing is changed:

```text
Cannot adopt this database as release 1.0.0. The schema differs:
  + column customer.fax          is in the database, not in release 1.0.0
  - index ix_orders_customer     is in release 1.0.0, not in the database
```

Why do you have to name the release at all? MIG-Ace can check the structure of a database. It cannot see which data changes the database has been through. You know that, so you say it.

You adopt a database once. After that it has a ledger, and `--adopt` is ignored.

## The ledger tables look after themselves

- The script creates the [ledger tables](/docs/running-migrations/) on the first run.
- When a newer MIG-Ace version needs another column in them, the script adds it at the start of the run.
- Their names start with `mig_`. If that clashes with your own tables, change `ledger.prefix` in the [project file](/docs/configuration/).
- They are not part of your schema. The comparison and the fingerprint leave them out, and you do not need entity classes for them.

## Two runs at the same time

Three application instances start together, and each one calls `MigAce.execFromJar(...)`. The script takes a lock in the database before it does anything. One instance migrates. The other two wait, find nothing left to do, and start.

## What the database user needs

| User | Needs |
|---|---|
| The user that runs the migration | The right to create and change objects in the schema. Usually this is the owner of the schema. |
| The application user, if it is a different one | Read access to `mig_meta`, for the [check at application start](/docs/running-migrations/). |
