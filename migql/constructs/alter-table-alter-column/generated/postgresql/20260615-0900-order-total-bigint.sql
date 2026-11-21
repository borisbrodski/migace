-- 20260615-0900-order-total-bigint

-- part: widen-total
alter table orders alter column total_cents type bigint;

-- part: widen-price
alter table order_item alter column price_cents type bigint;

-- part: default-level
alter table customer alter column loyalty_level set default 'BRONZE';

-- part: no-default
alter table customer alter column loyalty_level drop default;

-- part: optional-again
alter table customer alter column loyalty_level drop not null;
