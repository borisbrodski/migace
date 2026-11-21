-- 20260612-0910-remove-orphan-reviews

-- part: remove-orphans
delete from review r where not exists (select 1 from book b where b.id = r.book_id);

-- part: remove-all
delete from order_status_legacy;
