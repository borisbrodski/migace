---
type: roadmap
status: direction
---

# Roadmap

A milestone starts when its spec note exists in `specs/`. Order and content are the working plan, not a commitment.

| Milestone | Result |
|---|---|
| M0 Workspace | Folders, build, the three test stages, CI. No features. |
| M1 Language | The grammar parses the catalogue of constructs, tested with langium-tools. This answers the open question whether Langium handles literal blocks, key-dependent lexing and error recovery. |
| M2 Schema model | The model is read from PGlite and compared. Fingerprint. |
| M3 Script | Snippets are compiled to a script that runs on real PostgreSQL, with the ledger. Java runner. |
| M4 Proof loop | Baseline, migration, comparison, second run, install on an empty database. The bookshop passes. |
| M5 Generation | `mig make` writes snippets from the comparison. |
| M6 Releases and phases | Release files, the guard against accidental edits, ordering, `start` and `finish`, upgrade-path simulation. |
| M7 Editor | Language server with schema-aware completion, VS Code extension. |
| M8 First release | Gradle plugin, documentation checked against the tool, the website loses its banner. |
