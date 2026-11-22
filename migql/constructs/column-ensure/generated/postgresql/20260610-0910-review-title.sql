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
        alter table review add column title varchar(200) default 'Untitled' not null;
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod = 204 then
        null;
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod between 5 and 203 then
        alter table review alter column title type varchar(200);
    else
        raise exception 'column-ensure review.title varchar(200): the column exists as %. It can neither be kept nor widened.', existing.type;
    end if;
end
$ensure$;

-- part: weight-column
do $ensure$
declare
    existing record;
begin
    select a.atttypid, a.atttypmod, format_type(a.atttypid, a.atttypmod) as type into existing
    from pg_attribute a
    where a.attrelid = 'book'::regclass and a.attname = 'weight' and a.attnum > 0 and not a.attisdropped;
    if not found then
        alter table book add column weight numeric(10, 3);
    elsif existing.atttypid = 'numeric'::regtype and existing.atttypmod = 655367 then
        null;
    elsif existing.atttypid = 'numeric'::regtype and existing.atttypmod <> -1 and (existing.atttypmod - 4) & 65535 = 3 and (existing.atttypmod - 4) >> 16 < 10 then
        alter table book alter column weight type numeric(10, 3);
    else
        raise exception 'column-ensure book.weight numeric(10, 3): the column exists as %. It can neither be kept nor widened.', existing.type;
    end if;
end
$ensure$;
