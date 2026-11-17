---
layout: ../../layouts/Doc.astro
title: Getting started
description: One schema change, from the entity class to a proven migration.
lead: This page follows one small change through the whole process. It takes about fifteen minutes to read and uses the bookshop example.
---

## What you need

- A Jakarta EE or other Java project that uses Hibernate, built with Gradle.
- PostgreSQL 16 or newer in production.

You do not need Docker or a test database server. MIG-Ace starts its own temporary PostgreSQL for the proof.

## Add MIG-Ace to the build

```kotlin
// build.gradle.kts
plugins {
    id("org.openbrod.migace") version "0.1.0"
}
```

The plugin gives you the `mig` commands. Each command is also a Gradle task: `mig test` is the same as `./gradlew migTest`.

## The project layout

```text
bookshop/
  migace.yaml          settings
  schema/              the schema your application expects
    101-generated.sql    written by Hibernate during the build
    102-indexes.sql      written by hand
  migrations/          one file per change
  releases/            one file per release
```

## Step 1: change the entity

The bookshop wants a loyalty level for every customer.

```java
@Entity
public class Customer {
    // ...

    @Column(name = "loyalty_level", length = 10, nullable = false)
    private String loyaltyLevel;
}
```

The next build regenerates `schema/101-generated.sql`. The `customer` table in it now has a mandatory column `loyalty_level`.

## Step 2: let MIG-Ace write the snippet

```text
$ mig make customer-loyalty

Comparing schema/ with the migrated release 1.0.0
  + column customer.loyalty_level varchar(10) not null

Wrote migrations/20260302-0900-customer-loyalty.mig.yaml
  ! customer has rows. Choose a value for existing customers in part "fill-existing".
```

MIG-Ace saw that the column is mandatory and that the table has rows. It wrote three parts and left the middle one for you:

```yaml
parts:
  - add-column:
      do: alter table customer add column loyalty_level varchar(10)

  - fill-existing:
      do: update customer set loyalty_level = ?   # TODO: value for existing rows

  - make-mandatory:
      do: alter table customer alter column loyalty_level set not null
```

## Step 3: decide what happens to existing rows

Only you know the right value. Existing customers start as bronze:

```yaml
  - fill-existing:
      do: update customer set loyalty_level = 'BRONZE'
```

## Step 4: add test data

A snippet that changes a table brings rows for it. The proof loop inserts them after the snippet ran.

```yaml
testdata:
  - table: customer
    fill: all
    row: { loyalty_level: 'GOLD' }
  - table: customer
    fill: required
```

`fill: all` creates a row where every column has a value. `fill: required` creates a row with only the mandatory columns. You write the values that matter, and MIG-Ace fills in the rest. [Test data](/docs/test-data/) explains why both rows are needed.

## Step 5: prove it

```text
$ mig test

schema A    built from schema/               ok
schema B    release 1.0.0 with data loaded   ok
migrate     1 snippet, 3 parts               ok
test data   customer rows present            ok
compare     A = B, no differences            ok
run again   nothing left to do               ok

Proven. Fingerprint 9f3c…e1a7
```

If you had forgotten the `fill-existing` part, the same command would have failed:

```text
migrate     20260302-0900-customer-loyalty
  ✗ part make-mandatory failed on release 1.0.0
    ERROR: column "loyalty_level" of relation "customer" contains null values
    3 rows in customer have no loyalty_level
```

This is the error you would otherwise meet in production.

## Step 6: build the migration script

```text
$ mig compile
Wrote build/migace/migration-script-pg.sql
```

This one file contains every snippet. It is what you deliver together with the application.

## Step 7: run it

```text
$ java -jar migace-runner.jar \
    --url jdbc:postgresql://db.example/bookshop --user bookshop_owner \
    build/migace/migration-script-pg.sql

20260302-0900-customer-loyalty
  add-column        done
  fill-existing     done   1,284 rows
  make-mandatory    done
Schema fingerprint 9f3c…e1a7 matches.
```

Start the new application version afterwards. [Running migrations](/docs/running-migrations/) shows the start-up check and what to do when a run fails.

## What you have now

- A migration that is proven on a database with data.
- A record in the database of every part that ran.
- An application that refuses to start on the wrong schema.

Next: read about [snippets](/docs/snippets/), or see [the bookshop example](/docs/bookshop/) for the releases that follow.
