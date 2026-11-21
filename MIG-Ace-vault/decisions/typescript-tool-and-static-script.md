---
type: decision
status: direction
date: 2026-11-16
---

# A TypeScript tool at build time, a static SQL script at run time

## Context

The migration must run in many environments, and later from many languages. Framework code inside the database or a library at migration time ties every installation to one technology.

## Decision

The tool is written in TypeScript and runs only at build time. It produces one static script per database, and the script contains all logic. A thin client sends it.

## Rejected alternatives

- Core and runner in Kotlin on the classpath at migration time: needs a JVM and the library wherever a migration runs.
- Framework code stored in the database as packages or procedures: must itself be installed and upgraded.
