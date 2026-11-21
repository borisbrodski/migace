---
type: architecture
status: mixed
---

# Replaceable objects: views, functions, procedures, triggers

Views, functions, procedures and triggers hold no data. They are replaced as a whole and are never migrated by snippets. **[decided]** In dialects that have them, packages belong to the same group. PostgreSQL has no packages. **[direction]**

The simple approach is to drop all views and triggers on every run and create them again. MIG-Ace does not do that, because the script can run at every application start and during a rolling update.

**Source**

- The author writes these objects in any file of `schema/`. No special file layout is required. **[direction]**
- The migration script does not copy the text of these files. The build reads the definitions from the catalog of the desired database A, in dependency order. Function bodies are stored verbatim by PostgreSQL, so comments in them survive. View text is the form PostgreSQL stores. **[direction]**
- `mig make` writes no snippet for a difference in a replaceable object. It lists the difference as "replaced by the next run". **[direction]**

**What is replaced**

- Only objects whose definition on the server differs from the expected one are replaced. An equal object is not touched, so a second run does nothing and takes no locks. **[direction]**
- The test for "differs" runs on the target server, so both definitions are rendered by the same PostgreSQL version. **[direction]**
- A replaceable object that is not in the desired schema is dropped, unless it matches a run-time ignore pattern. **[direction]**

**Order within a run** **[direction]**

1. *Before the snippets:* functions and procedures that do not exist yet are created, with body checking switched off. Snippets can then use them in index expressions, defaults, constraints and data statements.
2. *During the snippets:* PostgreSQL refuses to drop a column, or to change its type, while a view uses it. Before such a part, the script drops the views that depend on the column, including views built on those views. Nothing else is dropped early.
3. *After the snippets:* changed functions and procedures are replaced, missing and changed views are created in dependency order, missing and changed triggers are created, and objects that are no longer expected are dropped.

**Details** **[direction]**

- The replacement of one object is one transaction, so the application never sees it missing. The exception is a view dropped in step 2. The build reports that case as a finding for zero-downtime upgrades.
- Permissions granted on a view are saved before the view is dropped and restored after it is created. A local administrator's grants therefore survive.
- A function with a changed parameter list is a new function plus a drop of the old one. If an index, default or constraint depends on the old one, a snippet has to change that object first. The proof loop reports it.
- Triggers that MIG-Ace creates itself for expand and contract belong to those operations and are not part of the desired schema.
- Types, domains, extensions and sequences are not replaceable. They are changed by snippets.
- Whether materialized views are replaceable is open, because replacing one means recomputing its data.
