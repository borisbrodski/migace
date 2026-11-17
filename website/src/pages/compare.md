---
layout: ../layouts/Page.astro
title: MIG-Ace compared with other tools
description: An honest comparison of MIG-Ace with Flyway, Liquibase, Atlas and Django migrations.
lead: Flyway, Liquibase and Atlas are the tools a Java team is most likely to consider. Django migrations are included because many developers regard them as the best migrations any framework ships with. This page says where each of them is stronger than MIG-Ace, and where MIG-Ace is stronger.
---

> Facts about the other tools were checked in November 2026 and are linked at the end of the page. Editions and prices change, so check the linked pages before you decide.

## The short version

- **Flyway and Liquibase** run the migrations you write, reliably, on almost any database. They do not check that your migrations produce the schema your application expects.
- **Atlas** can write migrations for you from a desired schema, including one generated from Hibernate entities, and can warn about risky statements.
- **Django migrations** write themselves from the model classes and are part of the framework. They are not available to a Java application.
- **MIG-Ace** proves, in every build and on a database with data, that your migrations lead to the expected schema. It also has tools for the day a released migration turns out to be wrong. It is new, and it supports PostgreSQL only.

## Feature by feature

| | MIG-Ace | Flyway | Liquibase | Atlas | Django migrations |
|---|---|---|---|---|---|
| **You write migrations as** | YAML files with SQL-like statements | SQL files, or Java classes | Changelogs in XML, YAML, JSON or SQL | SQL files, or a desired schema | Python files |
| **Writes a migration from the model** | Yes, from the Hibernate-generated schema plus your own SQL | In the paid edition | Yes, by comparing two databases; Hibernate through an extension | Yes, also from Hibernate entities | Yes, built in |
| **Proves the result equals the expected schema** | Yes, in every build | No | No | Partly: replays migrations on an empty database | Partly: reports model changes that have no migration |
| **Tests migrations on a database with data** | Yes, built in | You build it yourself | You build it yourself | You write the tests | You write the tests |
| **Test rows that travel with a migration** | Yes | No | No | No | No |
| **What is recorded per run** | Every part, with statement, duration and error | One row per migration file | One row per changeset | One row per migration file | One row per migration |
| **Changing a released migration** | Allowed with a stated reason; old databases keep their record | Reported as a checksum error; a repair command accepts the new checksum | Reported as a checksum error; can be allowed per changeset | Reported through a checksum file | Not detected |
| **Repair only where the old version ran** | Yes, with a condition on the history | By hand | With preconditions you write | By hand | With Python code you write |
| **Steps that depend on the database state** | `when` conditions | Not built in for SQL files | Preconditions | Limited | Any Python code |
| **Two branches add migrations** | Plain file merge; the proof decides | Version numbers can collide; out-of-order mode exists | Depends on how the changelog is organised | A checksum file forces a merge conflict on purpose | A merge migration is required |
| **Check that the old application version keeps working** | Yes, against a version you choose | No | No | Lint rules for some breaking changes | No |
| **Warnings about long table locks** | Yes, with measured durations | General code analysis rules | Policy checks in the commercial edition | Lint rules; the PostgreSQL-specific ones are in the paid plan | No |
| **Undo a migration** | No. You go forward with a repair. | In the paid edition | Yes | Yes, with a down command | Yes |
| **Databases** | PostgreSQL | Many | Many | Many | PostgreSQL, MySQL, Oracle, SQLite and others |
| **What runs in production** | One SQL script and a small runner | Flyway, as a library or a command | Liquibase, as a library or a command | The Atlas command | Django itself |
| **Licence** | Open source | Free community edition under Apache 2.0, plus a paid edition | Community edition under the Functional Source License since 5.0, plus a commercial edition | Open core: an Apache 2.0 community build, plus builds and plans under the vendor's own terms | Open source, BSD |
| **Age** | New | More than ten years, very widely used | More than ten years, very widely used | A few years, growing quickly | More than ten years |

## Where the others are stronger

Be clear about these before you choose MIG-Ace.

- **Maturity.** Flyway and Liquibase have run in production at thousands of companies for more than a decade. MIG-Ace is new.
- **Databases.** MIG-Ace supports PostgreSQL. If you need Oracle, SQL Server or MySQL today, choose another tool.
- **Simplicity.** A Flyway migration is a plain SQL file. There is nothing to learn. MIG-Ace has its own file format and a statement language.
- **Undo.** Liquibase, Atlas and Django can roll a migration back. MIG-Ace only goes forward.
- **Integration.** Flyway and Liquibase are built into Spring Boot and Quarkus and can migrate when the application starts. MIG-Ace runs as a separate step before the application starts.
- **Build time.** The proof loop starts a database and migrates it for every supported release. That costs seconds to minutes in each build.
- **Governance.** The commercial editions of Flyway and Liquibase offer approval workflows, dashboards and audit reports for large organisations. MIG-Ace has none of that.

