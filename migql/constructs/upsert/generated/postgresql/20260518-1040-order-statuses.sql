-- 20260518-1040-order-statuses

-- part: statuses
insert into order_status (id, code, label) values
    (1, 'OPEN', 'Open'),
    (2, 'PAID', 'Paid'),
    (3, 'SHIPPED', 'Shipped')
on conflict (code) do update set id = excluded.id, label = excluded.label;
