---
layout: ../../layouts/Doc.astro
title: Generated snippets
description: How mig make writes snippets for you from the difference between the expected schema and your migrations.
lead: For most changes you do not write the migration. You change an entity class, run one command, and MIG-Ace writes the snippet.
---

## One command

```text
$ mig make
```

`mig make` runs the same comparison as the [proof loop](/docs/proof-loop/). It builds the schema your application expects, migrates an older release with your existing snippets, and compares the two. Then it writes snippets for every difference.

Because the expected schema comes from a real PostgreSQL database, `mig make` sees everything: the tables Hibernate generates from your entities and the indexes, constraints and views you wrote by hand in the [schema folder](/docs/desired-schema/).

## What is generated

| You changed | MIG-Ace writes |
|---|---|
| A new entity | `create table`, its keys, foreign keys and indexes |
| A new optional field | `alter table … add column` |
| A new mandatory field | Add the column, fill existing rows, then make it mandatory |
| A longer `length` | A statement that widens the column |
| `nullable = false` on an existing field | Fill empty rows, then `set not null` |
| A new `@ManyToOne` | The column, the foreign key and an index |
| A new index or constraint in the schema folder | `create index` or `add constraint`, with its name |
| A removed field | `alter table … drop column` |

Every generated constraint and index gets a name, so later snippets can refer to it.

## It asks what it cannot know

Some changes need a decision. `mig make` asks in the terminal.

**A new mandatory column.** MIG-Ace always assumes that the table has rows, because production data is not visible at build time:

```text
$ mig make

  + column customer.loyalty_level varchar(10), mandatory

The new column is mandatory. Rows that already exist need a value.
Which value should they get? (an expression, or empty to decide later)
> 'BRONZE'
```

**A column that may have been renamed:**

```text
  - column customer.mail  varchar(255)
  + column customer.email varchar(255)

Is this a rename of customer.mail to customer.email? [y/N]
> y
```

Without the question, a rename would look like "drop one column and add another", and the e-mail addresses would be lost.

## When nobody can answer: TODO

In a script, in CI, or with `--batch`, there is no one to ask. MIG-Ace then writes the snippet with a `todo` and tells you.

```text
$ mig make --batch

Wrote migrations/20260302-0900-customer-loyalty.migql.yaml
  ! 1 TODO: part "fill-existing" needs a value for existing rows.
    The migration script cannot be built until every TODO is resolved.
```

```yaml
  - fill-existing:
      todo: Choose a value for existing customers
      do: update customer set loyalty_level = ?
```

A `todo` can never reach production by accident. `mig test` and `mig compile` both fail while one is left:

```text
$ mig compile
✗ 20260302-0900-customer-loyalty, part fill-existing
  TODO: Choose a value for existing customers
No migration script was written.
```

Replace the `?`, delete the `todo` line, and the build passes.

## One snippet or several

A single change to your entities can touch several tables. Without further settings, MIG-Ace writes one snippet per table and tells you about the alternative:

```text
$ mig make

Wrote 2 snippets, one per table:
  migrations/20260518-1000-order-status.migql.yaml
  migrations/20260518-1001-orders.migql.yaml

Tip: "mig make --single-snippet" writes all changes into one snippet.
```

You can also give the name yourself. Then everything goes into that one snippet:

```text
$ mig make order-status
```

## Let an LLM do the naming

Grouping changes and finding good names is a task for a language model. If you configure one, `mig make` uses it for three things:

- It decides how many snippets a change deserves.
- It names each snippet.
- It names the parts and writes the `doc` line.

```text
$ mig make

Wrote 1 snippet:
  migrations/20260518-1000-order-status.migql.yaml
  "The order status moves from free text into the table order_status"
```

Compare the part names. Without an LLM:

```yaml
  - orders-add-column-status-id:
  - orders-add-constraint-fk-orders-status:
```

With an LLM:

```yaml
  - add-status-id:
  - status-fk:
```

The LLM never writes a statement. The statements come from the comparison, so they are the same with and without it.

```yaml
# migace.yaml
llm:
  endpoint: https://llm.example.internal/v1   # any OpenAI-compatible endpoint
  model: your-model
```

The key does not belong into the project file. Each developer sets it in the user file or in the variable `MIGACE_LLM_API_KEY`. See [Configuration](/docs/configuration/).

- **Your endpoint.** You can use a model your company hosts.
- **Only names of tables and columns are sent.** No rows, no data.
- **Optional.** Without the setting, MIG-Ace uses plain names and one snippet per table.
- **Names are chosen once.** After a snippet is written, nothing renames it.

## A generated snippet is a draft

`mig make` gives you the structure. You add what only you know:

- [Data parts](/docs/data-migrations/) that go beyond a single value, such as converting old values.
- [Test data](/docs/test-data/) for new tables and columns.
- [Conditions](/docs/conditions/), in the rare cases where they are needed.

Then `mig test` proves the result. A generated snippet goes through exactly the same proof as a hand-written one.

## When there is nothing to generate

For a change that touches only data, there is no difference in the schema. Create an empty snippet and write the parts yourself:

```text
$ mig make fix-order-totals --empty
```
