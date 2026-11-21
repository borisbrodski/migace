-- 20260701-0900-book-prices

-- part: euro-prices
insert into book_price (book_id, currency, price_cents) values
    (1, 'EUR', 990),
    (2, 'EUR', 1490)
on conflict (book_id, currency) do update set price_cents = excluded.price_cents;

-- part: one-status
insert into order_status (code, label) values ('UNKNOWN', 'It''s unknown')
on conflict (code) do update set label = excluded.label;
