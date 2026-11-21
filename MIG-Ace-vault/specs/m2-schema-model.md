---
type: spec
status: ready
milestone: M2
---

# M2 Schema model, comparison and fingerprint

## Goal

MIG-Ace reads the schema of a PostgreSQL database into a model, compares two models and reports every difference, and computes a fingerprint of a model.

This is the base of the proof loop, of snippet generation and of the check at application start.

## Non-goals

- Real PostgreSQL binaries. This milestone uses PGlite only.
- Writing snippets from differences. That is a later milestone.
- Owner, grants and row-level security.
- Tablespaces, storage parameters and other physical details.
- The SQL that computes the fingerprint inside the migration script.
- Ignore patterns for objects of local administrators.

## Builds on

- [Desired schema and schema model](../architecture/desired-schema-and-model.md)
- [Replaceable objects](../architecture/replaceable-objects.md)
- [Repository layout](../architecture/repository-layout.md), for the rule that `core/` knows no database
- [Test concept](../testing/test-concept.md)
- [Coding rules](../engineering/coding-rules.md)
- The website pages `desired-schema.md`, `bookshop.md` and `views-functions-triggers.md`, for the bookshop schema

## Where the code goes

| Folder | Content |
|---|---|
| `core/` | the model, the comparison, the canonical form, the fingerprint. No SQL, no database. |
| `databases/postgresql/` | reads the PostgreSQL catalog into the model. Works on any connection that can run a query. |
| `examples/bookshop/schema/` | the schema files of the bookshop, as the website shows them |

`core/` defines the interface of a schema reader. `databases/postgresql/` implements it.

## Order of work

1. The model and its canonical form, in `core/`, without a database.
2. Comparison of two models.
3. Fingerprint.
4. The bookshop schema files.
5. Reading tables and columns from PGlite.
6. Reading the other kinds of objects, one after the other.
7. End-to-end: two databases, read, compare.

## Acceptance criteria

### Model

- **M2-AC-01** The model holds: tables; columns with type, type details, nullability, default and identity; primary keys; unique constraints; foreign keys with their columns, target and actions; check constraints; indexes with columns or expressions, uniqueness, method and condition; sequences; views; functions and procedures; triggers; enum types; domains; extensions; comments.
- **M2-AC-02** The order of columns in a table does not belong to the model. Two tables that differ only in column order are equal.
- **M2-AC-03** The order in which objects were created does not matter. Two models built in different order are equal.
- **M2-AC-04** An object that belongs to another object is part of its owner: the index behind a primary key or a unique constraint, the sequence behind an identity column. It does not appear a second time.

### Comparison

- **M2-AC-05** Comparing two models gives a list of differences. Each one has a kind (missing, unexpected, different), the object, and for "different" the property with the expected and the actual value.
- **M2-AC-06** The list has a fixed order and a text form. The text form is a golden file for the bookshop cases.
- **M2-AC-07** A constraint or an index with the same definition and another name is reported as one difference "name differs", not as one missing and one unexpected object.
- **M2-AC-08** Every single change from this list is found, each in a test of its own: a column added, removed, with another type, another length, another nullability, another default; a constraint added, removed, changed; an index added, removed, changed; a sequence changed; a view, a function or a trigger changed; a comment changed.
- **M2-AC-09** Two equal models give an empty list.

### Fingerprint

- **M2-AC-10** The fingerprint is a SHA-256 hash of the canonical form of a model.
- **M2-AC-11** Equal models have equal fingerprints, whatever the order of creation and the order of columns. A property-based test builds the same schema in random order.
- **M2-AC-12** Every single change of M2-AC-08 changes the fingerprint.
- **M2-AC-13** The canonical form is readable text, so that two fingerprints can be explained by a diff of their canonical forms.

### Reading PostgreSQL

- **M2-AC-14** The reader works on PGlite, in the test process, without a server and without Docker.
- **M2-AC-15** The reader takes a schema name and reads only that schema.
- **M2-AC-16** Tables whose name starts with a given prefix are left out. The default prefix is `mig_`. This is for the ledger tables.
- **M2-AC-17** Each kind of object of M2-AC-01 is read correctly. Each kind has tests that create the object with SQL and check the model.
- **M2-AC-18** Texts that PostgreSQL stores in its own form (view definitions, defaults, check expressions, index expressions) are taken as PostgreSQL returns them.
- **M2-AC-19** The reader needs no more than a function that runs a query and returns rows. A test proves it with a fake that records the queries.

### The bookshop

- **M2-AC-20** `examples/bookshop/schema/` holds the schema files of the bookshop as the website shows them. They run in name order on an empty PGlite database without an error.
- **M2-AC-21** The model of the bookshop is a golden file in canonical form.
- **M2-AC-22** Two databases are built: one from the schema files, one from the same files with one statement changed. The comparison reports exactly that change. This is repeated for five different changes.

### Rules

- **M2-AC-23** The lint rule of M0-AC-05 still holds: `core/` imports nothing from `databases/`.
- **M2-AC-24** The time to read and compare the bookshop schema is measured and written into the journal.

## Open points

- If the bookshop needs an extension that PGlite does not have, write it into the journal and leave that object out of this milestone.
- Whether comments on objects belong to the fingerprint is taken from the architecture note: yes.
