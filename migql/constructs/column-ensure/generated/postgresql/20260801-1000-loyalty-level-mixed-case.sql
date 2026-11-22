-- 20260801-1000-loyalty-level-mixed-case

-- part: loyalty-level
do $ensure$
declare
    existing record;
begin
    select a.atttypid, a.atttypmod, format_type(a.atttypid, a.atttypmod) as type into existing
    from pg_attribute a
    where a.attrelid = '"Customer"'::regclass and a.attname = 'Loyalty Level' and a.attnum > 0 and not a.attisdropped;
    if not found then
        alter table "Customer" add column "Loyalty Level" varchar(20);
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod = 24 then
        null;
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod between 5 and 23 then
        alter table "Customer" alter column "Loyalty Level" type varchar(20);
    else
        raise exception 'column-ensure Customer.Loyalty Level varchar(20): the column exists as %. It can neither be kept nor widened.', existing.type;
    end if;
end
$ensure$;

-- part: key-is-longer
do $ensure$
declare
    existing record;
begin
    select a.atttypid, a.atttypmod, format_type(a.atttypid, a.atttypmod) as type into existing
    from pg_attribute a
    where a.attrelid = '"Customer"'::regclass and a.attname = 'key' and a.attnum > 0 and not a.attisdropped;
    if not found then
        alter table "Customer" add column key varchar(40);
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod = 44 then
        null;
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod between 5 and 43 then
        alter table "Customer" alter column key type varchar(40);
    else
        raise exception 'column-ensure Customer.key varchar(40): the column exists as %. It can neither be kept nor widened.', existing.type;
    end if;
end
$ensure$;
