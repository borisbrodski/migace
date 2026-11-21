create view v_order_totals as
  select o.customer_id, count(*) as orders, sum(o.total_cents) as total_cents
  from orders o
  group by o.customer_id;
