-- 20260309-1410-review-foreign-keys

-- part: fk-book
-- step 1 of 2
alter table review add constraint fk_review_book foreign key (book_id) references book not valid;
-- step 2 of 2
alter table review validate constraint fk_review_book;

-- part: fk-customer
-- step 1 of 2
alter table review add constraint fk_review_customer foreign key (customer_id) references customer (id) not valid;
-- step 2 of 2
alter table review validate constraint fk_review_customer;
