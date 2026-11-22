-- 20260302-0910-loyalty-mandatory

-- part: make-mandatory
alter table customer alter column loyalty_level set not null;
