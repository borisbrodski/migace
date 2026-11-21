---
type: guide
---

# Specs

One note per milestone or feature, written before the work starts. Use the template in `templates/spec.md`.

A spec contains: goal, non-goals, the notes it builds on, numbered acceptance criteria (`M1-AC-01`), and open points. Every acceptance criterion gets at least one test that names it.

| Spec | Status |
|---|---|
| [M0 Workspace](m0-workspace.md) | done on Linux; Windows (M0-AC-04, M0-AC-06) moves to M1.1 |
| [M1 MigQL parser and checks](m1-migql-parser.md) | done except `upsert` (M1-AC-08), which moves to M1.1 |
| [M1.1 MigQL follow-up](m1-1-migql-follow-up.md) | ready; includes the syntax decisions taken after M1 |
| [M2 Schema model, comparison and fingerprint](m2-schema-model.md) | ready |
| [M3 PostgreSQL generation of statements](m3-postgresql-generation.md) | ready; needs M2 for its last part |

M1.1 and M2 do not depend on each other.

What was found and what was chosen on the way is in the [journal](../journal/README.md): the [session note](../journal/2026-11-21-workspace-and-migql-parser.md) and the [review](../journal/2026-11-21-review-of-m0-and-m1.md).
