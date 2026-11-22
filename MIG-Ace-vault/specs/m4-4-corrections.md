---
type: spec
status: ready
milestone: M4.4
---

# M4.4 Corrections

## Goal

The findings of the [review of M3.1 to M4.3](../journal/2026-11-22-review-of-m3-1-to-m4-3.md) are corrected, and the [answers of the project owner](../decisions/answers-after-m4-3.md) are built. After this spec a run touches its own schema only, leaves nothing behind in its session, records every try, and the tests use PostgreSQL from official sources.

## Non-goals

- Types of several words (question 45, not answered).
- Install, adopt and replaceable objects: M4.5.
- A command that compares a database with the desired schema from outside.

## Builds on

- [Answers after the script, the real server and the Java runner](../decisions/answers-after-m4-3.md)
- [Review of M3.1 to M4.3](../journal/2026-11-22-review-of-m3-1-to-m4-3.md), findings 1, 2 and 4
- [Where the PostgreSQL binaries of the tests come from](../journal/2026-11-22-sources-of-postgresql-binaries.md)
- [Execution and ledger](../architecture/execution-and-ledger.md)
- [Stable state and release](../engineering/stable-state-and-release.md)
- [Coding rules](../engineering/coding-rules.md)

## A rule for this spec

Each of the three findings was a place where two rules met, and each rule had its tests. Every criterion below that says "together with" asks for a test in which both are present: a second schema that has a ledger, a name that is a keyword, a session that is used again.

For every correction the test is written first and seen to fail on the code as it is.

## Order of work

1. The schema of a run.
2. What a run leaves in its session.
3. Every try is recorded.
4. Limits.
5. Checksums.
6. Conditions.
7. Binaries from official sources.
8. Test commands and mutation testing.
9. Smaller points.

## Acceptance criteria

### One schema, nothing shared

- **M4.4-AC-01** A run finds its ledger only in the schema of the migration. Test: the bookshop in two schemas of one database, with a session whose search path ends with the first. After the run on the first, the run on the second creates a ledger of its own and applies every part. The ledger of the first is unchanged.
- **M4.4-AC-02** During a run the search path is the schema of the migration, and the schemas that a parameter names. The session's earlier path is not used. A statement of a snippet that names a table of another schema without its schema fails.
- **M4.4-AC-03** The bookshop needs the extension `pg_trgm`, which lives in another schema. Its run names that schema with the parameter. The name of the parameter is written into [Execution and ledger](../architecture/execution-and-ledger.md).
- **M4.4-AC-04** The script addresses its own tables with their schema. Together with M4.4-AC-03: a schema that the parameter names has a ledger of its own with other content; it is neither read nor written.
- **M4.4-AC-05** The lock of a run belongs to one schema of one database, without a hash that two schemas could share. On a real server, two runs on two schemas at the same time do not wait for each other, and two runs on the same schema do.

### What a run leaves in its session

Finding 4: after a good run the session keeps the changed search path and eleven temporary functions. After a failure at a statement outside a transaction it also keeps the lock. A connection of a pool that is given back in this state blocks every later run.

- **M4.4-AC-06** After a run that ended well, the session has the search path and the settings it had before, no lock of MIG-Ace and no function of MIG-Ace.
- **M4.4-AC-07** The same holds after every kind of failure: a failure that the script reports at its end, and a failure at a statement outside a transaction after which the runner stops.
- **M4.4-AC-08** For this the client contract gets a part of the script that a runner sends also after an error. The README of the contract describes it, new cases show it, and the reference runner and the Java runner pass them. An error inside this part does not hide the first error.
- **M4.4-AC-09** Together with a session that is used again, on a real server: a session runs a script that fails outside a transaction and stays open. A second session then runs the corrected script and does not wait. Then the first session runs it and finds nothing to do.
- **M4.4-AC-10** The Java library gives a connection back to its `DataSource` in the state of M4.4-AC-06 and 07. A test with a pool of one connection runs a failing script and then a good one.

### Every try is recorded

- **M4.4-AC-11** Every try of a step leaves a row, also when the session, the server or the computer ends in the middle. The start of a try is committed before its statement runs. Test on a real server: a session is ended during a step inside a transaction; the ledger shows the try as started.
- **M4.4-AC-12** The next run marks such a try as abandoned and writes a new row for its own try. The two rows stay apart: the abandoned one never becomes "done".
- **M4.4-AC-13** The log table has one line for every event: start and end of the run, and for every step its start, its end, a failure, a skip, an abandoned earlier try, a wait for a lock, a further attempt. The log of the first bookshop run, without times, is a committed expected file.
- **M4.4-AC-14** When a step gets no lock, the row of the try and the log name the tables that are locked and, for every session that holds such a lock: its process number, its user, the name of its application, the kind of lock and since when. The text of its statement is not stored; it can hold data of persons.
- **M4.4-AC-15** The number of statements of the bookshop script and the time of its first run are measured before and after this group of changes and written into the journal.

