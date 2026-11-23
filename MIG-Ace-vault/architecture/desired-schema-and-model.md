---
type: architecture
status: mixed
---

# Desired schema and schema model

## Desired state

- The desired state is the set of SQL files in `schema/`, applied in lexical order to an empty scratch database. **[decided]**
- Generated files (for example `101-generated.sql` from Hibernate) and hand-written files (`102-…`, `103-…`) are peers. Several generated files are allowed. Whether a file was generated or written by hand makes no difference to the comparison. **[decided]**
- Views, functions, procedures and triggers live in `schema/`. A run replaces those that changed. **[decided]** Details are in [Replaceable objects](replaceable-objects.md).
- **Staleness check:** the build fails when the committed schema snapshot no longer matches what `schema/` produces. This holds for regenerated files and for manual edits to hand-written files alike. **[decided]**

## Meta-model

- The schema is read from the real database catalog into a meta-model. Two meta-models are compared, never two DDL texts. **[decided]**
- The same meta-model is the source of generated snippets and of the schema fingerprint. **[decided]**
- Every attribute belongs to a significance tier. Only the logical tier takes part in comparison and fingerprint. **[direction]**

| Tier | Examples (PostgreSQL) | Compared | In fingerprint |
|---|---|---|---|
| Logical | tables, columns, types, nullability, defaults, keys, checks, indexes, sequences, views, functions, triggers, comments | yes | yes |
| Physical | tablespace, fill factor, storage parameters, statistics targets | no | no |
| Deployment | owner, grants, row-level security policies | no, switchable | no |

- Column order is not significant, because PostgreSQL can only append columns. **[direction]**
- Objects that belong to another object (the index behind a primary key, the sequence behind an identity column) are compared through their owner only. **[direction]**

## Naming of constraints and indexes

Constraints and indexes are not renamed after every snippet. **[direction]**

- A naming convention produces names when DDL is generated and when snippets are generated.
- A lint rule requires explicit names for constraints and indexes created in snippets.
- The comparison matches objects by definition first. A name difference with an identical definition is a separate, lower-severity finding.
- Table aliases are declared in configuration and mirrored into a database table, because the application and some snippets read that table. **[direction]**

## Fingerprint

- The fingerprint is the hash of the canonical meta-model. **[decided]**
- It is recomputed from the real schema at the end of every migration run and compared with the expected value. A stored hash alone is not trusted. **[decided]**
- A run-time property excludes objects by pattern, so that local administrators can add indexes or other objects. **[decided]** Only additional objects can be excluded, never missing or changed expected ones. **[direction]**
- Because no library runs at migration time, the canonical model is produced by SQL, once per dialect, and the build uses the same SQL. **[direction]**
- The text PostgreSQL returns for views, defaults and checks can differ between major versions. The script therefore carries one expected fingerprint per supported major version. **[direction]**
