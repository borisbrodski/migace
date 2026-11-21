---
type: decision
status: decided
date: 2026-11-21
---

# The language is called MigQL, and snippet files end in .migql.yaml

## Context

The language of snippets needed a name, like HQL for Hibernate. Simple control flow may be added later, so the name must not promise only DDL or only queries. A second language may be added one day, so a folder called `language` would be ambiguous.

## Decision

The language is called MigQL. Snippet files end in `.migql.yaml`. Folders that belong to the language carry the name: `migql/` in the repository and in the vault.

## Rejected alternatives

- MADDQL: names DDL and queries, and is hard to say.
- MQL: used by many other languages.
- AceQL: the name of an existing product.
- `.mig.yaml` as the extension: does not name the language.
