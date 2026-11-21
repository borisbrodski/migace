-- 20260518-1010-link-status

-- part: link-status
update orders o set status_id = (select s.id from order_status s where s.code = upper(trim(o.status))) where o.status_id is null;

-- part: two-columns
update book set stock = 0, price_cents = price_cents * 2 where stock < 0;
