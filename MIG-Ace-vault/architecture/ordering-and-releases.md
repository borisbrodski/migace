---
type: architecture
status: mixed
---

# Ordering, changes and releases

## Ordering and branching

- Snippets from different branches are merged by plain file merge, and CI decides whether the merged set works. There is no migration graph and no merge migration. **[decided]**
- **Order:** snippets sort by the first release that lists them (releases in version order), then by the timestamp in their name. Snippets that are not released yet come last, by timestamp. This is "branch + timestamp" order. **[direction]**
- Whether the branch is derived from the release files, as written here, or stated in the snippet is **[open]**.
- An installation applies every snippet it has not run, in order, even when some sort before its newest applied snippet. This is normal and is recorded. **[direction]**
- Reordering must always be possible, also after release. **[decided]** Inside a release it is done by changing the timestamp in the name. Optional `before` and `after` constraints exist for cases where a rename is not wanted. **[direction]**
- **References between snippets use the slug**, the name without the timestamp, so that reordering does not break them. Slugs are unique in a project, and the build checks every reference. The ledger and the script use the `uid`. **[direction]**

Why this order and not pure timestamp order: **[direction]**

- On one release line, released history is append-only. The pending snippets of any older release are always the tail of one sequence.
- Every database that comes from an older release line runs the same sequence, whatever its hotfix level. With pure timestamps, each hotfix level gets its own interleaving, and each can break on its own.
- A feature snippet with an old timestamp that is merged after a release no longer sorts into the middle of that release.

What no order can avoid: a snippet merged from an older line is **late** for databases that already ran newer snippets, because a snippet that ran cannot be moved. The build lists the late snippets per supported release.

## Conflicts between release lines

A hotfix snippet `f` on an older line can conflict with a snippet `c` that is already released on a newer line. Nothing on the older line can prevent this, because `c` is not visible there. The conflict shows up when the older line is merged into the newer one. What MIG-Ace does: **[direction]**

1. **Detect it at the merge commit.** The build on the newer line runs both real situations: `f` then `c` (from the releases of the older line) and `c` then `f` (from the releases of the newer line).
2. **Report overlaps even when both runs pass.** A late snippet is compared with every newer snippet that already ran. If both read or write the same columns, the build reports the pair, because the two orders may leave different data.
3. **Resolve it on the newer line.** `c` is marked `changed`, so it is corrected for databases that have not run it and skipped where it ran. `f` gets a version for the newer line in the same way. The ledger records which version really ran.
4. **A condition on order**, such as `when: ran f before c`, lets a repair snippet treat the two histories differently. **[open]**

Recommended process: write a hotfix on the newest line first and port it back. The author then sees `c`. This does not remove the case.

## Changing released snippets

- At run time, a part that already ran is always skipped, whatever its current text says. There is no switch for this. **[decided]**
- The ledger keeps the checksum of the version that really ran, so a repair snippet can target it. **[direction]**
- Checksums are computed from the parsed operation, not from the file text. Formatting never changes a checksum. **[direction]**
- **Build guard against accidental edits:** every part of a released snippet must match its hash in at least one release file. Otherwise the build fails and names the part. **[decided]**
- **Intentional change:** the author adds `changed: <reason>` to the snippet. The next release records the new hashes, stores the reason and removes the marker, so the guard is active again. **[decided]**
- **Repair snippets** run only where a condition holds, for example where a specific faulty version ran. **[decided]**
- **Repairs that need downtime** must be possible, because a compatibility break will one day go undetected. **[decided]** A snippet can be marked `requires-downtime`. **[direction]**
- **Retired snippets** are never executed again, but stay in the sources because ledgers refer to them. **[direction]**

## Release files

Each release writes one new file. Two branches that release the same cherry-picked snippet create two different files, so no merge conflict arises and no merge driver is needed. **[decided]**

```yaml
# releases/4.2.0.yaml, written by `mig release 4.2.0`
release: 4.2.0
date: 2027-03-15
based-on: [4.1.3]
snippets:
  01JD3K7M2Q8R5T1V4X6Z9B0C3F: { column: 3c9e10, backfill: a44b07, default: 0d51fe, not-null: 77a0b4 }
changed:
  01JCQ9A0PX3H7K2M8N4R6T1V5W:
    parts: { add-column: 9f3e21, backfill: c41d07, not-null: 77a0b4 }
    reason: backfill overwrote existing statuses; repaired by 20270115-1200-repair-orders-status
```

- A release file lists only snippets that are new or changed. **[decided]**
- A snippet is listed when its current part hashes are not already recorded identically in a release file present in the tree. **[direction]**
- `based-on` names the releases this one builds on. The full content of a release is its own entries plus those of everything it builds on. **[direction]**
- When a release builds on two releases that disagree about a snippet, the snippet is always written into the new file. **[direction]**
- A snippet listed in no release file is unreleased and can be edited freely. **[direction]**

## Archiving

A command moves old snippets into a backup directory and moves the starting schema forward. **[decided]** It also sets `upgrade-from` in the project file to the new starting release, because older releases can no longer be upgraded directly. **[direction]** The archived identities stay in an index, and an installation that has not reached the new starting point is told which release to install first. **[direction]**
