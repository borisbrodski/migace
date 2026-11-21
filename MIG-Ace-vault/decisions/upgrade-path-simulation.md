---
type: decision
status: decided
date: 2026-11-21
---

# A test run simulates customers upgrading through different paths

## Context

Customers start from different releases, skip releases, come from different release lines and finish upgrades at different times.

## Decision

MIG-Ace gets a test run that executes migrations in the different orders that these paths produce. See the testing note.
