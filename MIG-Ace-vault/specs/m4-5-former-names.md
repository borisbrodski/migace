---
type: spec
status: ready
milestone: M4.5
---

# M4.5 Former names

## Goal

A part and a snippet can get another name without running again and without breaking the conditions that name them. The key is `former-names`. A database that meets a part it cannot place stops before it does harm.

## Non-goals

- The same check at build time against the release files. They do not exist yet.
- Recognising a renamed part by its checksum alone. The author states the former name.

## Builds on

- [Answers after the script, the real server and the Java runner](../decisions/answers-after-m4-3.md), the part "Added on 2026-11-27"
- [Snippets](../architecture/snippets.md)
- [Execution and ledger](../architecture/execution-and-ledger.md)
- M4.4, above all `retired` on a part and the rule that `ran` names a part
- [Coding rules](../engineering/coding-rules.md)

## Order of work

1. The key in the language, with its checks.
2. Conditions that name a former name.
3. The ledger at run time.
4. The stop for a part that cannot be placed.

## Acceptance criteria

### The key

- **M4.5-AC-01** A part takes `former-names` with one name or a list: `former-names: link-staus`, `former-names: [link-staus, link]`. A snippet takes the same key for its earlier slugs, the names without date and time.
- **M4.5-AC-02** These are errors, each with a message that names both places: a former name that is the name of another part of the same snippet; a former name that two parts of one snippet claim; a former slug that is the slug or a former slug of another snippet; a former name equal to the present name.
- **M4.5-AC-03** `former-names` and `retired` do not count for the checksum of a part, and neither does the name of the part. Together with M4.4-AC-21 to 23: a property test adds, removes and changes these keys and the name, and the checksum stays the same. Together with the committed list of checksums: no line of it changes.
- **M4.5-AC-04** The YAML schema, the hover text and completion know the key in both places.

### Conditions

- **M4.5-AC-05** A condition `ran <slug>.<part>` finds its part by the present names and by the former names, for the slug and for the part. Four cases have a test: both present, former slug, former part, both former.
- **M4.5-AC-06** A condition that names a former name is no error and no warning. A released snippet that names the old name is not edited.
- **M4.5-AC-07** Together with M4.4-AC-24: the rule that a condition cannot name a later part holds for a part that is found by a former name as well.

### The ledger

- **M4.5-AC-08** A part whose ledger rows are stored under a former name counts as that part. A part that ran under its old name is done and does not run again. Test: a run with the old name, then a run of the script with the new name and `former-names`; no statement of the part is sent.
- **M4.5-AC-09** The first run that meets such rows writes one line into the log: the old name, the new name. The rows of earlier tries keep the name they were written with.
- **M4.5-AC-10** A condition `ran` is true for a part that ran under a former name.
- **M4.5-AC-11** A part that failed under its old name continues under its new name at the step that failed.
- **M4.5-AC-12** A snippet that was renamed is found by its `uid`, as before. Its former slugs matter only for conditions.

### A part that cannot be placed

- **M4.5-AC-13** A run finds, for a snippet, a ledger row of a part that ran and that the script does not know: not as a name, not as a former name. If the same snippet has a part that did not run, the run stops before the first part of that snippet. The message names the snippet, the unknown part and the parts that did not run, and proposes `former-names`.
- **M4.5-AC-14** The stop is a failure of the run like any other: it is recorded, nothing after it runs, and the next run decides again. After the author added `former-names`, the next run goes on.
- **M4.5-AC-15** If the snippet has no part that did not run, the unknown row is only reported in a notice. A part that was removed from a snippet stops nothing.
- **M4.5-AC-16** Together with a renamed part that was also changed: the checksum differs, `former-names` is given, the part does not run again, and the run reports the changed checksum as for any changed part.

### Examples

- **M4.5-AC-17** The catalogue has valid and invalid examples for the key. The entry for `former-names` is removed from the list of website examples that are not built yet, and those examples parse.

## Open points

- Whether a former name may be used again for a new part of the same snippet after some time. This spec says no.
