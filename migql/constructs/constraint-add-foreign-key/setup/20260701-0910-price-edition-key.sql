create table book_edition (book_id bigint not null, currency varchar(3) not null, primary key (book_id, currency));
create table book_price (book_id bigint not null, currency varchar(3) not null, price_cents integer not null);
