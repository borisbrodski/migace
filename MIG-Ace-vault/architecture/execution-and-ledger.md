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

## One schema

A run works in the schema of the migration and in no other. **[decided]** Its ledger, its lock and every object it changes belong to that schema. Nothing of another schema is read or written, also when that schema has a ledger of its own. Schemas that a run has to see, for the types of an extension, are named by the parameter `migace.other_schemas`. After a run the session is as it was before: its search path, its settings, no lock and no function of MIG-Ace. Built with [M4.4](../specs/m4-4-corrections.md):

- The search path of a run is the schema of the migration, then the schemas of `migace.other_schemas`, in their order. The session's own path is saved at the start and set back at the end.
- The script names its ledger tables with their schema. A ledger in a schema of `migace.other_schemas` is neither read nor written.
- The lock of a run is `pg_try_advisory_lock` with one key of 64 bits: the letters `MIGA` in the upper half, the number (`oid`) of the schema in the lower half. Two schemas of one database never share it. No hash is used.

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
- **The start of every try is committed before its statement runs** (since M4.4). A step inside a transaction is two statements: a call that decides and writes the row of the try with the state `started`, and a call that runs the statement and ends that row. A try whose session, server or computer ended in the middle keeps its row with `started`. The next run marks it `abandoned`, writes a line into the log, and starts a try of its own. The two rows stay apart.
- **A failure is caught inside the block.** The block undoes its statement, writes the error with all details into the ledger, marks the run as failed in a session setting, and ends without an error. Every later block then does nothing. The last statement of the script raises the error, and the adapter reports it. This is how the ledger gets the full error from an adapter that only stops.
- **A part with several steps** is several such blocks. After a failure the next run continues at the step that failed, not at the first one.
- **A statement that cannot run inside a block**, such as `create index concurrently`, is sent as it is. A guard query before it decides whether it runs and records the start; a statement after it records the end. If it fails, the adapter stops; the ledger shows a step that started and did not end. The next run first removes what the failed attempt left, such as an invalid index, and repeats the step.
- **A connection that is lost** rolls back the current step. Its try stays `started`, so the next run marks it `abandoned` and runs the step again.
- **Progress** is reported with notices: one line per part that ran, was skipped or failed.

### The format of the script

The script is a text file with LF line endings. Lines that start with `-- @migace` are marker lines; they separate statements. Every other line belongs to the statement of the marker above it. **[direction]**, fixed by the client contract.

| Line | Meaning |
|---|---|
| `-- @migace script format=1` | The first line. It names the version of this format. A runner refuses a version it does not know. |
| `-- @migace statement` | The lines up to the next marker are one statement. The runner sends it. |
| `-- @migace guard` | The lines up to the next marker are a query that returns one value. The statement that follows is sent only if the value is true. |
| `-- @migace statement outside-transaction` | A statement that the database refuses inside a transaction. A runner with autocommit sends it like any other. |
| `-- @migace finally` | The statements after it are sent also after an error. They set the session back: its search path and limits, the lock, the functions and the settings of the run. |
| `… label="<text>"` | Says what the statement belongs to. A runner puts it in front of the message of an error of that statement. |

- Parameters of a run are session settings `migace.<name>`. The runner sets them before the first statement. `migace.schema` is the schema of the migration.
- The script contains nothing that only one client understands.
- No text of a snippet can be taken for a marker line. A statement of a part is a text literal inside a call of a function of the script; a quote in it is doubled. A part with a line that starts with `-- @migace` is rejected when the script is written.

Parameters of a run. Their names are provisional. **[direction]**

| Session setting | Meaning | Default |
|---|---|---|
| `migace.schema` | The schema of the migration. | the current schema of the session |
| `migace.other_schemas` | Further schemas that the run sees, separated by commas, for example the schema of an extension. They come after the schema of the migration in the search path. | none |
| `migace.lock_timeout` | How long a step waits for a lock before it gives up. | `5s` |
| `migace.lock_attempts` | How often a step is tried when it got no lock. | `3` |
| `migace.lock_wait` | The pause between two attempts. | `1s` |

A step that got no lock writes a ledger row with the state `no lock` for every attempt. When the last attempt fails, the run ends with a failure that names the snippet, the part and the tables that other sessions hold locks on. The row of the try and the log also name, for every session that holds such a lock, its process number, its user, the name of its application, the kind of lock and the start of its transaction. The text of its statement is not stored: it can hold data of persons.

States of a row of the part-run table: `started`, `done`, `failed`, `skipped`, `no lock`, `abandoned`.

The log table has one line per event, with the columns `event`, `snippet_name`, `part`, `step` and `message`. Events: `run started`, `waited` (for the lock of another run), `started`, `done`, `failed`, `skipped`, `no lock`, `attempt` (a further attempt after `no lock`), `abandoned`, `run ended` (with the outcome). The log of the first bookshop run is the committed file `migql/test/script/bookshop-first-run-log.txt`.

