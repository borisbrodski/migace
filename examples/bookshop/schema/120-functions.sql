create function refresh_order_total() returns trigger
language plpgsql as $$
begin
  update orders o
  set total_cents = (select coalesce(sum(i.quantity * i.price_cents), 0)
                     from order_item i
                     where i.order_id = o.id)
  where o.id = coalesce(new.order_id, old.order_id);
  return null;
end $$;

create trigger trg_order_item_total
  after insert or update or delete on order_item
  for each row execute function refresh_order_total();
