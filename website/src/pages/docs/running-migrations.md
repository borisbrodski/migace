---
layout: ../../layouts/Doc.astro
title: Running migrations
description: The migration script, the runner, the ledger and the start-up check.
lead: In production you run one SQL script. It applies what is missing, records every step and checks the result.
---

## The migration script

```text
$ mig compile
Wrote build/migace/migration-script-pg.sql
```

The script contains every snippet and all the logic around them. You deliver it together with the application, and you can read it before you run it.

It is safe to run the script at any time, on any release of your database:

- Parts that already ran are skipped.
- Parts that are missing are applied in order.
- A run that was interrupted continues where it stopped.

## Run it

The runner is a small program that sends the script to the database, statement by statement.

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
  status-mandatory      done
20260525-1100-orders-ship-by
  add-column            done
  fill-ship-by          done   1,203,455 rows in 61 batches
Views, functions and triggers recreated.
Schema fingerprint 4be1…07c2 matches.
```

The password is read from the environment variable `MIGACE_PASSWORD`.

The runner contains no migration logic. It only needs a connection, so it works the same from a terminal, a CI job or a Kubernetes job that runs before the application starts.

## When a part fails

```text
20260601-0900-book-price-check
  price-not-negative    FAILED
    verify-before: 2 rows in book have price_cents < 0 (ids 4411, 9032)
Stopped. Nothing after this part was run.
```

Fix the cause, here the two prices, and run the script again. It continues with the failed part.

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

The application verifies that its own expected fingerprint is known to the database. No MIG-Ace library is needed for this. One query is enough.

```java
@Singleton
@Startup
public class SchemaCheck {

    @Resource(lookup = "java:jboss/datasources/BookshopDS")
    private DataSource dataSource;

    @PostConstruct
    void verify() throws Exception {
        // written into the application by the build
        String expected = BuildInfo.schemaFingerprint();

        try (Connection con = dataSource.getConnection();
             PreparedStatement ps = con.prepareStatement(
                 "select 1 from mig_meta where key = 'compatible' and value = ?")) {
            ps.setString(1, expected);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalStateException(
                        "The database schema does not match this application version. "
                        + "Run the migration script first.");
                }
            }
        }
    }
}
```

If someone starts version 1.3.0 of the bookshop against a database that is still on 1.1.0, the application stops with this message instead of failing later with a confusing SQL error.

## Several application versions at once

During a rolling update, old and new application instances run side by side for a while. The database then lists more than one compatible fingerprint. [Zero-downtime changes](/docs/zero-downtime/) explains how MIG-Ace decides which versions are compatible.

## Local additions

If an administrator added an index of their own, tell the runner to ignore it:

```text
$ java -jar migace-runner.jar --ignore "index:dba_*" ...
```

See [The desired schema](/docs/desired-schema/) for the rules.
