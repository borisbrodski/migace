---
type: decision
status: decided
date: 2026-11-21
---

# The language is built and tested with langium-tools

## Context

The language of snippets is a Langium project with many small syntax and generation tests. langium-tools is an existing open-source library by the same author with helpers for exactly this: unified issues, marked text, Vitest matchers, in-memory generation and snapshot tests for generators.

## Decision

MIG-Ace uses langium-tools for the code and the tests of the language. Improvements that are not specific to MIG-Ace go into langium-tools.

See [langium-tools](../migql/langium-tools.md) for what is used and what has to be settled.

## Consequences

- Langium, Node, TypeScript and Vitest versions follow langium-tools.
- The catalogue of constructs uses the folder layout of the generator snapshot tests.