The contract in full, with its cases as data, is in `clients/contract/README.md`. Fixed there in M4.3: the first line of a script names the version of the format, and a runner refuses a version it does not know; a guard query answers with exactly one row that holds true or false, and any other answer is an error; a runner reads the whole script before it sends anything.

Rights. **[direction]**

- The script runs as the owner of the schema. It needs no superuser. It creates its ledger tables in the schema and its functions for the session only.
- An application that checks the fingerprint at its start needs `usage` on the schema and `select` on the meta table (`mig_meta`). It needs no right on the other ledger tables.

What the first implementation does differently from the list above, and why:

- **Waiting for the lock of the run is a loop.** A plain call of `pg_advisory_lock` keeps a transaction open while it waits. `create index concurrently` of the run that holds the lock waits for every older transaction, so the two waited for each other and PostgreSQL ended one of them. The script now tries the lock, ends its transaction, pauses and tries again.

- **A step is a call, not a block.** The logic of a step is in functions that the script creates for the session (`pg_temp.migace_step` and others). A step is then one short `select`, and the statement of the part is an argument. This keeps the script small and makes hostile text harmless.
- **The search path** is the schema of the migration and the schemas of `migace.other_schemas`, nothing else. Until M4.4 it kept what the session had behind it; the [review](../journal/2026-11-22-review-of-m3-1-to-m4-3.md) showed that a run then used the ledger of another schema.
- **The end of a run** is a part of its own, after `-- @migace finally`. The runner sends it also after an error. Until M4.4 the lock was released by a statement that a failure outside a transaction never reached.
- **The tables of the ledger are named with their schema**, which is known only when the script runs. A statement that names them is sent as the text of an `execute`, and the name of the schema is put in first.
- **A statement outside a transaction** is three entries: a guard that decides and records the start, the statement, and a call that records the end.

### Checksum of a part

The ledger and the release files store a checksum for every part.

- **A checksum names the version of its rule:** `v1:9f3e…`. The number is the version of the rule below, the rest is the value. **[decided]**
- **Rule `v1`:** the checksum is computed from the tokens of the part as the author wrote it. White space and comments do not count, and the case of keywords does not count. Everything else counts, also the choice between two spellings of the same thing. **[direction]**
- **A name counts with its characters**, also when the word is a keyword elsewhere, and quotes around a name do not count: `value` and `Value` differ, `Price` and `"Price"` are the same. **[decided]** For a word that can be both, the case therefore counts wherever it stands. The code follows this with [M4.4](../specs/m4-4-corrections.md).
- It is not computed from the syntax tree: a change of the grammar or the parser in a newer MIG-Ace must not change a checksum. It is not computed from the generated SQL: a newer MIG-Ace may generate better SQL for the same part.
- The text of a `native` part is taken as it is, without the white space at the ends of lines.
- **A rule never changes.** A different rule gets a new version number, and every earlier version stays in the code, so that a checksum written years ago can still be computed and compared. **[decided]**

Two tests guard this. **[decided]**

1. **In MIG-Ace:** a committed list holds the checksum of every example of the catalogue and of the bookshop snippets. A test fails when one of them changes. The list only grows.
2. **In every project:** the build compares the parts of released snippets with the checksums in the release files. After an upgrade of MIG-Ace this is the proof that the checksums of the project are still the same. When parts differ that nobody edited, the message says that this is a defect of MIG-Ace and names the versions.

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
| No ledger, but objects | **Stop.** The database is not managed by MIG-Ace. Nothing is changed. |

**Install** **[direction]**

- A new database gets the desired schema directly. No snippet runs. Every snippet is recorded with the state `included`, so it never runs later.
- This is safe because the proof loop shows that migrating and installing produce the same schema (step 6 of the [proof loop](proof-loop.md)).
- The script therefore contains the statements of `schema/` in addition to the snippets. They are guarded by the "database was empty" result of step 2.
- A part of an `included` snippet did not run on this database. A condition `ran` is false for it. **[decided]**
- Rows that the application needs from the start (reference data) come from `insert` statements in `schema/` on this path, and from snippets on the migrate path. How the two are kept equal is an [open question](../questions/open-questions.md).

**Adopt** **[open]**, deferred

- A database that existed before MIG-Ace has objects and no ledger. Taking such a database under the ledger is not part of the first version. A project starts with an install and imports its data afterwards. **[decided]**
- For later, see question 66 in [Open questions](../questions/open-questions.md): the tool will have no connection to such databases, so the comparison with a release would have to be code in the script that goes through the objects of the database.

**Ledger tables** **[direction]**

- The ledger has a format number, stored in the meta table. The script upgrades an older format. It stops on a format that is newer than the one it knows.
- Ledger tables live in the application's schema. They are excluded from comparison and fingerprint. Their name prefix is a project setting.
- The role that runs the migration needs the right to create objects in the schema. The application role needs read access to the meta table for the start-up check.