### Limits

- **M4.4-AC-16** Every limit is a parameter of a run: the time one wait for a lock may take, the number of attempts, the pause between them, and the time one statement may take. [Execution and ledger](../architecture/execution-and-ledger.md) lists each with its default. The value `0` means no limit.
- **M4.4-AC-17** The defaults are generous in sum and short in one wait: a single wait for a lock stays at seconds, because every statement of the application queues behind a waiting migration; the attempts together give at least fifteen minutes. A statement has no time limit by default.
- **M4.4-AC-18** The limits hold for a statement outside a transaction as well. They are set for the session before it and set back after it. A test on a real server shows whether `create index concurrently` obeys the limit while it waits for older transactions; the result is written into the journal. There is no further attempt in the same run.
- **M4.4-AC-19** A parameter that the script does not know stops the run before it changes anything, with a message that lists the parameters. A mistyped name is never ignored.
- **M4.4-AC-20** The Java library and its command line pass parameters, and the README shows a run by hand of a heavy migration with limits of its own.

### Checksums

- **M4.4-AC-21** A word that can be a name counts with its characters wherever it stands. `update t set value = 1` and `update t set Value = 1` have different checksums. Together with the list in [Keywords and names](../migql/keywords.md): the property test builds its names from that list too.
- **M4.4-AC-22** Quotes around a name do not count: `Price` and `"Price"` are one name and give one checksum.
- **M4.4-AC-23** The text of rule `v1` in [Execution and ledger](../architecture/execution-and-ledger.md) says both. The committed list of checksums is written again, once, and the journal says that this was the last time before the first release.

### Conditions

- **M4.4-AC-24** A condition `ran <slug>.<part>` that names a part of a later snippet, or a later part of the same snippet, is an error at build time. The message names both places.
- **M4.4-AC-25** A run in which every part is done or skipped has nothing pending and stores the expected fingerprint.
- **M4.4-AC-26** The `when` of a part that is half done is not decided again. A test changes the state so that the condition would now be false, and the part still ends.

### Binaries from official sources

- **M4.4-AC-27** The temporary server uses a PostgreSQL that is installed on the computer. It is found by the machine setting, then by `pg_config`, then in the usual places of the system. Which installation and which version is used is said in the output of the tests.
- **M4.4-AC-28** On a computer without PostgreSQL, `npm run test:server` fails with a message that names the official source for that system. It does not pass by leaving tests out.
- **M4.4-AC-29** The packages `@embedded-postgres/*` are removed from `package.json` and from the lock file. No dependency of MIG-Ace contains binaries of PostgreSQL.
- **M4.4-AC-30** The workflow installs PostgreSQL from the sources of the [research note](../journal/2026-11-22-sources-of-postgresql-binaries.md), or uses what the image of the runner has when the version fits. An archive that is downloaded is checked against a hash that is committed. The newest version runs on the three systems, the oldest on Linux. The journal says what each runner had and what was installed.

### Test commands and mutation testing

- **M4.4-AC-31** `npm test` runs no Java tests and needs no network. `npm run test:java` runs them. The workflow runs both.
- **M4.4-AC-32** Mutation testing runs on a developer's computer with limited memory: the number of test processes comes from a setting with a default of 2, earlier results are used again so that only changed code is tested, and every package can be run alone. The peak of memory with the defaults is measured and written into the journal.
- **M4.4-AC-33** The workflow has a job for mutation testing that starts once a week and by hand, on Linux, one package per job, with a time limit. It stores the reports and fails no build.
- **M4.4-AC-34** The list "Stable state" in [Stable state and release](../engineering/stable-state-and-release.md) is run once from the first step to the last. A step that does not work as written is corrected in the note.

### Smaller points

- **M4.4-AC-35** No code of `core/`, `migql/` and `databases/` orders text with the rules of a language. A lint rule forbids `localeCompare`.
- **M4.4-AC-36** A foreign key can say what happens to a deleted row: `on delete cascade`, `set null`, `restrict` and `no action`, under `do` and as the parameter `on-delete` of `constraint-add-foreign-key`.
- **M4.4-AC-37** The workflow uses current versions of its actions and shows no warning about deprecated ones.
- **M4.4-AC-38** The numbers of the website page `docs/quality.md` and of the README are those of the state after this spec.

## Open points

- The names of the new parameters are provisional until the note lists them.
- Whether the rows of abandoned tries should be removed after some time. Not in this spec.
