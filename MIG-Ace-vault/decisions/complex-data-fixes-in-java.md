---
type: decision
status: decided
date: 2026-11-19
---

# Complex data fixes are written in Java and tracked outside MIG-Ace

## Context

A bug left slightly wrong data. Correcting it needs business logic that exists in the application. The logic is compiled against the current table shape, so it cannot run at an older point of the migration.

## Decision

Such fixes are written in Java inside the application and tracked there, separately from MIG-Ace. Fixes that are plain set-based updates stay repair snippets.

## Rejected alternatives

- Java code parts inside the migration script: break the static script and still cannot use the business logic.
- Java against a pinned shape with copies of old entity classes: heavy, and the services do not work on the copies.
- A task system inside MIG-Ace that shares the ledger: not chosen.
