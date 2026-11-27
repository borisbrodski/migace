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

The same script also sets up a new, empty database, and it creates its own ledger tables. See [New and existing databases](/docs/first-run/).

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
      .parameter("schema", "shop")           // the schema to migrate
      .onNotice(line -> log.info(line))      // one line per part
      .exec(dataSource);
```

A failure is an exception that names the step:

```java
try {
    MigAce.execFromJar(BookshopApp.class, "/migace/migration-script-pg.sql", dataSource);
} catch (MigrationFailedException e) {
    log.error("Migration stopped: {}", e.getMessage(), e);   // names the snippet and the part
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

The connection goes back to your pool as it came: with its own search path and settings, and without a lock. This holds after a failed run too.

## Run it from the command line

Some teams prefer to migrate as a separate step, for example in a deployment pipeline or by a database administrator. The same library works as a program:

```text
$ java -cp migace-runner.jar:postgresql.jar org.openbrod.migace.Main \
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
Views, functions and triggers
  v_order_totals        replaced
Schema fingerprint 4be1…07c2 recorded.
```

The password is read from the environment variable `MIGACE_PASSWORD`. Without it, the program asks. There is no option for a password, and no output ever shows one. The JDBC driver of your database is not part of the runner; put it on the class path as shown.

## When a part fails

```text
20260601-0900-book-price-check
  price-not-negative    FAILED
    verify-before: 2 rows in book have price_cents < 0 (ids 4411, 9032)
Stopped. Nothing after this part was run.
```

Fix the cause, here the two prices, and run again. The run continues with the failed part.

Three things you can rely on after a failure:

- **Nothing is half done.** A statement and its record in the ledger are saved together or not at all.
- **Every attempt is in the ledger**, also one that never ended because the connection, the server or the computer went down. The next run marks it as abandoned and records its own attempt.
- **An action continues where it stopped.** If [`column-set-not-null`](/docs/actions/#column-set-not-null) fails at its second statement, the next run starts there.

## One schema, and nothing else

A run works in one schema. Its ledger, its lock and everything it changes are in that schema.

```text
--schema shop
```

Two schemas in one database, for example one per customer or one per application, are migrated independently. Each has its own ledger, and a run on one never reads or writes the other.

If your schema uses something from another schema, such as the types of an extension, name that schema:

```text
--param extra_schemas=public
```

## Limits

A migration sometimes has to wait: another session holds a lock on the table it wants to change. Every limit is a parameter of the run.

| Parameter | Meaning | Default |
|---|---|---|
| `lock_timeout` | How long one wait for a lock may take | a few seconds |
| `lock_attempts` | How often a statement is tried again | enough for about fifteen minutes in all |
| `lock_pause` | The pause between two attempts | a few seconds |
| `statement_timeout` | How long one statement may run | no limit |

The value `0` means no limit.

One wait is short on purpose. While a migration waits for a table, every statement of your application on that table waits behind it. Many short waits disturb the application far less than one long wait.

When all attempts fail, the run stops. The ledger then says which tables were locked and by which sessions: the process number, the user, the name of the application and since when.

For a heavy migration that you run by hand in a quiet hour, set your own limits:

```text
$ java -cp migace-runner.jar:postgresql.jar org.openbrod.migace.Main \
    --url jdbc:postgresql://db.example/bookshop --user bookshop_owner \
    --param lock_timeout=2min --param lock_attempts=1 \
    migration-script-pg.sql
```

A parameter that the script does not know stops the run before anything changes. A mistyped name is never silently ignored.

## The ledger

MIG-Ace keeps its records in a few tables in your database. Their names start with `mig_`.

| Table | What it holds |
|---|---|
| `mig_run` | One row per run: when, by whom, with what result. |
| `mig_snippet` | The state of every snippet: done, failed, skipped, retired or included. |
| `mig_part_run` | Every attempt of every statement of every part: the SQL that ran, the duration, the full error, and for an attempt that got no lock, who held it. |
| `mig_object` | The views, functions and triggers that MIG-Ace installed, to see which of them changed. |
| `mig_log` | One line for every event of a run: started, done, failed, skipped, abandoned, waiting for a lock, trying again. |
| `mig_meta` | The current fingerprint and the fingerprints this database is compatible with. |

You can query them like any table:

```sql
select snippet, part, attempt, error_message
from mig_part_run
where state = 'failed'
order by started_at desc;
```

The ledger travels with the database. A backup that you restore elsewhere still knows its own history.

You do not create these tables. The script creates them on the first run, see [New and existing databases](/docs/first-run/).

## Views, functions and triggers

After the last snippet, the script replaces the views, functions and triggers that changed. You write no snippets for them. See [Views, functions and triggers](/docs/views-functions-triggers/).

## The fingerprint at the end

When a run ends with nothing left to do, the script records the [fingerprint](/docs/desired-schema/) of the schema that this script produces. The [proof loop](/docs/proof-loop/) has shown in your build that it does produce it.

The script does not read your schema again to compute a fingerprint in production. PostgreSQL describes some objects differently from version to version, for example the text of a view. A fingerprint computed on the server would differ for reasons that are no mistake, and your application would refuse to start.

A part that was skipped because its condition was false is not missing work. It had nothing to do on this database, so the run is complete.

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

An index or a view that a local administrator added is left alone. MIG-Ace changes what your snippets name and replaces only the views, functions and triggers it installed itself. See [The desired schema](/docs/desired-schema/#objects-your-administrators-add).
