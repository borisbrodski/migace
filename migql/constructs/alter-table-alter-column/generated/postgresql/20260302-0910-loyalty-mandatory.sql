-- 20260302-0910-loyalty-mandatory

-- part: make-mandatory
-- step 1 of 4
alter table customer add constraint customer_loyalty_level_not_null check (loyalty_level is not null) not valid;
-- step 2 of 4
alter table customer validate constraint customer_loyalty_level_not_null;
-- step 3 of 4
alter table customer alter column loyalty_level set not null;
-- step 4 of 4
alter table customer drop constraint customer_loyalty_level_not_null;
