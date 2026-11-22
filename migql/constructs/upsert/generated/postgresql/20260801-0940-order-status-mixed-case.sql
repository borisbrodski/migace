-- 20260801-0940-order-status-mixed-case

-- part: statuses
insert into "Order Status" ("Code", "Display Label") values
    ('OPEN', 'Open'),
    ('PAID', 'Paid')
on conflict ("Code") do update set "Display Label" = excluded."Display Label";
