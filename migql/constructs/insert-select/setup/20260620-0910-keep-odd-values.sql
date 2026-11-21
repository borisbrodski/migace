create table order_status_legacy (order_id bigint not null, old_status varchar(20));
create table order_status (
  id    bigint      not null,
  code  varchar(20) not null,
  label varchar(50) not null,
  primary key (id),
  constraint uq_order_status_code unique (code)
);
alter table orders add column status_id bigint;
create table book_copy (id bigint not null, title varchar(200) not null);
