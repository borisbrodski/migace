---
type: architecture
status: mixed
---

# Snippets: files, structure, test data

The language inside a snippet is described in the [language notes](../migql/overview.md).

## Files and identity

- A snippet is one file `migrations/<name>.migql.yaml`. **[decided]**
- Every snippet file is valid YAML. Without MIG-Ace tooling, any YAML editor with the published `schema.json` gives basic editing support. **[decided]**
- `uid` is the identity of a snippet. It is generated once and never changes. The ledger is keyed by it. **[direction]**
- The name (`YYYYMMDD-HHMM-slug`) defines the position. Renaming a snippet reorders it. Installations that already ran it match by `uid`. **[direction]**
- Part names are the identity of parts inside a snippet. **[decided]**
- An optional LLM configuration names generated snippets and their parts and decides how many snippets a change becomes. It runs at build time only, never writes statements, never renames existing snippets or parts, and has a deterministic fallback. **[decided]**

## Structure

Top-level keys:

| Key | Meaning | Status |
|---|---|---|
| `migration` or `repair` | snippet name; `repair` marks a repair snippet | direction |
| `uid` | identity | direction |
| `doc` | description | direction |
| `when` | condition for the whole snippet | direction |
| `let` | named conditions | direction |
| `parts` | ordered list of parts | decided |
| `testdata`, `testdata-before` | test data inserted after or before the snippet | decided |
| `changed` | reason for an intentional change to a released snippet | decided |
| `retired`, `requires-downtime`, `former-names`, `before`, `after` | mishap and ordering controls | direction |

### The `upsert` operation

`upsert` inserts rows that are missing and updates rows that exist, found by a key. A part with `upsert` can therefore run on a database that already has some of the rows. **[decided]**

```yaml
parts:
  - statuses:
      upsert:
        into: order_status
        key: code
        rows:
          - { code: 'OPEN', label: 'Open' }
          - { code: 'PAID', label: 'Paid' }
```

- `key` is one column, or a list of columns: `key: [book_id, currency]`. **[decided]**
- Every row gives a value for every key column.
- Columns that are not the key are updated when the row exists.

Each part is a list entry whose key is the part name. It holds exactly one operation and optional sibling keys.

| Operation key | Meaning | Status |
|---|---|---|
| `do` | one statement in the neutral statement language | direction (key name open) |
| `insert` | insert in YAML form | decided |
| `upsert` | idempotent insert of rows by key | direction |
| `native` | dialect-specific SQL, one entry per dialect | direction |
| `stop` | end the run with instructions for a case the tool cannot repair | direction |

| Sibling key | Meaning | Status |
|---|---|---|
| `when` | skip the part if false | direction |
| `verify-before` | fail before execution if false | decided |
| `verify-after` | fail after execution if false | decided |
| `batch` | run a data statement in batches | direction |
| `expect-rows` | allowed range of affected rows | direction |
| `phase` | `finish` for a part that breaks older application versions, see [Upgrade phases](upgrade-phases.md) | decided |
| `todo` | an open decision left by snippet generation; the build fails while one is present | decided |

## Test data

- Nothing is inserted without a `testdata` entry. Authors provide meaningful values. **[decided]**
- Two modes per row: `fill: all` (every column has a value) and `fill: required` (only mandatory columns). **[decided]**
- Inside an explicit entry, columns the author did not specify are generated. **[decided]**
- A shortcut picks some valid referenced row, replacing `(select max(id) from …)`. **[decided]** Its spelling is open.
- **Coverage rule:** after a snippet, every affected table must have a row of each mode. **[decided]** Affected tables are those whose shape changed and those targeted by data statements. All tables are checked only when a native part changes data. **[direction]**

## Examples

```yaml
migration: 20270301-0900-orders-due-date
uid: 01JD5P…
doc: Add orders.due_date; fill from legacy_due where present, else compute

parts:
  - add-column:
      do: alter table orders add column due_date date

  - from-legacy:
      when: column orders.legacy_due exists
      do: |
        update orders set due_date = legacy_due
        where due_date is null and legacy_due is not null
      batch: 20000 by id

  - computed:
      do: |
        update orders
        set due_date = created_at + days(coalesce(payment_terms, 30))
        where due_date is null
          and (state = 'open' or (state = 'partial' and paid_amount < total))
      batch: 20000 by id
      verify-after:
        - none: orders.due_date is null and orders.state in ('open', 'partial')

  - index:
      do: create index concurrently ix_ord_due_date on orders (due_date)

  - drop-legacy:
      do: alter table orders drop column legacy_due

testdata-before:
  - table: orders
    fill: all
    row: { state: 'open' }
  - table: orders
    fill: required
```

Insert in both forms. They parse to the same operation.

```yaml
parts:
  - new-konto-sql:
      do: |
        insert into orders (id, a, b, status_id)
        values (next value for hibernate_sequence, 1, 2,
                (select max(id) from order_status))

  - new-konto-yaml:
      insert:
        into: orders
        values:
          id:        next value for hibernate_sequence
          a:         1
          b:         2
          status_id: (select max(id) from order_status)
```

A repair snippet:

```yaml
repair: 20270115-1200-repair-orders-status
uid: 01JD4M…
when: buggy

let:
  buggy_410: ran orders-status.backfill sha256:ab12…
  buggy_411: ran orders-status.backfill sha256:9f3e…
  buggy:     buggy_410 or buggy_411
  audited:   exists (select 1 from order_audit where field = 'status')

parts:
  - restore-from-audit:
      when: audited
      native:
        postgresql: |
          update orders o set status = a.old_value
          from order_audit a where a.order_id = o.id and a.field = 'status'

  - no-audit-data:
      when: not audited
      stop: |
        No audit rows. Restore orders.status from backup,
        then mark this snippet as done.
```
