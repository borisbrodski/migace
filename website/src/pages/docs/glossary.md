---
layout: ../../layouts/Doc.astro
title: Glossary
description: The terms used on this site, in plain words.
lead: The terms used on this site, in alphabetical order.
---

| Term | Meaning |
|---|---|
| **Adopt** | Put a database that existed before MIG-Ace under its control, at a release you name. See [New and existing databases](/docs/first-run/). |
| **Baseline** | The database of one earlier release, with data. The [proof loop](/docs/proof-loop/) starts its migration from a baseline. |
| **Batch** | A portion of rows. A data part with `batch` changes one portion at a time and saves after each. See [Data migrations](/docs/data-migrations/). |
| **Data migration** | A change to rows, not to the structure of a table. It consists of one or more data parts (DML). See [Data migrations](/docs/data-migrations/). |
| **Data part** | A part that changes rows with `insert`, `update` or `delete` (DML). |
| **DDL** | Data definition language: the SQL statements that change structure, such as `create table` and `alter table`. Most parts of a snippet contain DDL. |
| **Desired schema** | The schema your application expects, created by the files in the [schema folder](/docs/desired-schema/). |
| **DML** | Data manipulation language: the SQL statements that change rows, such as `insert`, `update` and `delete`. A data part contains DML. |
| **Fingerprint** | A hash of the schema. Equal fingerprints mean equal schemas. |
| **Hotfix** | A small release for an older version, usually for one customer. See [Releases and branches](/docs/releases-and-branches/). |
| **Included** | The ledger state of a snippet that never ran because the database was installed or adopted with its changes already in place. |
| **Ledger** | The tables in your database, named `mig_…`, that record every part that ran. See [Running migrations](/docs/running-migrations/). |
| **Lock** | While a statement changes a table, PostgreSQL prevents others from using it in conflicting ways. A long lock makes the application wait. |
| **Migration** | The statements that turn an older schema into the current one. |
| **Migration script** | The single SQL file that MIG-Ace builds from all snippets. This is what you run in production. |
| **MigQL** | The language of snippets: the file format and the SQL-like statements in `do` keys. Snippet files end in `.migql.yaml`. See [Statements](/docs/statements/). |
| **Native SQL** | SQL in PostgreSQL's own dialect, as opposed to the MIG-Ace statement language. See [Native SQL](/docs/native-sql/). |
| **Part** | One named step in a snippet. A part holds exactly one operation. |
| **Phase** | `start` or `finish`. Parts of the start phase are safe while an older application version still runs. Parts marked `phase: finish` are not. See [Zero-downtime changes](/docs/zero-downtime/). |
| **Project file** | `migace.yaml`, the settings your whole team shares. See [Configuration](/docs/configuration/). |
| **Proof loop** | The build step that migrates a baseline and compares the result with the desired schema. |
| **Reference table** | A table whose rows the application needs from the first day, such as the list of order statuses. |
| **Release** | A version of your application that you deliver, such as 1.2.0. `mig release` records which snippets belong to it. See [Releases and branches](/docs/releases-and-branches/). |
| **Release file** | A small file per release that lists the snippets it added or changed. |
| **Repair** | A snippet that corrects what an earlier, faulty snippet did. It runs only where needed. See [Fixing mistakes](/docs/fixing-mistakes/). |
| **Rolling update** | Replacing application instances one at a time, so the application stays available. Old and new versions run side by side for a while. |
| **Runner** | The small program that sends the migration script to the database. |
| **Schema** | The structure of a database: its tables, columns, constraints, indexes, views and functions. |
| **Snippet** | One `.migql.yaml` file that describes one change. See [Snippets](/docs/snippets/). |
| **Statement language** | Another word for MigQL. |
| **Test data** | Rows a snippet brings along for the tables it changes. See [Test data](/docs/test-data/). |
| **User file** | `~/.config/migace/config.yaml`, the settings of your own computer. See [Configuration](/docs/configuration/). |
| **uid** | The permanent identity of a snippet. The name can change, the `uid` cannot. |
