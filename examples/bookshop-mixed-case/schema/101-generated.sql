-- Tables, keys and sequences of the bookshop, as Hibernate writes them when it quotes every name.

create sequence "BookshopSeq" start with 1 increment by 50;

create table "Customer" (
  "Id"        bigint        not null,
  "Name"      varchar(100)  not null,
  "Email"     varchar(255),
  "CreatedAt" timestamp     not null,
  primary key ("Id")
);

create table "Book" (
  "Id"         bigint        not null,
  "Title"      varchar(200)  not null,
  "title"      varchar(200),
  "Author"     varchar(200)  not null,
  "PriceCents" integer       not null,
  "Stock"      integer       not null,
  primary key ("Id")
);

create table "Order" (
  "Id"         bigint        not null,
  "CustomerId" bigint        not null references "Customer",
  "Status"     varchar(20)   not null,
  "CreatedAt"  timestamp     not null,
  "TotalCents" integer       not null,
  primary key ("Id")
);

create table "OrderItem" (
  "Id"         bigint        not null,
  "OrderId"    bigint        not null references "Order",
  "BookId"     bigint        not null references "Book",
  "Quantity"   integer       not null,
  "PriceCents" integer       not null,
  primary key ("Id")
);
