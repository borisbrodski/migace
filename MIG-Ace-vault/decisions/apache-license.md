---
type: decision
status: decided
date: 2026-11-21
---

# MIG-Ace is licensed under the Apache License 2.0

## Context

The runner library is linked into the applications of users, and a migration script that ships with an application contains run-time code of MIG-Ace. Users are mostly companies with Java applications.

## Decision

MIG-Ace is open source under the Apache License 2.0. An additional permission, in `LICENSE-GENERATED-OUTPUT.md`, lets users use generated files without the conditions of the licence.

## Rejected alternatives

- MIT: also permissive, but without an explicit patent grant.
- GPL, AGPL, LGPL: copyleft would reach into the products of users or keep companies away.
- A source-available licence such as the Functional Source License: not open source.

## Open

- The wording of the additional permission was not checked by a lawyer.
- Whether contributors sign an agreement that allows a later change of licence.
