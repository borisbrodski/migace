---
layout: ../../layouts/Doc.astro
title: Commands
description: The mig commands and the settings file.
lead: MIG-Ace has a handful of commands. With the Gradle plugin, each one is also a task.
---

## Overview

| Command | Gradle task | What it does |
|---|---|---|
| `mig make [name]` | `migMake` | Writes snippets for the difference between the desired schema and your migrations. |
| `mig test` | `migTest` | Runs the [proof loop](/docs/proof-loop/). |
| `mig compile` | `migCompile` | Writes the migration script. |
| `mig release <version>` | `migRelease` | Writes the release file. |
| `mig archive` | `migArchive` | Moves old snippets to the archive and moves the starting schema forward. |
| `mig ls` | | Starts the language server for editors. |

## `mig make`

Compares the [desired schema](/docs/desired-schema/) with the result of your current snippets and writes a new snippet for the difference.

```text
$ mig make review-table

Comparing schema/ with the migrated release 1.0.0
  + table review
  + foreign key fk_review_book
  + foreign key fk_review_customer
  + index ix_review_book

Wrote migrations/20260309-1400-review-table.mig.yaml
  ! Add a testdata entry for the new table review.
```

| Option | Meaning |
|---|---|
| `mig make` | MIG-Ace chooses the names. With an LLM configured it also groups the changes; otherwise it writes one snippet per table. |
| `mig make <name>` | All changes go into one snippet with this name. |
| `--single-snippet` | All changes go into one snippet, and MIG-Ace names it. |
| `--batch` | Ask no questions. Open decisions become `todo` entries. This is also the behaviour when no terminal is attached. |
| `--empty` | Write an empty snippet, for example for a data-only change. |

A generated snippet is a starting point. You add what MIG-Ace cannot know: data steps and test data. See [Generated snippets](/docs/generated-snippets/).

## `mig test`

Runs the proof loop for every supported release.

| Option | Meaning |
|---|---|
| `--from 1.2.0` | Start only from this release. Faster while you work on a snippet. |
| `--keep` | Keep the temporary database after the run, so you can look into it. |

The command ends with an error if any step fails, so it fits into CI as it is.

## `mig compile`

Writes `build/migace/migration-script-pg.sql`. It fails while any snippet contains a `todo`. See [Running migrations](/docs/running-migrations/).

## `mig release`

```text
$ mig release 1.2.1
Wrote releases/1.2.1.yaml
  1 new snippet
  1 changed snippet: 20260518-1000-order-status
     reason: Status values were matched exactly; now case and spaces are ignored
```

Run it in your release build and commit the file it writes. It also removes the `changed` line from the snippets it recorded. See [Releases and branches](/docs/releases-and-branches/).

## `mig archive`

```text
$ mig archive --up-to 1.1.0
```

See [Releases and branches](/docs/releases-and-branches/).

## The runner

The runner is the small Java library `migace-runner`. It is the only piece that reaches the production database. Use it from your application with `MigAce.execFromJar(...)`, or as a program:

```text
java -jar migace-runner.jar --url <jdbc-url> --user <user> [options] <script>
```

| Option | Meaning |
|---|---|
| `--ignore "index:dba_*"` | Ignore additional objects that match the pattern in the final check. |
| `--maintenance` | Allow snippets marked `requires-downtime`. |

## The settings file

```yaml
# migace.yaml
dialects:
  - postgresql

postgresql:
  version: 17             # the major version used for the proof

schema: schema/
migrations: migrations/
releases: releases/

upgrade-from: 1.1.0       # oldest release a database may still be on
compatible-with: 1.2.0    # oldest application version that may run during an upgrade

llm:                      # optional: names and groups generated snippets
  endpoint: https://llm.example.internal/v1
  model: your-model
  api-key-env: MIGACE_LLM_KEY
```

| Setting | Meaning | Read more |
|---|---|---|
| `dialects` | The databases the project supports. | [Native SQL](/docs/native-sql/) |
| `postgresql.version` | The PostgreSQL version of the temporary database. | [The proof loop](/docs/proof-loop/) |
| `upgrade-from` | Every release from here on is tested as a starting point. | [Releases and branches](/docs/releases-and-branches/) |
| `compatible-with` | Changes that break this application version are reported. | [Zero-downtime changes](/docs/zero-downtime/) |
| `llm` | An OpenAI-compatible endpoint used by `mig make` for names and grouping. | [Generated snippets](/docs/generated-snippets/) |
