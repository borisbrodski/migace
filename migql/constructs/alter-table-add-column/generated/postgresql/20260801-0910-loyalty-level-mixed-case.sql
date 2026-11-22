-- 20260801-0910-loyalty-level-mixed-case

-- part: add-column
alter table "Customer" add column "Loyalty Level" varchar(10);

-- part: add-upper-case-column
alter table "Customer" add column "CreatedAt" timestamp;
