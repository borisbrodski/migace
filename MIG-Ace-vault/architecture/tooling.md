---
type: architecture
status: mixed
---

# Tooling

## Implementation

- The tool is written in TypeScript. Nothing of it runs at migration time. **[direction]**
- The snippet language and its language server are built with Langium. **[direction]** One grammar covers the YAML profile and the statement language. **[decided]**
- The same parser serves the build and the editor.
- The language is built and tested with [langium-tools](../migql/langium-tools.md). **[decided]**

## Language server and editors

- The MIG-Ace language server parses the whole file and offers completion for all syntax elements, including tables and columns. **[decided]**
- For the snippet being edited, the server builds the expected meta-model by running all earlier snippets. **[decided]** PGlite is the engine for this. **[decided]** Results are cached per snippet. **[direction]**
- Without the MIG-Ace server, a YAML editor with `schema.json` gives basic support. The MIG-Ace server does not depend on any YAML language server. **[decided]**
- Delivery: a VS Code extension, a thin IntelliJ plugin, and the server as a command for other editors. **[direction]**

## Commands

Names are provisional. **[direction]**

| Command | Purpose |
|---|---|
| `mig make` | generate a snippet from the difference between desired state and migrated baseline |
| `mig test` | run the proof loop |
| `mig compile` | produce the migration script per dialect |
| `mig release <version>` | write the release file, seal `changed` markers, run the lost-hotfix check **[decided]** |
| `mig archive` | move old snippets to the backup directory and advance the starting schema |
| `mig config` | print the effective settings and where each one comes from |
| `mig ls` | start the language server |

## Build integration

A thin Gradle plugin calls the tool. The Hibernate DDL generation stays a JVM task of the application build. **[direction]**
