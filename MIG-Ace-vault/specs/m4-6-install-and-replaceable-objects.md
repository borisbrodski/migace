---
type: spec
status: ready
milestone: M4.6
---

# M4.6 Install and replaceable objects

## Goal

The script creates a new database from the files of `schema/`, with its ledger. Every later run brings the views, functions, procedures and triggers of a database to those files, after the snippets, and replaces only what changed. Snippets never use these objects, and the build makes sure of it.

After this spec the bookshop can be installed on an empty database and migrated from release 1.0.0, and both ways end in the same schema, views and functions included.

## Non-goals

- **Adopting** a database that has objects and no ledger. Deferred, question 66. The run stops on such a database.
- **Triggers during a run**, question 67.
- **A function of the project in an index, a default or a constraint**, question 68. The build names it as a limit.
- **Phases.** Every object is installed and dropped in the same run.
- **Several databases**: one folder per database below `schema/`. The first version has one database and a flat folder.
- **Materialized views.** They are ordinary objects here and are changed by snippets.
- **The proof loop** as a command. The comparison of this spec is a test.

## Builds on

- [Replaceable objects](../architecture/replaceable-objects.md)
- [Answers after the script, the real server and the Java runner](../decisions/answers-after-m4-3.md)
- [Execution and ledger](../architecture/execution-and-ledger.md): "A first run", "Inside the script", "One schema"
- [Desired schema and model](../architecture/desired-schema-and-model.md)
- M4.4 and M4.5
- [Coding rules](../engineering/coding-rules.md)

## A rule for this spec

As in M4.4: a criterion that says "together with" asks for a test in which both things are present.

## Order of work

1. The bookshop: the schema of now, and release 1.0.0 as a baseline.
2. Reading the schema folder at build time.
3. The check that snippets do not use these objects.
4. The object table of the ledger.
5. Install.
6. Replacing objects after the snippets.
7. Views that block a change of a column.
8. The tests on a real server.

## Acceptance criteria

### The bookshop

- **M4.6-AC-01** `examples/bookshop/schema/` holds the schema that the application expects now, after all snippets. The schema of release 1.0.0 moves to a baseline folder; the README says where. The tests that start from release 1.0.0 use the baseline.
- **M4.6-AC-02** The bookshop has, in `schema/`, at least: two views of which one uses the other, a function, a procedure, a trigger with its function, and a view that uses a column whose type a snippet changes. Where the website shows these, they are the same.

### Reading the schema folder

- **M4.6-AC-03** The build splits the files of `schema/` into statements with PostgreSQL's own parser. The files are taken in the order of their names by characters, the statements in the order of the file. A test file with code in dollar quotes, with `begin atomic`, with a `do` block and with semicolons inside texts gives one statement for each.
- **M4.6-AC-04** A statement that creates a view, a function, a procedure or a trigger is a replaceable object. Its identity is its kind and its name; for a function and a procedure also the types of its parameters; for a trigger also its table. Every other statement is an install statement. `create materialized view` is an install statement.
- **M4.6-AC-05** A `comment on` and a `grant` for a replaceable object belong to that object. They run again whenever the object is created.
- **M4.6-AC-06** Errors at build time, each with file and line: a file that the parser refuses; the same object defined twice; a name with a schema in front.
- **M4.6-AC-07** The text of an object is taken as the author wrote it, with its comments. Its checksum is computed from the tokens of the statement, as PostgreSQL's scanner gives them, and carries the version of its rule. A property test shows that white space and comments never change it and that every other change does.
- **M4.6-AC-08** `create extension` is not run by the script. The build lists the extensions that the files name. A run on a database that lacks one stops before it changes anything and names the extension.

### Snippets do not use these objects

- **M4.6-AC-09** A snippet that names a view, a function or a procedure of `schema/` is an error at build time. The message names the snippet, the part and the object, and says that these objects are installed after the snippets. It holds for statements under `do`, for `insert` and `upsert`, for actions, for conditions and for checks.
- **M4.6-AC-10** For a `native` part the build finds the tables, views and functions that the statement names with PostgreSQL's parser, also in a `call`. The same error.
- **M4.6-AC-11** Code inside a text cannot be checked: the body of a `do` block, a statement that is built as a text. The build reports such a part with a warning that says it was not checked.
- **M4.6-AC-12** When the files of `schema/` hold an index, a default or a constraint that uses a function of the project, the build reports it once as a limit of this version, with the name of the object and of the function. It is no error.
- **M4.6-AC-13** The bookshop snippets and the examples of the website pass the check. An example that would not is changed in the same commit, and the journal lists it.

### The ledger

- **M4.6-AC-14** The ledger gets a table of the replaceable objects that MIG-Ace installed: kind, identity, checksum, when, and by which run. It is addressed with its schema like every table of the ledger.
- **M4.6-AC-15** The format number of the ledger goes up. The script upgrades a ledger of the format before. A database that M4.4 left, kept as a fixture, is upgraded by a run and then behaves like a new one. This is the first real use of the upgrade.
- **M4.6-AC-16** A snippet has the state `included` when the schema it would produce came with the install. A part of such a snippet never runs. A condition `ran` is false for it: the part did not run on this database.

### Install

