---
type: decision
status: decided
date: 2026-11-16
---

# One release file per release

## Context

The build must know which snippets were released in which state, also across branches and cherry-picks.

## Decision

`mig release <version>` writes one new file that lists the snippets that are new or changed in this release, with part hashes.

## Rejected alternatives

- A release property inside each snippet with a git merge driver: merge conflicts and a custom driver on every machine.
