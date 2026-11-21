-- 20260520-0900-price-history

-- part: create-table
create table price_history (
    id BIGINT not null primary key,
    book_id bigint not null,
    price_cents numeric(12, 2) not null default 0,
    valid_from date not null,
    constraint fk_price_history_book foreign key (book_id) references book (id),
    constraint ck_price_history_price check (price_cents >= 0)
);
