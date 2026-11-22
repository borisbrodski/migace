---
type: language
status: mixed
---

# Actions

An **action** is an operation for which MIG-Ace chooses the statements. It has a key of its own in a part, in the place of `do`. **[decided]**, see [the decision](../decisions/do-is-literal-actions-have-names.md).

```yaml
parts:
  - make-mandatory:
      column-set-not-null: customer.loyalty_level
```

The same part with `do: alter table customer alter column loyalty_level set not null` runs exactly this one statement.

## Names

The names are the index of a catalogue. **[decided]** The scheme below is a proposal. **[open]** (question 44)

- A name starts with the object and then says what happens: `column-…`, `constraint-…`, `index-…`. In a sorted list all actions for a column stand together, and typing `col` shows them.
- The second half uses the word that an author would search for. Someone who knows SQL searches for `not-null`, not for `mandatory`.
- A name never says how the action works. `column-set-not-null`, not `column-set-not-null-in-four-steps`. How it works may change.

## First catalogue

**[open]**: every name and every form of a value in this table (question 44).

| Key (proposal) | Result | What MIG-Ace chooses | Today |
|---|---|---|---|
| `column-set-not-null` | The column is mandatory | PostgreSQL: a check constraint that is not yet valid, its validation under a weak lock, `set not null`, removal of the constraint | four steps under `do` |
| `constraint-add-foreign-key` | The foreign key exists and is valid | PostgreSQL: added as not valid, then validated under a weak lock | two steps under `do` |
| `constraint-add-check` | The check constraint exists and is valid | as for the foreign key | plain under `do` |
| `column-rename` | The column has the new name | Without a phase: a plain rename. With `start` and `finish`: a second column and a trigger that keeps both the same, then the removal of the old column | the statement `rename column` under `do` |
| `column-ensure` | The column exists with at least this type | Adds it if it is missing, widens it if it is narrower, does nothing if it fits, fails otherwise | the statement `ensure column` under `do` |

Candidates for later: a change of a column type through a new column, a unique constraint through an index that is built `concurrently`, an index that repairs an invalid earlier attempt, the removal of a column over two phases.

## The warning under `do`

A `do` whose statement has an action gets a warning that names the action, with a quick fix. **[decided]** Details: **[direction]**

- No warning for a table that is created in the same snippet. It has no rows that could be locked for long.
- No warning in a snippet that says `requires-downtime`. The author has said that nobody uses the database.
- The warning never stops a build. The zero-downtime check reports the same places as errors.

## Descriptions

Every action has one description, written once. **[direction]**

- It lives in `construct.md` of the action's folder in the [catalogue](generation.md).
- The editor shows it on hover and in the list of completion. The YAML schema carries it as the description of the key. The website shows it in the reference.
- It says: the result, the statements per database, the locks they take, what happens after a failure in each step.

## Open

- The form of a value. A short line in the statement language, as in `column-rename: customer.email to email_address`, or keys of their own, as `upsert` has them.
- Whether `insert` and `upsert` are actions in this sense and get names of the same scheme.
- Whether an action may have a different number of steps in a newer MIG-Ace for a part that is half done in the ledger. The step that failed must still be found.
