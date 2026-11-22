---
type: decision
status: decided
date: 2026-11-22
---

# Answers after the script, the real server and the Java runner

## Context

The work on M3.1 to M4.3 left questions 45 to 56, and the [review](../journal/2026-11-22-review-of-m3-1-to-m4-3.md) added 57 to 59. The project owner answered them. The work that follows is the spec [M4.4](../specs/m4-4-corrections.md).

## Decisions

| Question | Decision |
|---|---|
| 46, 57 The schema of a run | A run works in its schema and in no other. Nothing of one schema reaches another: not its ledger, not its lock, not its objects. The ledger is found only in the schema of the migration. Other schemas that a run needs to see are named by a parameter. |
| 48 A part that is skipped | A snippet or a part whose `when` is false is a part that had nothing to do. These are nearly always repairs that this database does not need. A run in which every other part is done has nothing pending and stores the expected fingerprint. |
| 49 A try that did not end | Every try of a step leaves a row in the ledger, also when the session, the server or the computer ended in the middle. Such a try is marked as not ended. The next try is recorded as a try of its own. The log table has a line for every event of a step. |
| 50 Who held the lock | When a step gets no lock and the database can say which tables are locked and by which sessions, this is written into the row of the try and into the log. |
| 51 Limits | Every time limit and every number of attempts is a parameter of a run, also for statements outside a transaction. The defaults are generous. A run by hand of a heavy migration can set its own. |
| 52 The text of an error in Java | Left as the driver gives it. See below. |
| 53 PostgreSQL binaries | Only from the PostgreSQL project or from a source that the project itself names. The package that the tests use today is replaced. See the [research](../journal/2026-11-22-sources-of-postgresql-binaries.md). |
| 54 Java tests | `npm test` runs no Java tests and needs no network. The Java tests are a command of their own. What is run before a state is called stable, and before a release, is written in [Stable state and release](../engineering/stable-state-and-release.md). |
| 55 Mutation testing | Stryker is used. It must run on a developer's computer with limited memory. A run in the workflow is allowed if it takes few resources. |
| 56 A condition on a later snippet | An error at build time. |
| 58 The checksum of a name that is a keyword | A name counts with its characters, whether it is also a keyword or not, as a name in quotes does. |
| 59 The real fingerprint | The script does not compute the fingerprint of the database. It stores the expected one. |

### 52, decided by the review at the owner's request

The reference runner reports `column "x" does not exist`. The Java runner reports `ERROR: column "x" does not exist`, because the PostgreSQL driver for Java puts that word in front of every message. The word is written in the language of the server (`FEHLER:` on a German server), and another driver may add something else. Removing it would be knowledge about one driver inside a runner that is meant to have none. The contract asks that the report contains the message of the database, and it does. The messages of the script itself, with snippet and part, are the same in both runners.

## Rejected alternatives

- **The script computes the real fingerprint** (59): the catalog differs between versions of PostgreSQL, for example the text of a view. A fingerprint computed inside the database would differ for reasons that are no mistake, and applications would refuse to start. The gain is small and the price is high. A database can still be compared with the desired schema from outside, with the reader that the proof loop uses.
- **A run keeps the search path of the session** (46): shown to be wrong by finding 1 of the review.
- **Binaries from a package of the npm registry** (53): two repackaging steps by single maintainers stand between the PostgreSQL project and the package.

## Not answered yet

- Question 45, types of several words.
- Question 47, the `when` of a part that is half done. What is built stays: it is not asked again.
