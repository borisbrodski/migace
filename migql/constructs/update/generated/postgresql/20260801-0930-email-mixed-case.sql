-- 20260801-0930-email-mixed-case

-- part: copy-email
update "Customer" "C" set "Email" = upper("C".email) where "C"."Email" is null and "C"."Id" > 0;
