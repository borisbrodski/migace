-- 20260518-1020-unknown-status

-- part: add-unknown-status
insert into order_status (id, code, label) values (nextval('bookshop_seq'), 'UNKNOWN', 'Unknown');
