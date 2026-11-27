---
type: architecture
status: mixed
---

# Replaceable objects: views, functions, procedures, triggers

Views, functions, procedures and triggers hold no data. Their source in `schema/` is the truth, and MIG-Ace brings a database to it. They are never migrated by snippets. **[decided]** In dialects that have them, packages belong to the same group. PostgreSQL has no packages. **[direction]**

## The rule

- **Only what changed is replaced.** **[decided]** Dropping everything before a run and creating it again after is not done: the application keeps running during a run, and for that time it would have no views and no triggers; PostgreSQL does not let a function go that an index, a default or a constraint uses; a dropped view loses its permissions; and a second run would change the catalog again.
- **The ledger remembers what MIG-Ace installed.** **[decided]** For every such object it holds a checksum. An object is replaced when its checksum in the script is another one, or when the object is missing. The definitions on the server are not compared: PostgreSQL writes the text of a view differently from version to version, and such a comparison reports differences that are none.
- **A parameter of a run replaces every object.** **[decided]** A change that somebody made by hand on the server is not noticed by the checksum. This parameter covers that case, and it gives a run the behaviour of "drop all and create again" where a project wants it.
- **Materialized views are not replaceable for now.** **[decided]** Replacing one means computing its data again. They are changed by snippets.

## Where the definitions come from

**[direction]**

- The author writes these objects in any file of `schema/`, several in one file or one per file. No layout is required.
- The build splits the files into statements with the parser of the database itself. Checked for PostgreSQL: code in dollar quotes, `begin atomic` and semicolons inside texts do not split a statement. A statement that creates a view, a function, a procedure or a trigger is taken as the author wrote it. The author's text, with its comments, is what runs on every database.
- The checksum of an object is computed from the tokens of its statement. White space and comments do not count, so formatting a file replaces nothing.
- The migration script carries all of them, always: for every object its kind, its name, its checksum and its statement.

## How a change is noticed

No two schemas are compared for this. **[direction]**

- At build time nothing is decided. The script only knows the definitions of now.
- At run time every database decides for itself: the checksum that its ledger holds for an object against the checksum in the script.
- A database that jumps over several releases needs no history. Its ledger holds the checksum of the release it comes from, the script holds the one of now; they differ, the object is replaced by the definition of now. The definitions in between are never needed.
- An object that is in the ledger and no longer in the script is dropped. An object of these kinds that is in neither is left alone and reported, unless a project says that MIG-Ace owns every such object of the schema.
- Objects that belong to an extension are never touched.

The proof loop still compares the migrated database with the desired one at its end. That comparison proves the result; it does not steer the run.

## Order within a run

**[decided]** on 2026-11-27: these objects are brought up to date after all snippets, and snippets do not use them.

1. *The snippets run.* The views, functions, procedures and triggers of the database are still those of the release it comes from.
2. *During the snippets:* PostgreSQL refuses to drop a column, or to change its type, while a view uses it. Before such a part, the script drops the views that depend on the column, including views built on those views. Nothing else is dropped early. Because the script carries every view, each of them can be created again at the end. **[direction]**
3. *After the snippets:* changed functions and procedures are replaced, missing and changed views are created in the order of the files, missing and changed triggers are created, and objects that are no longer expected are dropped.

## Snippets do not use these objects

**[decided]** A snippet that names a view, a function or a procedure of `schema/` is an error at build time.

- While the snippets run, these objects are in the state of an older release, or not there at all. A snippet that uses one would run against whatever the database happens to have.
- The check covers statements under `do`, conditions, checks and `native` parts. For a `native` part the build uses the parser of the database. Code inside a text, such as the body of a `do` block, cannot be checked; the build says so.
- One consequence is a limit of the first version: an index, a default or a constraint that uses a function of the project cannot be created by a snippet, because the function would have to exist first. **[open]** (question 68)
- Triggers are different. A data part does not name a trigger; it fires the triggers of the table it writes, in their old state. Whether a run switches them off for itself is **[open]** (question 67).

## What other sessions see

Measured on PostgreSQL 18 with three sessions, 2026-11-23.

| Replacement | A statement of another session that arrives meanwhile |
|---|---|
| A view, dropped and created again in one transaction | Waits, then reads the new view. It never fails with "does not exist". |
| A view, with `create or replace view` | The replacement first waits for every open transaction that has read the view. A reader that arrives while it waits queues behind it. |
| A trigger, dropped and created again in one transaction | An insert waits, then runs with the new trigger. No row is written without a trigger. |
| A function, with `create or replace function` | Nothing waits. A call that is running ends with the old body; the next call uses the new one. |

- Nothing fails; statements wait. The wait is as long as the replacement, plus the time the replacement itself waits for open transactions that use the object. The time limits and attempts of a run bound it.
- One real failure was seen: a prepared statement with `select *` on a view fails once when the columns of the view changed. This is a matter of what the new definition means to the old application, not of the replacement.

## With upgrade phases

**[direction]**

- Created and replaced objects belong to `start`. The new version of the application needs them.
- Dropped objects belong to `finish`. The old version may use them until then.
- A view or function that is replaced in `start` therefore serves both versions for a while. A change that the old version cannot live with gets a new name; the old object goes with `finish`.

## Several databases

Views, functions and triggers are written in the language of one database. The layout below is **[decided]**; the first version of MIG-Ace has one database.

- The desired schema is per database already: the table definitions that an ORM generates differ from database to database.
- A project with one database keeps `schema/` as it is. A project with several has one folder per database below `schema/`, and may have one folder with files that every database understands.
- Everything in this note works per database: the split into statements, the checksums, the ledger, the replacement. Only how one object is replaced differs.
- The build can report an object that exists for one database and is missing for another.

## Details

**[direction]**

- The replacement of one object is one transaction. The exception is a view dropped in step 2 of the order. The build reports that case as a finding for zero-downtime upgrades.
- Permissions granted on a view are saved before the view is dropped and restored after it is created. A local administrator's grants therefore survive.
- A function with a changed parameter list is a new function plus a drop of the old one. If an index, default or constraint depends on the old one, a snippet has to change that object first. The proof loop reports it.
- A changed function that an index uses is replaced like any other. The values in the index were computed by the old body; the build reports this case.
- Triggers that MIG-Ace creates itself for an action with phases belong to that action and are not part of the desired schema.
- Types, domains, extensions and sequences are not replaceable. They are changed by snippets.
- `mig make` writes no snippet for a difference in a replaceable object. It lists the difference as "replaced by the next run".
