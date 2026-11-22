-- 20260610-0900-orders-note

-- part: note-column
do $ensure$
declare
    existing record;
begin
    select a.atttypid, a.atttypmod, format_type(a.atttypid, a.atttypmod) as type into existing
    from pg_attribute a
    where a.attrelid = 'orders'::regclass and a.attname = 'note' and a.attnum > 0 and not a.attisdropped;
    if not found then
        alter table orders add column note varchar(500);
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod = 504 then
        null;
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod between 5 and 503 then
        alter table orders alter column note type varchar(500);
    else
        raise exception 'column-ensure orders.note varchar(500): the column exists as %. It can neither be kept nor widened.', existing.type;
    end if;
end
$ensure$;
