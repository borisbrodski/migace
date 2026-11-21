create table review (
  id          bigint         not null,
  book_id     bigint         not null,
  customer_id bigint         not null,
  stars       integer        not null,
  review_text varchar(2000),
  created_at  timestamp      not null,
  primary key (id)
);
create table order_status_legacy (order_id bigint not null, old_status varchar(20));
