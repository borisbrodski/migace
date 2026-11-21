-- 20260309-1410-review-foreign-keys

-- part: fk-book
alter table review add constraint fk_review_book foreign key (book_id) references book;

-- part: fk-customer
alter table review add constraint fk_review_customer foreign key (customer_id) references customer (id);
