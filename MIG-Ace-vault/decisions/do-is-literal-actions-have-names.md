---
type: decision
status: decided
date: 2026-11-22
---

# `do` runs what was written; smart actions have their own keys

## Context

The first generator turned some statements into several steps. `do: alter table customer alter column loyalty_level set not null` became four statements in PostgreSQL, so that no statement holds a strong lock while the table is read. The idea is good, but an author who writes a statement expects that statement to run.

## Decision

1. **`do` is literal.** MIG-Ace runs the statement that was written, as its direct translation for the database. It adds no helper objects and no further statements.
2. **Every smart action has a key of its own in the YAML part**, in the place of `do`. A smart action is an operation for which MIG-Ace chooses the statements: several steps, another form for `start` and `finish`, or a decision at run time.
3. **A `do` with a statement for which an action exists gets a warning** that names the action.
4. **The actions are a catalogue.** Their names are chosen so that completion in the editor lists them in a useful order, and every action has a full description that the editor shows on hover and that the YAML schema carries.

The actions, their names and the open points are in [Actions](../migql/actions.md).

## Consequences

- In PostgreSQL a `do` part has one step. Steps come from actions.
- The meaning of a `do` part never changes with a newer MIG-Ace. An action keeps its result; its steps may get better. The ledger stores the SQL that really ran.
- `mig make` writes actions, because it always assumes that a table has rows.
- The generator of M3 changes: `set not null` and `add constraint … foreign key` in `do` become one plain statement each. `rename column` and `ensure column` move from `do` to actions.

## Rejected alternatives

- **Keep the smart forms inside `do`:** the author does not see what will run, and cannot ask for the plain statement.
- **One key for all smart forms, with the same statement as under `do`** (for example `safely: alter table …`): a change of one word, but no catalogue. It cannot hold actions that are no single SQL statement, such as a rename over two phases.
