---
layout: ../../layouts/Doc.astro
title: What exists today
description: The implementation status of MIG-Ace - which features are built and tested, which are specified and next, and which are designed but not started.
lead: This site describes MIG-Ace as it will work. This page says how much of it exists. State of 27 November 2026.
---

## In one paragraph

The language, the generation of SQL for PostgreSQL, the migration script with its ledger, and the Java runner are built and tested on Linux, Windows and macOS. The proof loop and the `mig` commands, which are what you would use every day, are designed and not built yet. Nothing is released: there is no package to install.

| Status | Meaning |
|---|---|
| **Built** | The code exists and its tests pass in every build. |
| **Specified** | Decided and written down with acceptance criteria. It is built next. |
| **Designed** | Described on this site and in the design notes. Not started. |

## The language

| Feature | Status |
|---|---|
| Snippet files, parts, and the statements `create table`, `alter table`, `create index`, `update`, `delete`, `insert`, `upsert` | Built |
| [Exact names](/docs/statements/#names): the case you write is the case you get | Built |
| [Actions](/docs/actions/): the five of the first catalogue | Built |
| [Conditions](/docs/conditions/) on the schema, on data and on the history, and names under `let` | Built |
| `verify-before`, `verify-after`, `stop`, [native SQL](/docs/native-sql/) | Built |
| A YAML schema for snippet files, for editors without the MIG-Ace extension | Built |
| Conditions on parts only, `retired` on a single part | Specified |
| [Types](/docs/statements/#types) with names of several words, and their short names | Specified |
| `former-names` for a renamed part or snippet | Designed |
| Conditions that name a release: `ran … from 1.2.0` | Designed |
| `batch` and `expect-rows` for large [data migrations](/docs/data-migrations/) | Designed |

## From snippets to SQL

| Feature | Status |
|---|---|
| SQL for PostgreSQL from every statement and every action | Built |
| Reading a PostgreSQL schema into a model, comparing two models, the [fingerprint](/docs/desired-schema/) | Built |
| A finding when two names differ only in case | Built |
| Other databases | Designed |

## The migration script and the ledger

| Feature | Status |
|---|---|
| One [migration script](/docs/running-migrations/) from all snippets, with the ledger tables | Built |
| A failure is recorded in full, nothing after it runs, the next run continues at the statement that failed | Built |
| Tested on PostgreSQL 15 and 18: two runs at once, a connection lost after any statement, waiting for locks | Built |
| [One schema](/docs/running-migrations/#one-schema-and-nothing-else) per run, and a session that is left as it was | Specified |
| Every attempt in the ledger, also one that never ended; [limits](/docs/running-migrations/#limits) as parameters | Specified |
| [Views, functions and triggers](/docs/views-functions-triggers/) replaced by a run | Designed |
| [Installing](/docs/first-run/) on an empty database, adopting an existing one | Designed |
| [Releases](/docs/releases-and-branches/), hotfix branches, protection of released snippets | Designed |
| The phases `start` and `finish` for [upgrades without downtime](/docs/zero-downtime/) | Designed |

## Running it

| Feature | Status |
|---|---|
| The contract that every runner follows, as test cases that a runner in any language can use | Built |
| The Java runner, as a library and as a program | Built, not published |
| The options `--phase`, `--adopt` and `--maintenance` | Designed |
| The Gradle plugin | Designed |

## The tool for developers

| Feature | Status |
|---|---|
| The language server: explanations on hover, completion, quick fixes | Built |
| The extension for VS Code | Designed |
| [The proof loop](/docs/proof-loop/) and `mig test` | Designed |
| [`mig make`](/docs/generated-snippets/): snippets written from the difference | Designed |
| [Test data](/docs/test-data/) in the proof | Designed |
| The other [commands](/docs/commands/) and the [settings files](/docs/configuration/) | Designed |

## Known defects in what is built

A review of the code found three defects. Their corrections are specified and come next.

| Defect | Effect |
|---|---|
| A run does not look for its ledger in its own schema only | With two schemas in one database, the run on the second can use the ledger of the first and report "nothing to do". |
| A run that fails at a statement outside a transaction keeps its lock | A connection that goes back to a pool in this state blocks later runs. |
| Two column names that differ only in case, and that are also keywords, get the same checksum | An edit from `value` to `Value` in a released part would not be noticed. |

## How it is checked

Every build runs the tests on Linux, Windows and macOS. [How MIG-Ace is tested](/docs/quality/) has the numbers.

## Follow the work

The code and the design notes are public:

- [The repository](https://github.com/borisbrodski/migace)
- [The design notes](https://github.com/borisbrodski/migace/tree/main/MIG-Ace-vault), with every decision and its reasons
- [The roadmap](https://github.com/borisbrodski/migace/blob/main/MIG-Ace-vault/roadmap.md)
