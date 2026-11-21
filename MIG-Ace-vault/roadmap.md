---
type: roadmap
status: direction
---

# Roadmap

A milestone starts when its spec note exists in `specs/`. Order and content are the working plan, not a commitment.

| Milestone | Result | Status |
|---|---|---|
| M0 Workspace | Folders, build, the three test stages, CI. No features. | done on Linux |
| M1 MigQL parser | MigQL files are parsed and checked, tested with langium-tools. | done |
| M1.1 MigQL follow-up | Windows, checks across a project, `upsert`. | spec ready |
| M2 Schema model | The model is read from PGlite and compared. Fingerprint. | spec ready |
| M3 PostgreSQL generation | Every construct becomes correct PostgreSQL, proven by PostgreSQL's parser and on a database. | spec ready |
| M4 Script | Snippets are compiled to a script that runs on real PostgreSQL, with the ledger. Java runner. | |
| M5 Proof loop | Baseline, migration, comparison, second run, install on an empty database. The bookshop passes. | |
| M6 Generation | `mig make` writes snippets from the comparison. | |
| M7 Releases and phases | Release files, the guard against accidental edits, ordering, `start` and `finish`, upgrade-path simulation. | |
| M8 Editor | Schema-aware completion, VS Code extension. | |
| M9 First release | Gradle plugin, documentation checked against the tool, the website loses its banner. | |
