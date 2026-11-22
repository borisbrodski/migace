create view "V_OrderTotals" as
  select o."CustomerId", count(*) as "Orders", sum(o."TotalCents") as "TotalCents"
  from "Order" o
  group by o."CustomerId";
