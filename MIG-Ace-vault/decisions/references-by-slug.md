---
type: decision
status: decided
date: 2026-11-21
---

# Snippets are referenced by their slug, and slugs are unique

## Context

A condition such as `when: ran …` names another snippet. The full name of a snippet starts with a timestamp, and the timestamp changes when the snippet is moved. A reference by full name would break then.

## Decision

A reference uses the slug: the name without the timestamp. The build checks that slugs are unique in a project, archived snippets included, and that every reference points to an existing snippet and part.

## Rejected alternatives

- Reference by full name: breaks when a snippet is reordered.
- Reference by `uid`: stable, but nobody can read it in a review.
