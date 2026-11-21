---
type: spec
status: ready
milestone: M4.1
---

# M4.1 Plan and script

## Goal

The snippets of a project are compiled to a plan, and the plan is written as one PostgreSQL script. Run through an adapter without logic, the script applies what is missing, records everything in the ledger, stops at a failure and continues correctly on the next run.

Everything in this spec runs on PGlite. Real PostgreSQL servers come in [M4.2](m4-2-real-postgresql.md), other runners in [M4.3](m4-3-client-contract-and-java-runner.md).

## Non-goals

- **Install and adopt.** In this milestone a database without a ledger gets one, and every snippet is pending. The choice between install, migrate and stop, the statements of `schema/` in the script, and `--adopt` come with a later spec.
- **Views, functions and triggers** as replaceable objects, and views that block a change of a column. Later spec.
- **`batch` and `expect-rows`.** A part with one of them is a build error that says so.
- **Phases.** Every part runs, also a part with `phase: finish`. This is the decided behaviour of a run without a phase.
- **Release files and the order by release.** Snippets run in the order of their names.
- **The guard against changes to released snippets** at build time.
- **Computing the fingerprint inside the script.**
- **Lock timeouts and retries, two runners at once, a killed run.** They need a real server: M4.2.
- **`testdata`.** It belongs to the proof loop.
- A `mig` command. The functions of this spec are called by tests.

## Builds on

- [Execution and ledger](../architecture/execution-and-ledger.md), above all the section "Inside the script"
- [Snippets](../architecture/snippets.md)
- [Generation](../migql/generation.md), the format for several steps
- [A part that ran is never run again](../decisions/a-part-that-ran-is-never-run-again.md)
- [Repository layout](../architecture/repository-layout.md): the plan in `core/`, the script and the reference runner in `databases/postgresql/`
- M3 and M3.1
- [Coding rules](../engineering/coding-rules.md)

## Order of work

1. The bookshop snippets, so that every later step has something real to run.
2. The plan.
3. The ledger tables.
4. The script for the plain case, and the reference runner.
5. Failures and the next run.
6. Conditions and checks.
7. Statements outside a transaction.

## Acceptance criteria

### The bookshop

- **M4.1-AC-01** `examples/bookshop/migrations/` holds the snippets that the website shows for the releases after 1.0.0. Every snippet has a `uid`. `loadProject` reports no problem for the folder. The keys that this spec leaves out (`batch`, `expect-rows`) are removed from these copies, and the README of the example lists every such difference to the website, so that it is put back later.

### The plan

- **M4.1-AC-02** A function compiles a loaded project to a plan: the snippets in the order of their names, their parts in the order of the file, the steps of every part with their statements, and the control data of the script (conditions, checks, "outside a transaction", checksums). The plan is plain data and can be written as JSON.
- **M4.1-AC-03** The same project gives the same plan, byte for byte as JSON. The plan of the bookshop is a committed expected file.
- **M4.1-AC-04** The types of the plan are in `core/`. `core/` still imports nothing from `databases/` and nothing from `migql/generators/`.
- **M4.1-AC-05** Compiling fails with a clear message, and gives no plan, when: `loadProject` reports an error; a part has a `todo`; a snippet has no `uid`; a part has `batch` or `expect-rows`; a `native` part has no `postgresql` entry.
- **M4.1-AC-06** The checksum of a part follows the rule in "Checksum of a part". A property test shows that formatting and comments never change it, and tests show that a changed statement changes it.

### The script

- **M4.1-AC-07** A function writes the plan as one text file. The same plan gives the same bytes, with LF line endings on every system. The script of the bookshop is a committed expected file, reviewed like the expected SQL.
- **M4.1-AC-08** Statements are separated by marker lines. The format of the marker lines is written down in [Execution and ledger](../architecture/execution-and-ledger.md): how a statement starts, how a guard query is given, how a statement outside a transaction is marked. The first lines of the script name the version of this format.
- **M4.1-AC-09** No text of a snippet can be taken for a marker line or end a block of the script. A part whose text contains a line that looks like a marker, or the delimiter of a block, still compiles to a correct script, or is rejected at build time with a clear message. A test with hostile text proves it.
- **M4.1-AC-10** Every statement of the bookshop script is accepted by PostgreSQL's own parser. The script contains nothing that only one client understands: no `psql` commands, no client variables.

### The reference runner

- **M4.1-AC-11** A runner in TypeScript follows the adapter contract and nothing else: it sends one statement at a time, runs a guarded statement only if its guard query returns true, stops at the first error, and passes server notices to the caller. It gets one function that runs a statement. It knows nothing about the ledger, snippets or parts.
- **M4.1-AC-39** The parameters of a run, such as the schema, are given to the runner as names and values. It sends them as session settings before the first statement of the script. The script works in a schema other than `public` and touches no other schema.
- **M4.1-AC-12** The error it reports names the snippet and the part and carries the message of the database.

