---
type: decision
status: decided
date: 2026-11-21
---

# An Obsidian vault in the repository; main is the release, work happens on candidate

## Context

Design knowledge must be available to people and to coding agents that have no access to earlier conversations.

## Decision

Specs and internal documentation live in the Obsidian vault `MIG-Ace-vault/` inside the repository. `main` stays on the current release. Work is pushed directly to `candidate` or to an existing feature branch; there are no pull requests. Nothing from a real or private project is stored in the repository.

## Rejected alternatives

- One large ARCHITECTURE.md: too long to read for one task.
