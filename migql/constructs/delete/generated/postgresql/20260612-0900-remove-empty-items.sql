-- 20260612-0900-remove-empty-items

-- part: remove-empty-items
delete from order_item where quantity = 0;
