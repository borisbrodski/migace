-- Tables, keys and sequences of the bookshop, as Hibernate writes them from the entity classes.

create sequence bookshop_seq start with 1 increment by 50;

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
