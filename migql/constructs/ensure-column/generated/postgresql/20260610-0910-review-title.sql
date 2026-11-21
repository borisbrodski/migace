-- 20260610-0910-review-title

-- part: title-column
do $ensure$
declare
    existing record;
begin
    select a.atttypid, a.atttypmod, format_type(a.atttypid, a.atttypmod) as type into existing
    from pg_attribute a
    where a.attrelid = 'review'::regclass and a.attname = 'title' and a.attnum > 0 and not a.attisdropped;
    if not found then
        alter table review add column title varchar(200);
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod = 204 then
        null;
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod between 5 and 203 then
        alter table review alter column title type varchar(200);
    else
        raise exception 'ensure column review.title varchar(200): the column exists as %. It can neither be kept nor widened.', existing.type;
    end if;
end
$ensure$;
