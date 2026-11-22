-- 20260601-0920-stock-check

-- part: stock-known
-- step 1 of 2
alter table book add constraint ck_book_stock check (true) not valid;
-- step 2 of 2
alter table book validate constraint ck_book_stock;

-- part: title-or-author
-- step 1 of 2
alter table book add constraint "CK Book Title" check (length(trim(title)) > 0 or author is not null) not valid;
-- step 2 of 2
alter table book validate constraint "CK Book Title";
