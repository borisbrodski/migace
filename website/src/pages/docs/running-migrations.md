---
layout: ../../layouts/Doc.astro
title: Running migrations
description: The migration script, running it from Java or from the command line, the ledger and the start-up check.
lead: In production you run one SQL script. It applies what is missing, records every step and checks the result. Your application can run it itself with one line of Java.
---

## The migration script

The build compiles all snippets into one file, `migration-script-pg.sql`. The script contains every snippet and all the logic around them. You can open it and read it.

It is safe to run the script at any time, on any release of your database:

- Parts that already ran are skipped.
- Parts that are missing are applied in order.
- A run that was interrupted continues where it stopped.

The Gradle plugin puts the script into your JAR or WAR under `/migace/`. `mig compile` writes it as a separate file.

## Run it from Java

Add the runner library:

```kotlin
dependencies {
    implementation("org.openbrod.migace:migace-runner:0.1.0")
}
```

Then one call is enough:

```java
MigAce.execFromJar(BookshopApp.class, "/migace/migration-script-pg.sql", dataSource);
```

The first argument is any class from the JAR that contains the script. MIG-Ace reads the script from that JAR and sends it to the database.

When you need options, use the longer form:

```java
MigAce.fromJar(BookshopApp.class, "/migace/migration-script-pg.sql")
      .ignore("index:dba_*")                 // extra objects a local administrator added
      .onProgress(line -> log.info(line))    // one line per part
      .exec(dataSource);
```

A failure is an exception that names the step:

```java
try {
    MigAce.execFromJar(BookshopApp.class, "/migace/migration-script-pg.sql", dataSource);
} catch (MigrationFailedException e) {
    log.error("Migration stopped in {} / {}", e.snippet(), e.part(), e);
    throw e;
}
```

The library is small on purpose. It reads the script, sends it statement by statement and reports the result. All migration logic is in the script, so what runs in production is exactly what the [proof loop](/docs/proof-loop/) tested.

### At application start

```java
@Singleton
@Startup
public class DatabaseMigration {

    @Resource(lookup = "java:jboss/datasources/BookshopDS")
    private DataSource dataSource;

    @PostConstruct
    void migrate() {
        MigAce.execFromJar(BookshopApp.class, "/migace/migration-script-pg.sql", dataSource);
    }
}
```

If several application instances start together, one migrates and the others wait until it has finished.

## Run it from the command line

Some teams prefer to migrate as a separate step, for example in a deployment pipeline or by a database administrator. The same library works as a program:

```text
$ java -jar migace-runner.jar \
    --url jdbc:postgresql://db.example/bookshop --user bookshop_owner \
    migration-script-pg.sql

20260518-1000-order-status
  create-status-table   done
  add-statuses          done   5 rows
  add-status-id         done
  link-status           done   1,203,455 rows in 61 batches
  default-unknown       done   312 rows
  status-fk             done
  status-mandatory      done
20260525-1100-orders-ship-by
  add-column            done
  fill-ship-by          done   1,203,455 rows in 61 batches
Views, functions and triggers recreated.
Schema fingerprint 4be1…07c2 matches.
```

The password is read from the environment variable `MIGACE_PASSWORD`.

## When a part fails

```text
20260601-0900-book-price-check
  price-not-negative    FAILED
    verify-before: 2 rows in book have price_cents < 0 (ids 4411, 9032)
Stopped. Nothing after this part was run.
```

Fix the cause, here the two prices, and run again. The run continues with the failed part.

## The ledger

MIG-Ace keeps its records in a few tables in your database. Their names start with `mig_`.

| Table | What it holds |
|---|---|
| `mig_run` | One row per run: when, by whom, with what result. |
| `mig_snippet` | The state of every snippet: done, failed, skipped or retired. |
| `mig_part_run` | Every attempt of every part, with the statement, the duration and the full error. |
| `mig_log` | Messages written during a run. |
| `mig_meta` | The current fingerprint and the fingerprints this database is compatible with. |

You can query them like any table:

```sql
select snippet, part, attempt, error_message
from mig_part_run
where state = 'failed'
order by started_at desc;
```

The ledger travels with the database. A backup that you restore elsewhere still knows its own history.

## The check at the end

After the last part, the script reads the real schema and computes its [fingerprint](/docs/desired-schema/). If it differs from the expected one, the run ends with an error and names the objects that differ.

## The check at application start

An application that does not migrate by itself should still refuse to run on the wrong schema. One call checks that the database knows the fingerprint this application version expects:

```java
@Singleton
@Startup
public class SchemaCheck {

    @Resource(lookup = "java:jboss/datasources/BookshopDS")
    private DataSource dataSource;

    @PostConstruct
    void verify() {
        MigAce.requireSchema(BookshopApp.class, dataSource);
    }
}
```

If someone starts version 1.3.0 of the bookshop against a database that is still on 1.1.0, the application stops with a clear message instead of failing later with a confusing SQL error.

`MigAce.execFromJar` ends with the same check, so an application that migrates at start-up does not need a second one.

## Several application versions at once

During a rolling update, old and new application instances run side by side for a while. The database then lists more than one compatible fingerprint. [Zero-downtime changes](/docs/zero-downtime/) explains how MIG-Ace decides which versions are compatible.

## Local additions

If an administrator added an index of their own, tell the runner to ignore it: `.ignore("index:dba_*")` in Java, or `--ignore "index:dba_*"` on the command line. See [The desired schema](/docs/desired-schema/) for the rules.
