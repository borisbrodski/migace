---
type: decision
status: decided
date: 2026-11-17
---

# Snippet generation is a main feature; an LLM names, it never writes statements

## Context

Most schema changes are simple and follow from the comparison that the proof loop makes anyway.

## Decision

`mig make` writes snippets from the comparison. It asks what it cannot know. Without a console it writes a `todo` that fails the build. An optional LLM chooses names and grouping only. Every table is assumed to have rows.

## Rejected alternatives

- Letting an LLM write statements: not reproducible, not provable.
