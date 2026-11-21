---
type: decision
status: direction
date: 2026-11-19
---

# Snippets are ordered by branch, then timestamp

## Context

With maintenance branches, the order in which a database runs snippets depends on its upgrade path.

## Decision

Snippets sort by the first release that lists them, then by timestamp. All databases from an older release line then run one sequence.

## Rejected alternatives

- Pure timestamp order: each hotfix level of the older line gets its own interleaving with the newer line's snippets.
