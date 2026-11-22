---
type: language
status: mixed
---

# Actions

An **action** is an operation for which MIG-Ace chooses the statements. It has a key of its own in a part, in the place of `do`. **[decided]**, see [the decision](../decisions/do-is-literal-actions-have-names.md).

```yaml
parts:
  - make-mandatory:
      column-set-not-null: { table: customer, column: loyalty_level }
```

The same part with `do: alter table customer alter column loyalty_level set not null` runs exactly this one statement.

## Names

The names are the index of a catalogue. **[decided]**

- A name starts with the object and then says what happens: `column-…`, `constraint-…`, `index-…`. In a sorted list all actions for a column stand together, and typing `col` shows them.
- The second half uses the word that an author would search for. Someone who knows SQL searches for `not-null`, not for `mandatory`.
- A name never says how the action works. `column-set-not-null`, not `column-set-not-null-in-four-steps`. How it works may change.
- `insert` and `upsert` keep their names.

## Parameters

The parameters of an action are YAML keys, not a line of the statement language. **[decided]** The YAML schema can then describe every parameter, and an editor without the MigQL language server still offers them.

- An action is written in one line with `{ … }`, or as a block with one parameter per line.
- The [YAML profile](yaml-profile.md) holds: a flow map takes only literals and names. A parameter with a list of several names, an expression, or a type with a comma such as `numeric(10,2)` is written in the block form.
- A parameter that takes columns takes one name, or a list: `columns: book_id`, `columns: [book_id, currency]`. This is the rule of `key` in `upsert`.
- `table` is always the table that is changed. The same parameter has the same name in every action.

## First catalogue

The actions and their names: **[decided]**. Their parameters: **[direction]**.

| Action | Parameters | Result | What MIG-Ace chooses in PostgreSQL |
|---|---|---|---|
| `column-set-not-null` | `table`, `column` | The column is mandatory | A check constraint that is not yet valid, its validation under a weak lock, `set not null`, removal of the constraint: four steps |
| `constraint-add-foreign-key` | `name`, `table`, `columns`, `references`; optional `referenced-columns` | The foreign key exists and is valid | Added as not valid, then validated under a weak lock: two steps |
| `constraint-add-check` | `name`, `table`, `check` | The check constraint exists and is valid | As for the foreign key: two steps |
| `column-rename` | `table`, `from`, `to` | The column has the new name | Without a phase: a plain rename. With `start` and `finish`: a second column and a trigger that keeps both the same, then the removal of the old column |
| `column-ensure` | `table`, `column`, `type`; optional `default`, `not-null` | The column exists with at least this type | Adds it if it is missing, widens it if it is narrower, does nothing if it fits, fails otherwise |

```yaml
parts:
  - fk-book:
      constraint-add-foreign-key: { name: fk_review_book, table: review, columns: book_id, references: book }

  - price-not-negative:
      constraint-add-check:
        name: ck_book_price
        table: book
        check: price_cents >= 0

  - rename-mail:
      column-rename: { table: customer, from: mail, to: email }

  - note-column:
      column-ensure: { table: orders, column: note, type: varchar(500) }
```

The two actions for constraints need a `name`: the second step has to name the constraint.

`column-ensure` widens in these cases: a longer `varchar` or `char`, and a `numeric` with a larger precision and the same scale. Any other difference in the details of a type is an error. **[decided]**

`column-rename` in a run without a phase is a plain rename. **[decided]** The form for `start` and `finish` is in [Upgrade phases](../architecture/upgrade-phases.md).

Candidates for later: a change of a column type through a new column, a unique constraint through an index that is built `concurrently`, an index that repairs an invalid earlier attempt, the removal of a column over two phases.

## What stays under `do`

`do` takes the statements of SQL and runs them as written. **[decided]**

- `alter table … alter column … set not null`, `alter table … add constraint …` and `alter table … rename column … to …` are plain statements.
- The statements `ensure column` and `rename column <table>.<old> to <new>` of the first implementation are no SQL. They are removed; the actions take their place.

## The warning under `do`

A `do` whose statement has an action gets a warning that names the action, with a quick fix. **[decided]** Details: **[direction]**

- The statements: `set not null`, `add constraint … foreign key`, `add constraint … check`, `rename column`.
- No warning for a table that is created in the same snippet. It has no rows that could be locked for long.
- No warning in a snippet that says `requires-downtime`. The author has said that nobody uses the database.
- The warning never stops a build. The zero-downtime check reports the same places as errors.

## Descriptions

Every action has one description, written once. **[direction]**

- It lives in `construct.md` of the action's folder in the [catalogue](generation.md). The folder has the name of the action.
- The editor shows it on hover and in the list of completion. The YAML schema carries it as the description of the key. The website shows it in the reference.
- It says: the result, every parameter, the statements per database, the locks they take, what happens after a failure in each step.

## Open

- Whether an action may have a different number of steps in a newer MIG-Ace for a part that is half done in the ledger. The step that failed must still be found.
- The names of further parameters of foreign keys, such as the rule for a deleted row.
