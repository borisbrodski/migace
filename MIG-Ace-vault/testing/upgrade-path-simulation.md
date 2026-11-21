---
type: testing
status: mixed
---

# Upgrade-path simulation

Customers reach the same release on different paths. They start from different releases, skip releases, come from different release lines, and run `finish` at different times. MIG-Ace has a test run that simulates these paths. **[decided]**

The background is in [Ordering, changes and releases](../architecture/ordering-and-releases.md) and [Upgrade phases](../architecture/upgrade-phases.md).

## Why the number of runs stays small

The possible histories grow exponentially. They are all built from two kinds of steps, and each step is tested once. **[direction]**

- **A start step:** the start parts of one more release.
- **A finish step:** all pending finish parts.

This works because the proof loop shows, after every completed step, that the schema is exactly the expected one. A database that reached a release on any path has the same schema as the baseline of that release.

## Chains per build

1. **One chain in release order per release line**, from the oldest supported release. It takes a snapshot at every finished state. Supported releases of that line are snapshots along the chain.
2. **One chain per merge from an older line** on the newer line, for the databases that get the merged snippets late.
3. **One deferred chain per unfinished state** inside the `compatible-with` window: all start parts first, then all finish parts.

## Checks at an in-between state

After `start` and before `finish`:

- **Reads:** everything the schema of the older release has still exists with the same types. This compares models.
- **Writes:** fresh copies of the test rows of the older release are inserted, as the old application would write them.
- **Finish:** the finish parts then run on top of those rows, and the result must equal the desired schema. A `set not null` that forgets rows written during the rollout fails here.

## Checks for late snippets

- Both real orders are run, see chain 2.
- **Overlap report:** a late snippet is compared with every newer snippet that already ran. If both read or write the same columns, the pair is reported, even when both runs pass. Native SQL parts declare what they touch, or count as touching everything. **[direction]**

## What is not proven

The schema is proven equal on every path. The data is not. Two orders of the same snippets can leave different rows. The overlap report is the protection against this.

## Cost

With one release line and a `compatible-with` window of one release, the simulation is the chain that the proof loop runs anyway. Each further line, merge and window step adds one short chain. Snapshots are PostgreSQL template databases.
