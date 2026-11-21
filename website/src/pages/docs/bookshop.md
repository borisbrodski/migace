---
layout: ../../layouts/Doc.astro
title: The bookshop example
description: The small application that every example on this site uses.
lead: Every example on this site comes from one application, an online bookshop. This page introduces it once, so the other pages can stay short.
---

## The application

The bookshop is a Jakarta EE application with Hibernate and PostgreSQL. Customers browse books, place orders and, later, write reviews.

The software is installed at three independent book stores. Each store has its own database and decides for itself when to upgrade.

| Store | Upgrade habit |
|---|---|
| Riverside Books | Installs every release on the day it comes out. |
| Old Town Books | Waits a few weeks and usually takes the bug-fix release. |
| Harbour Books | Upgrades rarely and skips versions. Sometimes needs a hotfix. |

This is why migrations in the bookshop must work from any older release, not only from the previous one.

## The tables in release 1.0.0

```sql
create table customer (
  id          bigint        not null,
  name        varchar(100)  not null,
  mail        varchar(255),
  created_at  timestamp     not null,
  primary key (id)
);

create table book (
  id          bigint        not null,
  title       varchar(200)  not null,
  author      varchar(200)  not null,
  price_cents integer       not null,
  stock       integer       not null,
  primary key (id)
);

create table orders (
  id          bigint        not null,
  customer_id bigint        not null references customer,
  status      varchar(20)   not null,
  created_at  timestamp     not null,
  total_cents integer       not null,
  primary key (id)
);

create table order_item (
  id          bigint        not null,
  order_id    bigint        not null references orders,
  book_id     bigint        not null references book,
  quantity    integer       not null,
  price_cents integer       not null,
  primary key (id)
);
```

Hibernate takes new ids from the sequence `bookshop_seq`.

Two details will matter later:

- `orders.status` is free text. Over the years it has collected values such as `SHIPPED`, `shipped` and `Shipped `.
- The column for the e-mail address is called `mail`. The team would prefer `email`.

## The releases

| Release | Change | Shown on |
|---|---|---|
| 1.1.0 | Customers get a loyalty level. | [Getting started](/docs/getting-started/) |
| 1.1.0 | Customers can review books. A new table `review`. | [Snippets](/docs/snippets/), [Test data](/docs/test-data/) |
| 1.1.1 | Hotfix for Harbour Books: an index that makes the order list fast. | [Releases and branches](/docs/releases-and-branches/) |
| 1.2.0 | Order status moves from free text to a table `order_status`. | [Data migrations](/docs/data-migrations/), [Complete example](/docs/complete-example/) |
| 1.2.0 | Every order gets a ship-by date. | [Data migrations](/docs/data-migrations/) |
| 1.2.0 | Book prices can no longer be negative. | [Data migrations](/docs/data-migrations/) |
| 1.2.0 | Search books by a part of the title. | [Native SQL](/docs/native-sql/) |
| 1.2.1 | The status change in 1.2.0 had a bug. Fix and repair. | [Fixing mistakes](/docs/fixing-mistakes/) |
| 1.3.0 | `customer.mail` becomes `customer.email`, without stopping the shop. | [Zero-downtime changes](/docs/zero-downtime/) |
| 1.4.0 | The order total gets a bigger number type. | [Views, functions and triggers](/docs/views-functions-triggers/) |

## Who is on which release

The examples about releases and repairs use this situation:

| Store | Installed | Next upgrade |
|---|---|---|
| Riverside Books | 1.2.0, including the bug | 1.2.1 |
| Old Town Books | 1.1.0 | 1.2.1, skipping 1.2.0 |
| Harbour Books | 1.1.1 with the hotfix | 1.3.0, skipping 1.2.x |

MIG-Ace proves the migration for each of these paths.
