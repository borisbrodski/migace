-- 20260401-0830-orders-customer-index

-- part: index
create index concurrently ix_orders_customer on orders (customer_id, created_at);

-- part: unique-mail
create unique index ux_customer_mail on customer (mail);
