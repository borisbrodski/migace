---
type: architecture
status: mixed
---

# Execution and ledger

## Migration script

- The build produces one static script per dialect, for example `migration-script-pg.sql`. The script contains all logic: ledger, conditions, retries, batching and the fingerprint check. **[direction]**
- The script can be run repeatedly. Only missing steps are executed. **[decided]**
- Supporting another database means writing another compiler target. **[direction]**
- The compiler first produces an intermediate plan (statements plus control data). The script is one rendering of that plan. **[direction]**

## Inside the script

How the script reaches its behaviour with an adapter that has no logic. **[direction]** The first implementation may change details where a test shows a problem; the reason is then written here.

- **One statement, one transaction.** The adapter sends every statement on its own with autocommit on.
- **The start.** The script takes the lock, creates or upgrades the ledger, creates its helper functions for this session only, and writes the row of the run.
- **One step of a part is one statement of the script.** It is a block that:
  1. does nothing if an earlier step failed in this run, or if the ledger says this step is done;
  2. decides `when` before the first step, and `verify-before`;
  3. runs the statement of the step;
  4. checks `verify-after` after the last step;
  5. writes the result into the ledger.

  The statement and its record are committed together. A step is done completely, with its record, or not at all.
- **A failure is caught inside the block.** The block undoes its statement, writes the error with all details into the ledger, marks the run as failed in a session setting, and ends without an error. Every later block then does nothing. The last statement of the script raises the error, and the adapter reports it. This is how the ledger gets the full error from an adapter that only stops.
- **A part with several steps** is several such blocks. After a failure the next run continues at the step that failed, not at the first one.
- **A statement that cannot run inside a block**, such as `create index concurrently`, is sent as it is. A guard query before it decides whether it runs and records the start; a statement after it records the end. If it fails, the adapter stops; the ledger shows a step that started and did not end. The next run first removes what the failed attempt left, such as an invalid index, and repeats the step.
- **A connection that is lost** rolls back the current step. The ledger has no record of it, so the next run runs it.
- **Progress** is reported with notices: one line per part that ran, was skipped or failed.

### Checksum of a part

The ledger stores a checksum for every part that ran. Conditions refer to it (`ran orders-status.backfill sha256:…`). **[direction]**

- The checksum is computed from the operation of the part in a canonical form: the syntax tree of the statement, not its text. Formatting and comments do not change it.
- It is not computed from the generated SQL. A newer MIG-Ace may generate better SQL for the same part, and the checksum of a part that already ran must stay the same.
- The text of a `native` part is taken as it is, without the white space at the ends of lines.

## Adapters

The script is executed through a JDBC connection or an equally thin adapter in another language. **[decided]** An adapter contains no logic. Its contract: **[direction]**

1. One connection with autocommit on.
2. Send one statement at a time. Statements are separated by a marker line, so the adapter needs no SQL parsing.
3. A marker can carry a guard query. The adapter runs the following statement only if the query returns true. This is needed for statements that cannot run inside a block, such as `create index concurrently`.
4. Stop at the first error and report failure.
5. Print server notices.

Run-time parameters such as the object exclusion patterns are passed as session settings.

For Java, the adapter is a small library. **[decided]**

- The build puts the migration script into the application's JAR as a resource.
- One call reads it from there and runs it, for example `MigAce.execFromJar(SomeClassFromTheJar.class, "/migace/migration-script-pg.sql", dataSource)`. The exact API is provisional. **[direction]**
- The same library works as a command-line program for teams that migrate as a separate step. **[direction]**

## Ledger

The ledger is a set of detailed protocol tables. **[decided]** Table names are provisional. **[direction]**

| Table | Content |
|---|---|
| run | one row per invocation: time, outcome, fingerprint before and after |
| snippet | state per snippet: pending, running, done, failed, skipped, retired, included |
| part run | every attempt of every part: executed SQL, checksum, timing, full error |
| batch | progress of batched data statements, so an interrupted run resumes |
| meta | current fingerprint, compatible fingerprints |
| log | event log, correlated by run |

The ledger lives in the migrated schema, so a dump of the schema carries its history. **[direction]**

## Application start

The application compares its expected fingerprint with the one stored by the last successful migration and refuses to start on a mismatch that is not in the compatible set. **[decided]**

## Initialisation: the start of every run

There is no separate initialisation step and no second script. The migration script creates and upgrades its own ledger. **[direction]**

Every run starts the same way: **[direction]**

1. Take a session-level advisory lock. A second runner that starts at the same time waits, and then finds nothing left to do.
2. Look at the database and choose one of three paths.

| The script finds | Path |
|---|---|
| A ledger | **Migrate.** Bring the ledger tables to the current format if needed, then apply what is missing. |
| No ledger and no objects | **Install.** Create the ledger, run the content of `schema/` directly, record every snippet as `included`, store the fingerprint. |
| No ledger, but objects | **Stop.** The database is not managed by MIG-Ace yet. It has to be adopted. |

**Install** **[direction]**

- A new database gets the desired schema directly. No snippet runs. Every snippet is recorded with the state `included`, so it never runs later.
- This is safe because the proof loop shows that migrating and installing produce the same schema (step 6 of the [proof loop](proof-loop.md)).
- The script therefore contains the statements of `schema/` in addition to the snippets. They are guarded by the "database was empty" result of step 2.
- Rows that the application needs from the start (reference data) come from `insert` statements in `schema/` on this path, and from snippets on the migrate path. How the two are kept equal is an [open question](../questions/open-questions.md).

**Adopt** **[direction]**

- A database that existed before MIG-Ace has objects and no ledger. The runner option `adopt <release>` creates the ledger for it.
- The script computes the fingerprint of the real schema. It must equal the fingerprint of the named release. If it does, the snippets of that release are recorded as `included` and the run continues as a migration.
- Adoption is never automatic. The fingerprint proves the structure, but nothing proves which data migrations a database has seen. The person who runs it states the release.

**Ledger tables** **[direction]**

- The ledger has a format number, stored in the meta table. The script upgrades an older format. It stops on a format that is newer than the one it knows.
- Ledger tables live in the application's schema. They are excluded from comparison and fingerprint. Their name prefix is a project setting.
- The role that runs the migration needs the right to create objects in the schema. The application role needs read access to the meta table for the start-up check.
