---
type: architecture
status: mixed
---

# Upgrades without downtime: compatibility and phases

## Compatibility floor

- High availability is a requirement. **[decided]**
- The project defines the oldest application version that must keep working while an upgrade is in progress (`compatible-with`). The build detects changes that break such a version. **[decided]**
- The ledger records which application versions are supported in the current state. An application outside that set does not start. **[direction]**

## Two phases

During a rolling upgrade, old and new application versions run at the same time. Some changes are safe then, and some are not.

| Phase | Parts | Examples |
|---|---|---|
| `start` | Safe while older versions still run | add a table, add a nullable column, create a sync trigger, copy values |
| `finish` | Break older versions | drop a column, set `not null`, tighten a constraint, remove a sync trigger |

- A part is in phase `start` unless it is marked `phase: finish`. **[decided]**
- There is one migration script. The runner chooses the phase: `start`, `finish` or `all`. **[direction]**
- Without a phase the script does everything: start parts and finish parts. This is `all`. **[decided]**
- `start` and `finish` are given explicitly, for a rolling upgrade. An application that runs the script at its own start during a rolling upgrade must pass `start`. **[decided]**
- `start` never runs a finish part. Only `finish` declares that older versions are gone. **[decided]**
- There is no registry of running application instances, because the application has no way to sign off. **[decided]**
- A part that fails is retried on the next run. Nothing after the failed part runs. **[decided]**
- `finish` runs all pending finish parts, never a selection. It refuses while a start part is pending or failed. **[direction]**
- A failed `finish` must be completed before the next `start`. **[direction]**
- `all` is `finish` for what is pending, followed by the remaining snippets in order. **[direction]**

```text
migace-runner ...                 # everything, for an upgrade with the application stopped
migace-runner --phase start  ...   # rolling upgrade: before or while new instances roll out
migace-runner --phase finish ...   # rolling upgrade: when no old instance is left
```

## Who assigns the phase

- The zero-downtime check finds parts that break an older version. Such a part must be in phase `finish`. The build says so, and `mig make` writes the marker itself. **[direction]**
- Typed operations carry their phases. `rename column customer.mail to email` is one statement in one snippet. The compiler generates start steps (add `email`, create the sync trigger, copy values) and finish steps (drop the trigger, drop `mail`). This replaces an expand snippet in one release and a contract snippet in the next. **[direction]**

## State of a database

The state of a database is a pair: the release up to which start parts are applied, and the release up to which finish parts are applied.

```text
              started up to (L)
finished (K)    1       2       3       4
     1        (1,1) → (2,1) → (3,1) → (4,1)
     2                (2,2) → (3,2) → (4,2)
     3                        (3,3) → (4,3)
     4                                (4,4)
```

`start` moves right along a row. `finish` drops from anywhere in a column to the diagonal. With release lines, both values are releases in the graph that `based-on` describes.

Whether `start` refuses when the last finished release is older than `compatible-with` is **[open]**. With the limit, a customer with an old unfinished upgrade must run `finish` first. Without it, every supported release needs its own deferred test chain.

## What is proven

See [Upgrade-path simulation](../testing/upgrade-path-simulation.md). In short: after `start` the schema works for every supported older version and for the new one; after `finish` it equals the desired schema.

## Rollback

Until `finish` runs, the older application version can be started again, because the database is proven to work with it. **[direction]** There are no down migrations.

## Lock safety

PostgreSQL DDL takes table locks, and a waiting DDL statement blocks later queries. The compiler therefore uses lock timeouts with retries and the safe multi-step forms, for example for `set not null`. A lint rule flags statements that rewrite a table. **[direction]**
