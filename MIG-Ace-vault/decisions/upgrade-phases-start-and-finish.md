---
type: decision
status: decided
date: 2026-11-19
---

# Upgrades have two phases: start and finish

## Context

During a rolling upgrade old and new application versions run together. Changes that break the old version must wait until it is gone. A design with expand in one release and contract in the next keeps leftovers for a whole release and breaks when a customer skips a release.

## Decision

A part is marked `phase: finish` when it breaks older versions. Without a phase the script runs both phases; `start` and `finish` are given explicitly for a rolling upgrade. `start` never runs finish parts; only `finish` declares that older versions are gone. A failed part is retried on the next run and blocks everything after it.

## Rejected alternatives

- A registry of running application instances that lets `finish` check: the application has no way to sign off.
- Finishing the previous upgrade automatically when the next one starts: assumes that old versions are gone.
- `start` as the default phase: agreed on 2026-11-19 and changed on 2026-11-21. A migration script that is started without parameters must leave a finished database.
