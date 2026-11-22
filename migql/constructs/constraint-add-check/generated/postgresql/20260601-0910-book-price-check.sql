-- 20260601-0910-book-price-check

-- part: price-not-negative
-- step 1 of 2
alter table book add constraint ck_book_price check (price_cents >= 0) not valid;
-- step 2 of 2
alter table book validate constraint ck_book_price;
