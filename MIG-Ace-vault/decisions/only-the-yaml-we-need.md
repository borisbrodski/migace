---
type: decision
status: decided
date: 2026-11-16
---

# The grammar supports only the YAML constructs that snippets need

## Context

Full YAML is large. Snippets use a small part of it.

## Decision

The grammar covers block mappings, block sequences, single-line values, literal blocks, comments and single-line flow maps. Everything else is rejected.

## Rejected alternatives

- Supporting all of YAML: much effort for constructs nobody needs in a snippet.
