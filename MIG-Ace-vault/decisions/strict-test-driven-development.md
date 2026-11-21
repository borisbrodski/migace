---
type: decision
status: decided
date: 2026-11-21
---

# Code is written with strict test-driven development

## Context

Most code will be written by coding agents. Without a fixed rhythm they tend to write large pieces at once, with logic that no test covers.

## Decision

Every coding task that is not user-interface work follows the cycle: one failing unit test, the smallest implementation that passes it, then refactoring. See [Coding rules](../engineering/coding-rules.md).
