-- 20260801-0920-key-to-upper-case

-- part: rename
alter table "Customer" rename column key to "Key";

-- part: rename-with-space
alter table "Customer" rename column "Email" to "E Mail";
