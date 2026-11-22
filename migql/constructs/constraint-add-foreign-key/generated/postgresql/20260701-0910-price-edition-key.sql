-- 20260701-0910-price-edition-key

-- part: fk-edition
-- step 1 of 2
alter table book_price add constraint "FK Price Edition" foreign key (book_id, currency) references book_edition (book_id, currency) not valid;
-- step 2 of 2
alter table book_price validate constraint "FK Price Edition";
