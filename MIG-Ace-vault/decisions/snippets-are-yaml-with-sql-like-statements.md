---
type: decision
status: decided
date: 2026-11-16
---

# Snippets are valid YAML with statements in a SQL-like language

## Context

Snippets need structure (parts, conditions, test data) and statements that developers can read without learning a new notation.

## Decision

A snippet is a valid YAML file. Statements and conditions are written in a SQL-like language. One grammar parses the whole file, so a syntax error in a statement is a build error. Without MIG-Ace tooling, any YAML editor with the published schema gives basic support.

## Rejected alternatives

- Typed operation maps in pure YAML: verbose, and conditions repeat what the operation already says.
- A separate file format that is not YAML: no fallback editing.
- A YAML language server with an embedded second language server: depends on another team's server and is hard to build.
- SQL as the language for conditions: specific to one database.
