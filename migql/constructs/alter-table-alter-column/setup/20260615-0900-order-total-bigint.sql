-- The script drops a view that stands in the way of a type change. Here the view is removed before.
drop view v_order_totals;
alter table customer add column loyalty_level varchar(10);
