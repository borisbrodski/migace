---
type: decision
status: decided
date: 2026-11-16
---

# A part that ran is never run again; changes are guarded at build time

## Context

Released snippets sometimes have to be changed. Databases that already ran the old version must not be damaged.

## Decision

At run time a part that already ran is always skipped. At build time every released part must match a recorded hash unless the snippet carries `changed: <reason>`. Databases that ran a faulty version are corrected by repair snippets.

## Rejected alternatives

- `if-changed: rerun`: older runs had side effects, running again is dangerous.
- `if-changed: fail`: stops installations for a change they cannot influence.
- Released snippets are immutable: not realistic.
