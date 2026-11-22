create function "RefreshOrderTotal"() returns trigger
language plpgsql as $$
begin
  update "Order" o
  set "TotalCents" = (select coalesce(sum(i."Quantity" * i."PriceCents"), 0)
                      from "OrderItem" i
                      where i."OrderId" = o."Id")
  where o."Id" = coalesce(new."OrderId", old."OrderId");
  return null;
end $$;

create trigger "TRG_OrderItem_Total"
  after insert or update or delete on "OrderItem"
  for each row execute function "RefreshOrderTotal"();
