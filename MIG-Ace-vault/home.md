---
type: home
---

# MIG-Ace vault

Specifications and internal documentation of MIG-Ace. Nothing is implemented yet. This vault is the reference for the design.

Read [How to use this vault](how-to-use-this-vault.md) before you change anything.

## Start here

- [Overview](architecture/overview.md): purpose, principles, the big picture
- [Repository layout](architecture/repository-layout.md)
- [Roadmap](roadmap.md)
- [Glossary](glossary.md)

## Architecture

- [Desired schema and schema model](architecture/desired-schema-and-model.md)
- [Replaceable objects](architecture/replaceable-objects.md)
- [The proof loop](architecture/proof-loop.md)
- [Snippets](architecture/snippets.md)
- [Snippet generation](architecture/snippet-generation.md)
- [Ordering, changes and releases](architecture/ordering-and-releases.md)
- [Upgrade phases](architecture/upgrade-phases.md)
- [Execution and ledger](architecture/execution-and-ledger.md)
- [Tooling](architecture/tooling.md)
- [Configuration](architecture/configuration.md)
- [Multi-database support](architecture/multi-database.md)
- [Not planned](architecture/not-planned.md)

## MigQL, the language of snippets

- [Overview](migql/overview.md)
- [YAML profile](migql/yaml-profile.md)
- [Statement language](migql/statement-language.md)
- [Names and case](migql/names-and-case.md)
- [Native SQL and dialects](migql/native-sql-and-dialects.md)
- [Generation of database-specific SQL](migql/generation.md)
- [Stability](migql/stability.md)
- [Functions in expressions](migql/functions.md)
- [langium-tools](migql/langium-tools.md): the helper library used to build and test the language
- [langium-tools: wishes not reported yet](migql/langium-tools-issues.md)

## Engineering

- [Coding rules](engineering/coding-rules.md): strict test-driven development and the other rules for code

## Testing

- [Test concept](testing/test-concept.md)
- [Upgrade-path simulation](testing/upgrade-path-simulation.md)

## Decisions, questions, work

- [Decisions](decisions/index.md)
- [Open questions](questions/open-questions.md)
- [Specs](specs/README.md)
- [Journal](journal/README.md)
