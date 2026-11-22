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
| [M1.1 MigQL follow-up](m1-1-migql-follow-up.md) | done; the Windows job (M1.1-AC-01 to 03) has not run yet |
| [M2 Schema model, comparison and fingerprint](m2-schema-model.md) | done |
| [M3 PostgreSQL generation of statements](m3-postgresql-generation.md) | done |
| [M3.1 Exact names](m3-1-exact-names.md) | ready |
| [M3.2 Actions](m3-2-actions.md) | ready; starts after M3.1 |
| [M4.1 Plan and script](m4-1-plan-and-script.md) | ready; starts after M3.2 |
| [M4.2 Real PostgreSQL](m4-2-real-postgresql.md) | ready; starts after M4.1 |
| [M4.3 Client contract and Java runner](m4-3-client-contract-and-java-runner.md) | ready; starts after M4.1 |

M3.1 comes first: it changes how every name is generated, and the expected files of the later specs depend on it. M3.2 comes second: it changes what `do` generates. M4.2 and M4.3 do not depend on each other.

What was found and what was chosen on the way is in the [journal](../journal/README.md): the [session note](../journal/2026-11-21-workspace-and-migql-parser.md), the [review](../journal/2026-11-21-review-of-m0-and-m1.md) the [note on M1.1, M2 and M3](../journal/2026-11-21-m1-1-m2-m3.md) and the [second review](../journal/2026-11-22-review-and-next-specs.md).
