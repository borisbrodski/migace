---
layout: ../../layouts/Doc.astro
title: Actions
description: Actions are schema changes for which MIG-Ace chooses the statements - a column that becomes mandatory without a long lock, a rename, a foreign key.
lead: A statement under do runs exactly as you wrote it. An action says what you want and lets MIG-Ace choose the statements that get there safely.
---

## `do` or an action?

Some schema changes are one statement in SQL but should not be run as one statement on a table that is in use. Making a column mandatory is the usual example: PostgreSQL locks the table and reads every row before it lets anybody in again.

MIG-Ace never rewrites a statement behind your back. You choose:

| You write | What runs |
|---|---|
| `do: alter table customer alter column loyalty_level set not null` | This one statement, as written |
| `column-set-not-null: { table: customer, column: loyalty_level }` | Four statements that reach the same result while the table stays in use |

An action stands in a part in the place of `do`. Its parameters are YAML keys, so the editor can list and explain them. A short action fits on one line:

```yaml
parts:
  - make-mandatory:
      column-set-not-null: { table: customer, column: loyalty_level }
```

A longer one is written with one parameter per line:

```yaml
parts:
  - price-not-negative:
      constraint-add-check:
        name: ck_book_price
        table: book
        check: price_cents >= 0
```

If you write a statement under `do` for which an action exists, the editor shows a warning and offers to turn it into the action. There is no warning for a table that the same snippet creates, and none in a snippet that says `requires-downtime`.

## The actions

The name of an action starts with what it changes. Type `col` in the editor and you see every action for a column.

| Action | Result |
|---|---|
| [`column-ensure`](#column-ensure) | The column exists with at least the given type |
| [`column-rename`](#column-rename) | The column has a new name |
| [`column-set-not-null`](#column-set-not-null) | The column is mandatory |
| [`constraint-add-check`](#constraint-add-check) | The check constraint exists and is valid |
| [`constraint-add-foreign-key`](#constraint-add-foreign-key) | The foreign key exists and is valid |

### `column-ensure`

Sometimes a column may or may not exist already. Suppose a hotfix added `orders.note` as `varchar(100)` at one store, and the next release wants `varchar(500)` everywhere.

```yaml
  - note-column:
      column-ensure: { table: orders, column: note, type: varchar(500) }
```

| Parameter | Meaning |
|---|---|
| `table`, `column` | The column |
| `type` | The type the column must have |
| `default` | Optional. Used when the column is added |
| `not-null` | Optional. `true` makes the column mandatory when it is added |

The action decides in the database:

- The column is missing: it is added.
- The column is narrower: it is widened. This holds for a longer `varchar` or `char`, and for a `numeric` with more digits and the same number of decimals.
- The column already fits: nothing happens.
- Anything else, such as a shorter target: the part fails and shows the type the column has.

You do not write a condition for this. The action already says what you want.

### `column-rename`

```yaml
  - rename-mail:
      column-rename: { table: customer, from: mail, to: email }
```

In an upgrade that stops the application, this is a plain rename. In an upgrade with the phases `start` and `finish`, MIG-Ace keeps both names working until the old version is gone. See [Zero-downtime changes](/docs/zero-downtime/).

A change of case only, such as `key` to `Key`, is an ordinary rename.

### `column-set-not-null`

```yaml
  - make-mandatory:
      column-set-not-null: { table: customer, column: loyalty_level }
```

Every row must have a value before. Fill the rows in an earlier part.

In PostgreSQL the action runs four statements:

1. A check constraint that says the column is not null is added, without checking the rows that exist.
2. The constraint is checked against the existing rows. Everybody can still read and write.
3. `set not null`. PostgreSQL sees the checked constraint and does not read the table again.
4. The constraint is removed.

Only steps 1, 3 and 4 lock the table, each for a moment. If step 2 finds a row without a value, the run stops there; correct the rows and run again, and the run continues with step 2.

### `constraint-add-check`

```yaml
  - price-not-negative:
      constraint-add-check:
        name: ck_book_price
        table: book
        check: price_cents >= 0
```

Two statements: the constraint is added for new and changed rows, then the rows that exist are checked while everybody can still read and write. The condition is an expression, so this action is written with one parameter per line.

### `constraint-add-foreign-key`

```yaml
  - fk-book:
      constraint-add-foreign-key: { name: fk_review_book, table: review, columns: book_id, references: book }
```

| Parameter | Meaning |
|---|---|
| `name` | The name of the constraint |
| `table` | The table that gets the foreign key |
| `columns` | One column, or a list: `[book_id, currency]` |
| `references` | The table that is pointed to |
| `referenced-columns` | Optional. Without it, the primary key of that table |

Two statements, as for a check constraint.

## What you can rely on

- A part with `do` means the same in every version of MIG-Ace: the statement you wrote.
- An action always reaches the result it names. The statements it uses may get better in a newer version. The ledger stores the SQL that really ran on each database.
- A run that stops in the middle of an action continues at the statement that failed.
