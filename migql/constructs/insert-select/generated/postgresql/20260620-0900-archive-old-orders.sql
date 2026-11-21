-- 20260620-0900-archive-old-orders

-- part: archive-old-orders
insert into orders_archive (id, customer_id, created_at, total_cents) select o.id, o.customer_id, o.created_at, o.total_cents from orders o where o.created_at < date '2020-01-01';
