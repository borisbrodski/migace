-- 20260801-1020-email-mandatory-mixed-case

-- part: make-mandatory
-- step 1 of 4
alter table "Customer" add constraint "Customer_Email_not_null" check ("Email" is not null) not valid;
-- step 2 of 4
alter table "Customer" validate constraint "Customer_Email_not_null";
-- step 3 of 4
alter table "Customer" alter column "Email" set not null;
-- step 4 of 4
alter table "Customer" drop constraint "Customer_Email_not_null";
