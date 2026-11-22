---
layout: ../../layouts/Doc.astro
title: Getting started
description: One schema change, from the entity class to a proven migration that runs from your JAR.
lead: This page follows one small change through the whole process. You change an entity, MIG-Ace writes the migration, proves it, and your application runs it.
---

## What you need

- A Jakarta EE or other Java project that uses Hibernate, built with Gradle.
- PostgreSQL 16 or newer in production.

You do not need Docker or a test database server. MIG-Ace brings its own PostgreSQL for the proof.

## Add MIG-Ace to the build

```kotlin
// build.gradle.kts
plugins {
    id("org.openbrod.migace") version "0.1.0"
}

dependencies {
    implementation("org.openbrod.migace:migace-runner:0.1.0")
}
```

The plugin gives you the `mig` commands. Each command is also a Gradle task: `mig test` is the same as `./gradlew migTest`. The small runner library lets your application run the migration script.

## The project layout

```text
bookshop/
  migace.yaml          settings
  schema/              the schema your application expects
    101-generated.sql    DDL from your entity classes
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
$ mig make

Comparing schema/ with the migrated release 1.0.0
  + column customer.loyalty_level varchar(10), mandatory

The new column is mandatory. Rows that already exist need a value.
Which value should they get? (an expression, or empty to decide later)
> 'BRONZE'

Wrote migrations/20260302-0900-customer-loyalty.migql.yaml
```

You did not type a name. With an [LLM configured](/docs/generated-snippets/), MIG-Ace names the snippet and its parts. You can also choose the name: `mig make customer-loyalty`.

The column is mandatory, so MIG-Ace asked for a value and wrote three parts. It did not look whether `customer` has rows. Your production data is not visible when you build, so MIG-Ace always assumes that a table has rows.

```yaml
# migrations/20260302-0900-customer-loyalty.migql.yaml
migration: 20260302-0900-customer-loyalty
uid: 01JF2A6QW3ZK8M4T7R9B5X0C1D
doc: Every customer gets a loyalty level

parts:
  - add-column:
      do: alter table customer add column loyalty_level varchar(10)

  - fill-existing:
      do: update customer set loyalty_level = 'BRONZE'

  - make-mandatory:
      column-set-not-null: { table: customer, column: loyalty_level }
```

### If nobody is there to answer

In CI, in a script, or with `mig make --batch`, MIG-Ace cannot ask. It writes the snippet with a `todo` and says so:

```text
Wrote migrations/20260302-0900-customer-loyalty.migql.yaml
  ! 1 TODO: part "fill-existing" needs a value for existing rows.
    The migration script cannot be built until every TODO is resolved.
```

```yaml
  - fill-existing:
      todo: Choose a value for existing customers
      do: update customer set loyalty_level = ?
```

While a `todo` is left, `mig test` and `mig compile` fail. An unfinished snippet cannot reach production.

## Step 3: add test data

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

## Step 4: prove it

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

Had the `fill-existing` part been missing, the same command would have failed:

```text
migrate     20260302-0900-customer-loyalty
  ✗ part make-mandatory failed on release 1.0.0
    ERROR: column "loyalty_level" of relation "customer" contains null values
    3 rows in customer have no loyalty_level
```

This is the error you would otherwise meet in production.

## Step 5: build

Your normal build does the rest.

```text
$ ./gradlew build
```

- It runs the proof.
- It compiles all snippets into one file, `migration-script-pg.sql`.
- It puts that file into your JAR or WAR, under `/migace/`.

## Step 6: run the migration from Java

The script travels inside your application. One call runs it:

```java
import org.openbrod.migace.MigAce;

MigAce.execFromJar(BookshopApp.class, "/migace/migration-script-pg.sql", dataSource);
```

The first argument is any class from the JAR that contains the script. The call applies what is missing, skips what already ran, and checks the schema at the end.

In a Jakarta EE application, a start-up bean is a good place:

```java
@Singleton
@Startup
public class DatabaseMigration {

    @Resource(lookup = "java:jboss/datasources/BookshopDS")
    private DataSource dataSource;

    @PostConstruct
    void migrate() {
        try {
            MigAce.execFromJar(BookshopApp.class, "/migace/migration-script-pg.sql", dataSource);
        } catch (MigrationFailedException e) {
            // e.snippet() and e.part() name the step that failed
            throw new IllegalStateException("Database migration failed: " + e.getMessage(), e);
        }
    }
}
```

If several instances start at the same time, one of them migrates and the others wait.

Prefer to run migrations outside the application? The same script runs from the command line. See [Running migrations](/docs/running-migrations/).

## What you have now

- A migration you did not have to write by hand.
- Proof that it works on a database with data.
- A record in the database of every part that ran.
- An application that migrates its database when it starts.

Next: read how [generated snippets](/docs/generated-snippets/) work, or see [the bookshop example](/docs/bookshop/) for the releases that follow.
