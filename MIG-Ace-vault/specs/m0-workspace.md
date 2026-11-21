---
type: spec
status: ready
milestone: M0
---

# M0 Workspace

## Goal

A workspace in which the next milestones can be built and tested on Linux, macOS and Windows. No feature of MIG-Ace yet.

## Non-goals

- Any parsing, comparison or generation.
- Publishing packages.

## Builds on

- [Repository layout](../architecture/repository-layout.md)
- [langium-tools](../migql/langium-tools.md), for the versions of Node, TypeScript, Langium and Vitest
- [Test concept](../testing/test-concept.md)
- [Coding rules](../engineering/coding-rules.md)

## Working assumptions

To be confirmed or replaced while doing the work. Record the outcome in the journal.

- npm workspaces, because Langium and langium-tools use npm and no extra tool is needed on locked-down machines.
- One TypeScript base configuration in the root, extended by each package.
- langium-tools comes from npm in version 0.4.0.

## Acceptance criteria

- **M0-AC-01** `npm install` in the root installs everything. The supported Node versions are declared and checked.
- **M0-AC-02** In the root, `npm run build`, `npm run lint` and `npm test` work and cover every package.
- **M0-AC-03** `migql/` is a Langium project with a placeholder grammar and one test that uses a matcher from `langium-tools/testing`.
- **M0-AC-04** A snapshot test of the generator exists for the placeholder, and `npm run test:generate` rewrites its snapshot on Linux, macOS and Windows.
- **M0-AC-05** A lint rule fails when code in `core/` imports from `databases/` or from `migql/generators/`. A test proves that the rule fires.
- **M0-AC-06** A GitHub Actions workflow runs build, lint and tests on every push to `candidate` and to feature branches, on Linux and on Windows.
- **M0-AC-07** No step needs Docker.
- **M0-AC-08** The README has a section "Development" with the commands, and the section "Commands" in `CLAUDE.md` lists them too.

## Open points

- Whether macOS runs on every push or only nightly.
