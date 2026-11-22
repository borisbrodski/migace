-- 20260801-1010-customer-email-mixed-case

-- part: index
create index "IX Customer Email" on "Customer" ("Email", email);
