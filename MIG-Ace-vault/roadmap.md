---
type: roadmap
status: direction
---

# Roadmap

A milestone starts when its spec note exists in `specs/`. Order and content are the working plan, not a commitment.

| Milestone | Result | Status |
|---|---|---|
| M0 Workspace | Folders, build, the three test stages, CI. No features. | done; Linux, Windows and macOS |
| M1 MigQL parser | MigQL files are parsed and checked, tested with langium-tools. | done |
| M1.1 MigQL follow-up | Windows, checks across a project, `upsert`, syntax decisions. | done; Linux, Windows and macOS |
| M2 Schema model | The model is read from PGlite and compared. Fingerprint. | done |
| M3 PostgreSQL generation | Every construct becomes correct PostgreSQL, proven by PostgreSQL's parser and on a database. | done |
| M3.1 Exact names | A name is exact, with or without quotes. Proven on a bookshop in mixed case. | done |
| M3.2 Actions | `do` runs what was written. Five actions with keys of their own, descriptions for the editor, a YAML schema. | done |
| M4.1 Plan and script | Snippets are compiled to a plan and a script with the ledger. Failures, conditions and checks, on PGlite. | done |
| M4.2 Real PostgreSQL | Temporary servers from binaries. Two runners, killed runs, locks. | done; Linux, Windows and macOS |
| M4.3 Client contract and Java runner | The adapter contract as data. Java library and command line. | done; Linux, Windows and macOS |
| M4.4 Corrections | A run touches its own schema only and leaves its session as it was. Every try is recorded. Limits are parameters. PostgreSQL from official sources. | spec ready |
| M4.5 Install and replaceable objects | A new database gets the schema directly. Adopt. Views, functions and triggers. | proposed |
| M4.6 Data parts | `batch` and `expect-rows`. | |
| M5 Proof loop | Baseline, migration, comparison, second run, install on an empty database. The bookshop passes. | |
| M6 Generation | `mig make` writes snippets from the comparison. | |
| M7 Releases and phases | Release files, the guard against accidental edits, ordering, `start` and `finish`, upgrade-path simulation. | |
| M8 Editor | Schema-aware completion, VS Code extension. | |
| M9 First release | Gradle plugin, documentation checked against the tool, the website loses its banner. | |
