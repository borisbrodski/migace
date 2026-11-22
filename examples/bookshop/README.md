# examples/bookshop

The running example as a real project: an online bookshop built with Jakarta EE and Hibernate. The end-to-end tests run on it, and the website takes its examples from it.

| Folder | Content |
|---|---|
| `schema/` | The schema of release 1.0.0 as the website shows it: tables, the sequence, an index, the trigram index, a view and a trigger function. |
| `migrations/` | The snippets of the releases after 1.0.0. |

## Differences to the website

The snippets are the ones the website shows. They differ where the tool does not support something yet. Each difference is put back when its feature exists.

| Snippet | Difference | Until |
|---|---|---|
| `order-status`, part `link-status` | no `batch: 20000 by id` | `batch` is built |
| `order-status`, part `default-unknown` | no `expect-rows: 0..1000` | `expect-rows` is built |
| `orders-ship-by`, part `fill-ship-by` | no `batch: 20000 by id` | `batch` is built |
| `repair-order-status` | `when: ran order-status.link-status`, without `from 1.2.0` | release files exist |
| `orders-customer-index` | written as `create index concurrently`, as `mig make` writes it | – |
| `book-price-check` | written with the action `constraint-add-check` | – |

## What the snippets need

The snippet `orders-customer-index` creates the index that `schema/102-indexes.sql` holds, and `book-title-search` creates what `schema/103-search.sql` holds. A database of release 1.0.0 that these snippets run on has neither. The tests build it from `101-generated.sql`, `110-views.sql` and `120-functions.sql`.

The files in `schema/` are release 1.0.0 with these two additions. They are not yet the schema after all snippets; that comes with the proof loop.