- **M4.6-AC-17** At its start the script decides, in the schema of the migration: a ledger is there, it migrates; no ledger and no object, it installs; no ledger and objects, it stops, changes nothing, lists up to ten of the objects it found and says that adopting is not available. Objects of an extension do not count as objects.
- **M4.6-AC-18** An install creates the ledger, then runs every statement of the schema folder in order, each as a step with its row in the ledger. It records every snippet of the script as `included` and every replaceable object with its checksum, and stores the expected fingerprint.
- **M4.6-AC-19** A second run after an install does nothing and sends no statement of a snippet or an object.
- **M4.6-AC-20** A snippet that is added after the install is pending and runs.
- **M4.6-AC-21** An install that fails stops. The next run continues at the statement that failed; it does not start again and does not take the database for one "with objects and without a ledger". Together with a lost connection: for every statement of the bookshop install, a run that loses its connection after it, followed by a normal run, ends in the same model.
- **M4.6-AC-22** **The two ways meet.** On PGlite: the bookshop installed on an empty database, and the baseline of release 1.0.0 migrated by the same script, have the same model and the same fingerprint, and it is the fingerprint that is stored. The ledger tables are left out, as in M4.1-AC-15.
- **M4.6-AC-23** Together with one schema per run (M4.4): an install into a second schema of a database whose first schema is already installed works, and the first is unchanged.

### Replacing objects

- **M4.6-AC-24** After the last snippet, the script goes through the objects in the order of the files. An object whose checksum equals the one in the ledger, and that exists, is left alone: no statement for it is sent. An object that is missing is created. An object with another checksum is replaced.
- **M4.6-AC-25** An object that was left alone is the same object afterwards: its identifier in the catalog is unchanged. The test compares identifiers before and after a run.
- **M4.6-AC-26** The replacement of one object is one transaction, with its comments and grants.
- **M4.6-AC-27** A function or procedure with the same parameters gets its new body without being dropped, so that what depends on it stays. One whose return type changed is dropped and created in one transaction. When something depends on it and PostgreSQL refuses, the step fails with a message that names what depends on it.
- **M4.6-AC-28** A view is replaced together with the views that are built on it, in one transaction. Permissions that were granted on any of them in the database, also by an administrator, are the same afterwards.
- **M4.6-AC-29** A trigger is replaced in one transaction.
- **M4.6-AC-30** An object that the ledger has and the script no longer has is dropped: triggers first, then views with those built on them first, then functions and procedures.
- **M4.6-AC-31** An object of these kinds that is in the database and neither in the ledger nor in the script is left alone. The run lists such objects in one notice. Objects of an extension are neither touched nor listed.
- **M4.6-AC-32** The parameter of a run that replaces every object does so whatever the checksums say. Its name is written into [Execution and ledger](../architecture/execution-and-ledger.md). Together with M4.4-AC-19: it is a known parameter.
- **M4.6-AC-33** A change of white space or comments in a file of `schema/` replaces nothing on a database that has the earlier script's objects.
- **M4.6-AC-34** A jump: a database on which an older script ran, with an older schema folder, gets the script of now. Changed objects are replaced once, unchanged ones keep their identifiers, removed ones are gone. The definitions in between are not needed and not in the script.
- **M4.6-AC-35** A failure while an object is replaced is recorded like the failure of a step. Nothing after it runs. The next run continues there.
- **M4.6-AC-36** The notices of a run say, for the objects, how many were created, replaced, dropped and left alone, and name those that were not left alone. The notices of the bookshop runs are committed expected files.

### Views that block a change of a column

- **M4.6-AC-37** Before a part that drops a column or changes its type, the script drops the views that use that column, and the views built on those. This closes the finding of M3: `alter column … type` on a column that a view uses now works.
- **M4.6-AC-38** At the end of the run these views exist again, from the definitions of the script, with the permissions they had.
- **M4.6-AC-39** A view that had to go and that the script does not have, such as one of an administrator, is named in a notice, and its definition is written into the log so that it can be created again.
- **M4.6-AC-40** A run that fails between the drop and the end leaves the views missing. The next run creates them. A test fails a part after the drop.
- **M4.6-AC-41** The build reports every part that makes a view go for a time, with the names of the views. It is a finding for upgrades without downtime, no error.

### On a real server

- **M4.6-AC-42** While a view is replaced, a second session that reads it gets an answer from the old or the new view and never an error that the view does not exist.
- **M4.6-AC-43** While a trigger is replaced, a second session that inserts gets a row that a trigger handled. No row is written without one.
- **M4.6-AC-44** While a function is replaced, a call that is running ends with the old body and the next call uses the new one.
- **M4.6-AC-45** The replacement of a view waits for an open transaction that has read it, within the limits of M4.4, and the ledger shows the attempts.

### Time and numbers

- **M4.6-AC-46** The time of an install of the bookshop, of a migration from the baseline, and of a second run are measured and written into the journal, with the number of statements that each sends.

## Open points

- Whether a trigger function is replaced before the trigger that uses it when both changed. The order of the files decides for now.
- What a run does with an object of the ledger that somebody dropped by hand. This spec creates it again, as a missing object.
- The names of the baseline folder and of the new parameter.
