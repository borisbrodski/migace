-- 20260601-0900-book-price-check

-- part: price-not-negative
alter table book add constraint ck_book_price check (price_cents >= 0);

-- part: unique-code
alter table order_status add constraint uq_order_status_label unique (label);
