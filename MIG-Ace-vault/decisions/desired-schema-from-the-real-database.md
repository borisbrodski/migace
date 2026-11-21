---
type: decision
status: decided
date: 2026-11-12
---

# The desired schema is read from a real database

## Context

The application's schema is more than what Hibernate knows: hand-written SQL, views, functions, database-specific features.

## Decision

The desired schema is whatever a real database contains after the schema scripts ran. Two schema models are compared, never two DDL texts. Hibernate is only a producer of one DDL file.

## Rejected alternatives

- Reading Hibernate's schema objects: misses hand-written SQL and binds MIG-Ace to Hibernate.
