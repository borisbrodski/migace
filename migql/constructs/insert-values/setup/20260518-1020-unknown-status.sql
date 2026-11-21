create table order_status (
  id    bigint      not null,
  code  varchar(20) not null,
  label varchar(50) not null,
  primary key (id),
  constraint uq_order_status_code unique (code)
);
