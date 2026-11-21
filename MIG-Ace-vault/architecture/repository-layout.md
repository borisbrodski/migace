---
type: architecture
status: direction
---

# Repository layout

```text
migace/
├─ CLAUDE.md                 short rules and pointers for coding agents
├─ README.md
├─ MIG-Ace-vault/            this vault
│
├─ migql/                 the language of snippets, one Langium project
│  ├─ grammar/               grammar files: YAML profile, statements, expressions
│  ├─ src/                   parser services, checks, language server
│  ├─ constructs/            catalogue: one folder per construct with examples and expected SQL
│  └─ generators/
│     └─ postgresql/         statements to PostgreSQL SQL and DDL
│
├─ core/                     database-neutral: schema model, comparison, fingerprint,
│                            ordering, release files, compiler to a plan
├─ databases/
│  └─ postgresql/            catalog reader, script runtime (ledger, phases), temporary databases
├─ cli/                      the mig commands
│
├─ editors/
│  └─ vscode/                thin extension that starts the language server
├─ clients/                  run the script and integrate with builds, per ecosystem
│  ├─ contract/              the adapter contract and its test suite, independent of any language
│  ├─ java/                  runner library and command line
│  └─ gradle/                Gradle plugin
│
├─ tests/
│  ├─ acceptance/            scenarios that run the tool as a user would
│  └─ upgrade-paths/         simulation of customers upgrading through different paths
├─ examples/
│  └─ bookshop/              the running example as a real project
└─ website/
```

## Rules

- `core/` imports nothing from `databases/` and nothing from `migql/generators/`. Database-specific code is reached through interfaces that `core/` defines.
- The language server is part of `migql/`, because Langium builds it from the same services as the parser. `editors/` holds only thin clients.
- `examples/bookshop/` is a tested project. The end-to-end tests run on it, and the website takes its examples from it.
- Nothing in the repository comes from a real or private project.

## Adding a database

A new database, for example MySQL or SQL Server, touches three places and nothing else:

1. `migql/generators/<database>/`: statements to that database's SQL.
2. `databases/<database>/`: catalog reader, script runtime and temporary databases.
3. `migql/constructs/*/generated/<database>/`: the expected SQL for every construct.

## Adding a client

A client runs the migration script from one ecosystem: Maven, Python, Ruby, Go and so on.

1. Add `clients/<name>/`.
2. Pass the test suite in `clients/contract/`. The suite is data (scripts with markers and expected calls), so every language can run it.

A client contains no migration logic. See the adapter contract in [Execution and ledger](execution-and-ledger.md).

## Branches

- `main` is the current release.
- Work happens on `candidate`, or on a feature branch if one exists for the task.
- Changes are pushed directly. There are no pull requests.
