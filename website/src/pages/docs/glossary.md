---
layout: ../../layouts/Doc.astro
title: Glossary
description: The terms used on this site, in plain words.
lead: The terms used on this site, in alphabetical order.
---

| Term | Meaning |
|---|---|
| **Baseline** | The database of one earlier release, with data. The [proof loop](/docs/proof-loop/) starts its migration from a baseline. |
| **Batch** | A portion of rows. A data step with `batch` changes one portion at a time and saves after each. See [Data migrations](/docs/data-migrations/). |
| **Contract** | The second half of a two-step change: removing the old column after every application version uses the new one. See [Zero-downtime changes](/docs/zero-downtime/). |
| **Data migration** | A step that changes rows, not the structure of a table. |
| **DDL** | Data definition language: the SQL statements that change structure, such as `create table` and `alter table`. |
| **Desired schema** | The schema your application expects, created by the files in the [schema folder](/docs/desired-schema/). |
| **Expand** | The first half of a two-step change: adding the new column next to the old one. |
| **Fingerprint** | A hash of the schema. Equal fingerprints mean equal schemas. |
| **Hotfix** | A small release for an older version, usually for one customer. See [Releases and branches](/docs/releases-and-branches/). |
| **Ledger** | The tables in your database, named `mig_…`, that record every part that ran. See [Running migrations](/docs/running-migrations/). |
| **Lock** | While a statement changes a table, PostgreSQL prevents others from using it in conflicting ways. A long lock makes the application wait. |
| **Migration** | The statements that turn an older schema into the current one. |
| **Migration script** | The single SQL file that MIG-Ace builds from all snippets. This is what you run in production. |
| **Native SQL** | SQL in PostgreSQL's own dialect, as opposed to the MIG-Ace statement language. See [Native SQL](/docs/native-sql/). |
| **Part** | One named step in a snippet. A part holds exactly one operation. |
| **Proof loop** | The build step that migrates a baseline and compares the result with the desired schema. |
| **Release file** | A small file per release that lists the snippets it added or changed. |
| **Repair** | A snippet that corrects what an earlier, faulty snippet did. It runs only where needed. See [Fixing mistakes](/docs/fixing-mistakes/). |
| **Rolling update** | Replacing application instances one at a time, so the application stays available. Old and new versions run side by side for a while. |
| **Runner** | The small program that sends the migration script to the database. |
| **Schema** | The structure of a database: its tables, columns, constraints, indexes, views and functions. |
| **Snippet** | One `.mig.yaml` file that describes one change. See [Snippets](/docs/snippets/). |
| **Statement language** | The SQL-like language used in `do` keys. See [Statements](/docs/statements/). |
| **Test data** | Rows a snippet brings along for the tables it changes. See [Test data](/docs/test-data/). |
| **uid** | The permanent identity of a snippet. The name can change, the `uid` cannot. |