## Where MIG-Ace is stronger

- **The proof.** No other tool in this comparison migrates an older database with data in every build and compares the result with the schema the application expects.
- **Test data as part of the migration.** A mandatory column without a value for existing rows fails in the build.
- **Changing history safely.** A released snippet can be corrected, with a reason. Databases that ran the old version are found by a condition and repaired.
- **Customers on different versions.** Every supported release is a tested starting point, including jumps over several versions.
- **Zero-downtime checks included.** The check against an older application version and the lock warnings are part of the tool.
- **Nothing in your application.** Production needs one SQL script. Your application contains one query for the start-up check.

## Tool by tool

### Flyway

Flyway is the simplest of the four. You number SQL files, and Flyway runs the ones a database has not seen yet. It records one row per file and stores a checksum, so it notices when an applied file was edited.

**Choose Flyway** when you want plain SQL files, support for many databases and a tool every Java developer already knows.

**What MIG-Ace adds:** Flyway runs what you wrote. Whether the result matches your entities, and whether a statement survives real data, is left to your own tests. Generating migrations, undo and drift detection belong to the paid edition.

### Liquibase

Liquibase describes changes as changesets in a changelog. It has preconditions, rollback, and it can produce a changelog from the difference between two databases. With its Hibernate extension, one of the two can be your entity model.

**Choose Liquibase** when you need rollback, many databases, or fine control with preconditions and contexts.

**What MIG-Ace adds:** the comparison in Liquibase is a tool you call when you want a changelog. In MIG-Ace it is a test that every build must pass, run on a database with data. Note also that the community edition changed its licence with version 5.0.

### Atlas

Atlas is the closest relative of MIG-Ace. You describe the schema you want, and Atlas plans the migration. It can read that schema from Hibernate entities, and its lint rules know which PostgreSQL statements are dangerous.

**Choose Atlas** when you want generated migrations for many databases and are comfortable with a command-line tool from outside the Java world.

**What MIG-Ace adds:** Atlas checks the migration files against the desired schema by replaying them on an empty database. MIG-Ace migrates an older release with data and test rows. MIG-Ace also keeps a record per part and has the repair tools described under [Fixing mistakes](/docs/fixing-mistakes/). Check which Atlas features your edition includes. In the standard build the lint command is not part of the free plan, and the community build cannot load a schema from an external program, which is how the Hibernate integration works.

### Django migrations

Django writes a migration whenever a model class changes, keeps migrations in a graph, and lets you add data steps in Python.

**Choose Django migrations** when your application is a Django application. They are not usable from Java.

**What a Java team can learn from them:** how pleasant it is when the tool writes the first draft. MIG-Ace does the same with `mig make`. Two things work differently. When two branches each add a migration, Django asks you to create a merge migration, while MIG-Ace merges the files and lets the proof decide. And Django does not notice when an applied migration is edited, while MIG-Ace does.

### And Hibernate's automatic schema update?

Setting `hibernate.hbm2ddl.auto` to `update` lets Hibernate add missing tables and columns when the application starts. It is convenient for a prototype.

It cannot give existing rows a value, rename anything, remove anything or change a type, and it leaves no record of what it did. The Hibernate documentation itself recommends migration scripts for production.

MIG-Ace uses Hibernate differently: Hibernate describes the schema it expects, and MIG-Ace proves that your migrations get there.

## Sources

- Flyway: [feature summary by edition](https://documentation.red-gate.com/fd/feature-summary-165740620.html) and [command reference](https://documentation.red-gate.com/fd/reference/commands)
- Liquibase: [Community 5.0 release notes](https://docs.liquibase.com/community/release-notes/5-0), including the licence change
- Atlas: [feature availability](https://atlasgo.io/features), [release notes](https://github.com/ariga/atlas/releases), [Hibernate guide](https://atlasgo.io/guides/orms/hibernate) and [community edition limits](https://atlasgo.io/faq/tags/community-edition)
- Django: [migrations documentation](https://docs.djangoproject.com/en/stable/topics/migrations/) and an article on [merge migrations](https://adamj.eu/tech/2020/12/10/introducing-django-linear-migrations/)

If something on this page is wrong or out of date, please [open an issue](https://github.com/borisbrodski/migace/issues).
