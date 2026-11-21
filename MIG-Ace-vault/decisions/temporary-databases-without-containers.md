---
type: decision
status: decided
date: 2026-11-13
---

# Temporary databases without containers

## Context

The build must work on locked-down Windows machines without container support, and inside containers that cannot start containers.

## Decision

The proof loop uses real PostgreSQL binaries as a child process. PGlite serves the editor and snippet generation. A server with two schemas and containers are optional alternatives.

## Rejected alternatives

- Testcontainers as the default: not available where it is needed most.