### The ledger

- **M4.1-AC-13** A run on a database without a ledger creates the ledger tables. Their prefix is a parameter of the compiler with the default `mig_`. The tables follow the list in "Ledger"; the batch table is left out.
- **M4.1-AC-14** The ledger has a format number. A script that finds a higher number than it knows stops with a message that names both numbers, and changes nothing.
- **M4.1-AC-15** The reader of M2 can leave out the ledger tables. The fingerprint of a schema is the same with and without a ledger.
- **M4.1-AC-16** Every run writes one row: start, end and outcome. Every attempt of a step writes one row: snippet, part, step, the executed SQL, the checksum of the part, start and end, and for a failure the error code, message, detail and context of the database.
- **M4.1-AC-17** At the start the script takes a session-level advisory lock, and it releases it at the end, also after a failure.

### A run

- **M4.1-AC-18** On a PGlite database with the bookshop schema of release 1.0.0, the script runs every part once and in order. Afterwards the model of M2 shows the changes of the snippets.
- **M4.1-AC-19** A second run executes no part. It writes a row for the run with an outcome that says nothing was to do. The fingerprint of the schema is unchanged.
- **M4.1-AC-20** When a snippet is added to the project, a run of the new script executes only the parts of that snippet.
- **M4.1-AC-21** A snippet whose file was renamed keeps its `uid` and is known as already run.
- **M4.1-AC-22** A part that ran and was changed afterwards is not run again. The run reports the difference of the checksums in a notice and goes on.
- **M4.1-AC-23** A snippet with `retired` never runs. It is recorded as retired.
- **M4.1-AC-24** The notices of a run say, for every part, whether it ran, was skipped or was already done. The notices of the first and the second bookshop run are committed expected files.
- **M4.1-AC-25** The compiler takes the fingerprint of the desired schema as an optional value. A run that ends without a failure and with nothing pending stores it in the meta table. A failed run does not.

### Failures and the next run

- **M4.1-AC-26** A step that fails leaves nothing of its statement in the database, and one ledger row with the full error.
- **M4.1-AC-27** After a failure nothing else runs: no later step, no later part, no later snippet. The run ends with an error.
- **M4.1-AC-28** The next run repeats the failed step. When the cause is removed, it succeeds and the run continues with everything that follows.
- **M4.1-AC-29** A part with several steps continues at the step that failed. Test: `alter column … set not null` on a table with one row without a value fails at the validation; after the row is corrected, the next run ends with the column mandatory and without the helper constraint. This closes the finding of M3.

### Conditions and checks

- **M4.1-AC-30** A part whose `when` is false is recorded as skipped. It is decided again on the next run and runs then if the condition has become true.
- **M4.1-AC-31** `when` on a snippet works in the same way for all its parts. Names defined under `let` can be used in every condition of the snippet.
- **M4.1-AC-32** Conditions on the state of the database work: `column orders.legacy_due exists` and `exists (select …)`.
- **M4.1-AC-33** Conditions on the history work against the ledger: `ran <slug>.<part>`, and the form with `sha256:` that is true only for the named version of the part.
- **M4.1-AC-34** A false `verify-before` fails the part before its statement runs. A false `verify-after` fails the part, and its statement is undone. Both forms are covered: a boolean expression and the list of checks on rows.
- **M4.1-AC-35** A part with `stop` ends the run with a failure, and the runner shows its text. Nothing after it runs. When its `when` is false, it is skipped and the run goes on.

### Statements outside a transaction

- **M4.1-AC-36** `create index concurrently` is sent as a statement of its own, with a guard before and a record after. A second run does not send it again.
- **M4.1-AC-37** A `create index concurrently` that fails, for example a unique index on rows with the same value, is repeated on the next run. When the rows are corrected, the run succeeds and no invalid index remains. If PGlite cannot show this, the test moves to M4.2 and the journal says why.

### Time

- **M4.1-AC-38** Compiling the bookshop and running its script on PGlite is measured. The numbers are written into the journal.

## Open points

- The spelling of the marker lines is chosen in this milestone and then fixed by the client contract of M4.3.
- Question 1 (`do` or `sql` as the key of a statement) is still open. This spec does not depend on it.
- Question 10 (may a temporary procedure commit) matters only for `batch`. It is answered there.
- Whether the "started" record of a statement outside a transaction is enough to explain a failure to the person who looks at the ledger later. The error text is only in the output of the runner.
