-- 20260525-1100-orders-ship-by

-- part: add-ship-by
alter table orders add column ship_by date;

-- part: add-note
alter table orders add column note varchar(500) not null default '';
