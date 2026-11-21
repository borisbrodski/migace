-- 20260620-0910-keep-odd-values

-- part: keep-odd-values
insert into order_status_legacy (order_id, old_status) select o.id, o.status from orders o where o.status_id = (select id from order_status where code = 'UNKNOWN');

-- part: copy-all
insert into book_copy (id, title) select id, title from book;
