---
type: architecture
status: mixed
---

# The proof loop

The proof loop is the central test. **[decided]**

1. Build the desired state in scratch schema A from `schema/`.
2. Load a baseline, an older state with data and its ledger, into scratch schema B.
3. Run the compiled migration script on B, with test data inserted around each snippet.
4. Compare the meta-models of A and B. Any difference in the logical tier fails the build.
5. Run the script a second time. It must do nothing.
6. Run the script on an empty database. The result of this installation must also equal A. **[direction]**

Details:

- **Baselines:** each supported release is a baseline. A baseline carries its ledger, so the loop applies exactly what that release is missing. **[direction]**
- **Upgrade paths:** paths that produce the same snippet sequence are tested once. Only out-of-order snippets (hotfixes) create additional sequences. Baselines can be synthesised from a release tag instead of stored as dumps. **[direction]**
- **Lost-hotfix check:** a release fails if a snippet from an older supported release is missing and not archived. **[direction]**
- **Scratch database:** the build must work on locked-down Windows machines without container support and inside containers that cannot start further containers. **[decided]** The scratch database is a provider interface. **[direction]**

| Provider | Use |
|---|---|
| Real PostgreSQL binaries started as a child process | default for the proof loop; same major version as production |
| PGlite (PostgreSQL compiled to WebAssembly) | editor meta-model and snippet generation **[decided]**; optional fast checks |
| Schema pair on a shared server | builds that cannot start processes |
| Testcontainers | optional convenience for other users |

## Upgrade paths

Which sequences of snippets the build has to run, including release lines and the `start` and `finish` phases, is described in [Upgrade-path simulation](../testing/upgrade-path-simulation.md).
