---
type: decision
status: decided
date: 2026-11-16
---

# No test rows without a testdata entry

## Context

Random rows prove little. Authors know which values matter.

## Decision

Nothing is inserted unless a snippet has a `testdata` entry. After a snippet, every affected table must have a full row and a minimal row.

## Rejected alternatives

- Generating rows for every new table automatically.
