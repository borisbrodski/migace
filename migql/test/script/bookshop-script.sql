-- @migace script format=1
-- @migace statement
select set_config('migace.session_search_path', current_setting('search_path'), false),
    set_config('migace.session_lock_timeout', current_setting('lock_timeout'), false),
    set_config('migace.session_statement_timeout', current_setting('statement_timeout'), false),
    set_config('migace.session_saved', 'yes', false)
-- @migace statement
select set_config('migace.run_schema', coalesce(nullif(current_setting('migace.schema', true), ''), current_schema()), false)
-- @migace statement
select set_config('search_path', (select string_agg(quote_ident(trim(name)), ', ' order by position)
    from unnest(array[current_setting('migace.run_schema')] || string_to_array(coalesce(current_setting('migace.other_schemas', true), ''), ','))
        with ordinality as schemas (name, position)
    where trim(name) <> ''), false)
-- @migace statement
select set_config('migace.failed', '', false), set_config('migace.executed', '0', false), set_config('migace.skip', '', false), set_config('migace.run', '', false)
-- @migace statement
do $migace$
begin
    while not pg_try_advisory_lock((1296648001::bigint << 32) | quote_ident(current_setting('migace.run_schema'))::regnamespace::oid::bigint) loop
        commit;
        perform pg_sleep(0.2);
        commit;
    end loop;
end
$migace$
-- @migace statement
do $migace_in_schema$
begin
    execute replace($migace_body$do $migace$
declare
    v_format integer;
    v_run bigint;
begin
    if to_regclass(quote_ident(current_setting('migace.run_schema')) || '.mig_meta') is not null then
        select value::integer into v_format from @migace_schema@.mig_meta where key = 'format';
        if v_format > 1 then
            perform set_config('migace.failed', format('The ledger of this database has the format %s. This script knows the format %s and changes nothing. Use the script of a newer version.', v_format, 1), false);
            return;
        end if;
    end if;
    if to_regclass(quote_ident(current_setting('migace.run_schema')) || '.mig_meta') is null then
        create table @migace_schema@.mig_meta (key text primary key, value text not null);
        create table @migace_schema@.mig_run (
            id bigint generated always as identity primary key,
            started_at timestamptz not null, ended_at timestamptz, outcome text not null);
        create table @migace_schema@.mig_snippet (uid text primary key, name text not null, state text not null, updated_at timestamptz not null);
        create table @migace_schema@.mig_part_run (
            id bigint generated always as identity primary key,
            run_id bigint not null, snippet_uid text not null, snippet_name text not null, part text not null,
            step integer not null, steps integer not null, state text not null, sql text, checksum text not null,
            started_at timestamptz not null, ended_at timestamptz,
            error_code text, error_message text, error_detail text, error_context text);
        create index mig_part_run_step on @migace_schema@.mig_part_run (snippet_uid, part, step);
        create table @migace_schema@.mig_log (
            id bigint generated always as identity primary key, run_id bigint, at timestamptz not null, message text not null);
    end if;
    insert into @migace_schema@.mig_meta (key, value) values ('format', '1') on conflict (key) do nothing;
    update @migace_schema@.mig_run set outcome = 'interrupted', ended_at = clock_timestamp() where outcome = 'running';
    insert into @migace_schema@.mig_run (started_at, outcome) values (clock_timestamp(), 'running') returning id into v_run;
    perform set_config('migace.run', v_run::text, false);
end
$migace$$migace_body$, '@migace_schema@', quote_ident(current_setting('migace.run_schema')));
end
$migace_in_schema$
-- @migace statement
do $migace_in_schema$
begin
    execute replace($migace_body$create or replace function pg_temp.migace_ran(p_uid text, p_part text) returns boolean language plpgsql as $migace$
begin
    return exists (select 1 from @migace_schema@.mig_part_run r where r.snippet_uid = p_uid and r.part = p_part and r.state = 'done' and r.step = r.steps);
end
$migace$$migace_body$, '@migace_schema@', quote_ident(current_setting('migace.run_schema')));
end
$migace_in_schema$
-- @migace statement
create or replace function pg_temp.migace_first_untrue(p_conditions text[]) returns integer language plpgsql as $migace$
declare
    v_true boolean;
begin
    for v_index in 1 .. coalesce(array_length(p_conditions, 1), 0) loop
        execute 'select (' || p_conditions[v_index] || ')' into v_true;
        if v_true is not true then
            return v_index;
        end if;
    end loop;
    return 0;
end
$migace$
-- @migace statement
do $migace_in_schema$
begin
    execute replace($migace_body$create or replace function pg_temp.migace_record(p_uid text, p_snippet text, p_part text, p_checksum text, p_step integer, p_steps integer, p_state text, p_sql text, p_started timestamptz,
    p_code text, p_message text, p_detail text, p_context text) returns void language plpgsql as $migace$
begin
    insert into @migace_schema@.mig_part_run (run_id, snippet_uid, snippet_name, part, step, steps, state, sql, checksum, started_at, ended_at,
        error_code, error_message, error_detail, error_context)
    values (current_setting('migace.run')::bigint, p_uid, p_snippet, p_part, p_step, p_steps, p_state, p_sql, p_checksum, p_started,
        case when p_state = 'started' then null else clock_timestamp() end, p_code, p_message, p_detail, p_context);
end
$migace$$migace_body$, '@migace_schema@', quote_ident(current_setting('migace.run_schema')));
end
$migace_in_schema$
-- @migace statement
do $migace_in_schema$
begin
    execute replace($migace_body$create or replace function pg_temp.migace_fail(p_uid text, p_snippet text, p_part text, p_checksum text, p_step integer, p_steps integer, p_sql text, p_started timestamptz,
    p_code text, p_message text, p_detail text, p_context text) returns void language plpgsql as $migace$
begin
    perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'failed', p_sql, p_started, p_code, p_message, p_detail, p_context);
    perform set_config('migace.failed', format('%s, part %s: %s', p_snippet, p_part, p_message), false);
    insert into @migace_schema@.mig_log (run_id, at, message) values (current_setting('migace.run')::bigint, clock_timestamp(), current_setting('migace.failed'));
    raise notice '%, part %: FAILED: %', p_snippet, p_part, p_message;
end
$migace$$migace_body$, '@migace_schema@', quote_ident(current_setting('migace.run_schema')));
end
$migace_in_schema$
-- @migace statement
do $migace_in_schema$
begin
    execute replace($migace_body$create or replace function pg_temp.migace_begin(p_uid text, p_snippet text, p_part text, p_checksum text, p_step integer, p_steps integer, p_sql text, p_when text[], p_when_text text[], p_before text[], p_before_text text[]) returns boolean language plpgsql as $migace$
declare
    v_done text;
    v_untrue integer;
    v_started timestamptz := clock_timestamp();
    v_code text;
    v_message text;
    v_detail text;
    v_context text;
begin
    if current_setting('migace.failed') <> '' then
        return false;
    end if;
    select r.checksum into v_done from @migace_schema@.mig_part_run r
    where r.snippet_uid = p_uid and r.part = p_part and r.step = p_step and r.state = 'done' order by r.id desc limit 1;
    if found then
        if p_step = p_steps and v_done <> p_checksum then
            raise notice '%, part %: already done, in another version than this script has (ran %, now %)', p_snippet, p_part, v_done, p_checksum;
        elsif p_step = p_steps then
            raise notice '%, part %: already done', p_snippet, p_part;
        end if;
        return false;
    end if;
    if current_setting('migace.skip') = p_uid || '/' || p_part then
        return false;
    end if;
    if p_step > 1 then
        return true;
    end if;
    begin
        v_untrue := pg_temp.migace_first_untrue(p_when);
        if v_untrue > 0 then
            perform set_config('migace.skip', p_uid || '/' || p_part, false);
            perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'skipped', null, v_started,
                null, 'when is not true: ' || p_when_text[v_untrue], null, null);
            raise notice '%, part %: skipped, because this is not true: %', p_snippet, p_part, p_when_text[v_untrue];
            return false;
        end if;
        v_untrue := pg_temp.migace_first_untrue(p_before);
        if v_untrue > 0 then
            raise exception using message = 'verify-before is not true: ' || p_before_text[v_untrue], errcode = 'MA002';
        end if;
    exception when others then
        get stacked diagnostics v_code = returned_sqlstate, v_message = message_text, v_detail = pg_exception_detail, v_context = pg_exception_context;
        perform pg_temp.migace_fail(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, p_sql, v_started, v_code, v_message, v_detail, v_context);
        return false;
    end;
    return true;
end
$migace$$migace_body$, '@migace_schema@', quote_ident(current_setting('migace.run_schema')));
end
$migace_in_schema$
-- @migace statement
create or replace function pg_temp.migace_setting(p_name text, p_default text) returns text language plpgsql as $migace$
begin
    return coalesce(nullif(current_setting('migace.' || p_name, true), ''), p_default);
end
$migace$
-- @migace statement
create or replace function pg_temp.migace_step(p_uid text, p_snippet text, p_part text, p_checksum text, p_step integer, p_steps integer, p_sql text, p_when text[], p_when_text text[], p_before text[], p_before_text text[],
    p_after text[], p_after_text text[], p_stop text) returns void language plpgsql as $migace$
declare
    v_untrue integer;
    v_started timestamptz := clock_timestamp();
    v_attempts integer := pg_temp.migace_setting('lock_attempts', '3')::integer;
    v_locked text;
    v_code text;
    v_message text;
    v_detail text;
    v_context text;
begin
    if not pg_temp.migace_begin(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, p_sql, p_when, p_when_text, p_before, p_before_text) then
        return;
    end if;
    for v_attempt in 1 .. v_attempts loop
        begin
            if p_stop is not null then
                raise exception using message = p_stop, errcode = 'MA001';
            end if;
            -- A statement that waits for a lock makes everybody behind it wait too. It gives up after this time.
            perform set_config('lock_timeout', pg_temp.migace_setting('lock_timeout', '5s'), true);
            execute p_sql;
            if p_step = p_steps then
                v_untrue := pg_temp.migace_first_untrue(p_after);
                if v_untrue > 0 then
                    raise exception using message = 'verify-after is not true: ' || p_after_text[v_untrue], errcode = 'MA002';
                end if;
            end if;
            perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'done', p_sql, v_started, null, null, null, null);
            exit;
        exception
            when lock_not_available then
                select string_agg(distinct c.relname, ', ' order by c.relname) into v_locked
                from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
                where l.granted and l.pid <> pg_backend_pid() and l.locktype = 'relation' and c.relkind in ('r', 'p') and n.nspname = current_setting('migace.run_schema');
                v_message := format('no lock within %s, attempt %s of %s. Locked by another session: %s',
                    pg_temp.migace_setting('lock_timeout', '5s'), v_attempt, v_attempts, coalesce(v_locked, 'unknown'));
                if v_attempt = v_attempts then
                    perform pg_temp.migace_fail(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, p_sql, v_started, '55P03', v_message, null, null);
                    return;
                end if;
                perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'no lock', p_sql, v_started, '55P03', v_message, null, null);
                raise notice '%, part %: %', p_snippet, p_part, v_message;
                perform pg_sleep(extract(epoch from pg_temp.migace_setting('lock_wait', '1s')::interval));
                v_started := clock_timestamp();
            when others then
                get stacked diagnostics v_code = returned_sqlstate, v_message = message_text, v_detail = pg_exception_detail, v_context = pg_exception_context;
                perform pg_temp.migace_fail(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, p_sql, v_started, v_code, v_message, v_detail, v_context);
                return;
        end;
    end loop;
    perform set_config('migace.executed', (current_setting('migace.executed')::integer + 1)::text, false);
    if p_step = p_steps then
        raise notice '%, part %: done', p_snippet, p_part;
    end if;
end
$migace$
-- @migace statement
do $migace_in_schema$
begin
    execute replace($migace_body$create or replace function pg_temp.migace_outside_begin(p_uid text, p_snippet text, p_part text, p_checksum text, p_step integer, p_steps integer, p_sql text, p_when text[], p_when_text text[], p_before text[], p_before_text text[], p_cleanup text) returns boolean language plpgsql as $migace$
begin
    if not pg_temp.migace_begin(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, p_sql, p_when, p_when_text, p_before, p_before_text) then
        return false;
    end if;
    update @migace_schema@.mig_part_run r set state = 'abandoned', ended_at = clock_timestamp()
    where r.snippet_uid = p_uid and r.part = p_part and r.step = p_step and r.state = 'started';
    if found and p_cleanup is not null then
        execute p_cleanup;
    end if;
    perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'started', p_sql, clock_timestamp(), null, null, null, null);
    return true;
end
$migace$$migace_body$, '@migace_schema@', quote_ident(current_setting('migace.run_schema')));
end
$migace_in_schema$
-- @migace statement
do $migace_in_schema$
begin
    execute replace($migace_body$create or replace function pg_temp.migace_outside_end(p_uid text, p_snippet text, p_part text, p_checksum text, p_step integer, p_steps integer, p_after text[], p_after_text text[]) returns void language plpgsql as $migace$
declare
    v_untrue integer;
begin
    if current_setting('migace.failed') <> '' then
        return;
    end if;
    update @migace_schema@.mig_part_run r set state = 'done', ended_at = clock_timestamp()
    where r.run_id = current_setting('migace.run')::bigint and r.snippet_uid = p_uid and r.part = p_part and r.step = p_step and r.state = 'started';
    if not found then
        return;
    end if;
    perform set_config('migace.executed', (current_setting('migace.executed')::integer + 1)::text, false);
    if p_step = p_steps then
        v_untrue := pg_temp.migace_first_untrue(p_after);
        if v_untrue > 0 then
            perform pg_temp.migace_fail(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, null, clock_timestamp(),
                'MA002', 'verify-after is not true: ' || p_after_text[v_untrue], null, null);
            return;
        end if;
        raise notice '%, part %: done', p_snippet, p_part;
    end if;
end
$migace$$migace_body$, '@migace_schema@', quote_ident(current_setting('migace.run_schema')));
end
$migace_in_schema$
-- @migace statement
do $migace_in_schema$
begin
    execute replace($migace_body$create or replace function pg_temp.migace_snippet(p_uid text, p_name text, p_parts text[], p_retired text) returns void language plpgsql as $migace$
declare
    v_run bigint := nullif(current_setting('migace.run'), '')::bigint;
    v_state text;
begin
    if v_run is null then
        return;
    end if;
    v_state := case
        when p_retired is not null then 'retired'
        when exists (select 1 from @migace_schema@.mig_part_run r where r.run_id = v_run and r.snippet_uid = p_uid and r.state = 'failed') then 'failed'
        when not exists (select 1 from unnest(p_parts) as part where not pg_temp.migace_ran(p_uid, part)) then 'done'
        when exists (select 1 from @migace_schema@.mig_part_run r where r.run_id = v_run and r.snippet_uid = p_uid and r.state = 'skipped') then 'skipped'
        else 'pending'
    end;
    insert into @migace_schema@.mig_snippet (uid, name, state, updated_at) values (p_uid, p_name, v_state, clock_timestamp())
    on conflict (uid) do update set name = excluded.name, state = excluded.state, updated_at = excluded.updated_at;
    if p_retired is not null and current_setting('migace.failed') = '' then
        raise notice '%: retired, never runs: %', p_name, p_retired;
    end if;
end
$migace$$migace_body$, '@migace_schema@', quote_ident(current_setting('migace.run_schema')));
end
$migace_in_schema$
-- @migace statement
do $migace_in_schema$
begin
    execute replace($migace_body$create or replace function pg_temp.migace_finish(p_fingerprint text) returns void language plpgsql as $migace$
declare
    v_run bigint := nullif(current_setting('migace.run'), '')::bigint;
    v_failed boolean := current_setting('migace.failed') <> '';
    v_executed integer := current_setting('migace.executed')::integer;
begin
    if v_run is null then
        return;
    end if;
    update @migace_schema@.mig_run set ended_at = clock_timestamp(),
        outcome = case when v_failed then 'failed' when v_executed = 0 then 'nothing to do' else 'done' end
    where id = v_run;
    if v_failed then
        raise notice 'Stopped. Nothing after the failed part was run.';
        return;
    end if;
    if p_fingerprint is not null then
        insert into @migace_schema@.mig_meta (key, value) values ('fingerprint', p_fingerprint)
        on conflict (key) do update set value = excluded.value;
    end if;
    if v_executed = 0 then
        raise notice 'Nothing to do.';
    else
        raise notice 'Done: % steps ran.', v_executed;
    end if;
end
$migace$$migace_body$, '@migace_schema@', quote_ident(current_setting('migace.run_schema')));
end
$migace_in_schema$
-- @migace statement label="20260302-0900-customer-loyalty, part add-column"
select pg_temp.migace_step('01JF2A6QW3ZK8M4T7R9B5X0C1D', '20260302-0900-customer-loyalty', 'add-column', 'v1:de0e049d9074d5eb9ec50240893d06e0059bca5dda567e17398e9de9798d8813', 1, 1,
    'alter table customer add column loyalty_level varchar(10)',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260302-0900-customer-loyalty, part fill-existing"
select pg_temp.migace_step('01JF2A6QW3ZK8M4T7R9B5X0C1D', '20260302-0900-customer-loyalty', 'fill-existing', 'v1:e8fae9270668214cc04e6de0679f9c70a721b1ab1677830d378e971e58a5277d', 1, 1,
    'update customer set loyalty_level = ''BRONZE''',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260302-0900-customer-loyalty, part make-mandatory"
select pg_temp.migace_step('01JF2A6QW3ZK8M4T7R9B5X0C1D', '20260302-0900-customer-loyalty', 'make-mandatory', 'v1:a57b154477dd9d09b8bc0ebc9976050b70e40df10041e64ec5acd570ccdaaf38', 1, 4,
    'alter table customer add constraint customer_loyalty_level_not_null check (loyalty_level is not null) not valid',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260302-0900-customer-loyalty, part make-mandatory"
select pg_temp.migace_step('01JF2A6QW3ZK8M4T7R9B5X0C1D', '20260302-0900-customer-loyalty', 'make-mandatory', 'v1:a57b154477dd9d09b8bc0ebc9976050b70e40df10041e64ec5acd570ccdaaf38', 2, 4,
    'alter table customer validate constraint customer_loyalty_level_not_null',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260302-0900-customer-loyalty, part make-mandatory"
select pg_temp.migace_step('01JF2A6QW3ZK8M4T7R9B5X0C1D', '20260302-0900-customer-loyalty', 'make-mandatory', 'v1:a57b154477dd9d09b8bc0ebc9976050b70e40df10041e64ec5acd570ccdaaf38', 3, 4,
    'alter table customer alter column loyalty_level set not null',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260302-0900-customer-loyalty, part make-mandatory"
select pg_temp.migace_step('01JF2A6QW3ZK8M4T7R9B5X0C1D', '20260302-0900-customer-loyalty', 'make-mandatory', 'v1:a57b154477dd9d09b8bc0ebc9976050b70e40df10041e64ec5acd570ccdaaf38', 4, 4,
    'alter table customer drop constraint customer_loyalty_level_not_null',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement
select pg_temp.migace_snippet('01JF2A6QW3ZK8M4T7R9B5X0C1D', '20260302-0900-customer-loyalty', array['add-column', 'fill-existing', 'make-mandatory']::text[], null)
-- @migace statement label="20260309-1400-review-table, part create-table"
select pg_temp.migace_step('01JF4C9S2M7H5K3P8V6N1Y0E4R', '20260309-1400-review-table', 'create-table', 'v1:47110af6846310542c41682c41e164eb8d8b348a1e7000de77a97987012e4247', 1, 1,
    'create table review (
    id bigint not null,
    book_id bigint not null,
    customer_id bigint not null,
    stars integer not null check (stars between 1 and 5),
    review_text varchar(2000),
    created_at timestamp not null,
    primary key (id)
)',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260309-1400-review-table, part fk-book"
select pg_temp.migace_step('01JF4C9S2M7H5K3P8V6N1Y0E4R', '20260309-1400-review-table', 'fk-book', 'v1:cb2249b43421626625718f829312634969b0cbae7920707eafe7db7a59e88feb', 1, 1,
    'alter table review add constraint fk_review_book foreign key (book_id) references book',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260309-1400-review-table, part fk-customer"
select pg_temp.migace_step('01JF4C9S2M7H5K3P8V6N1Y0E4R', '20260309-1400-review-table', 'fk-customer', 'v1:05306bc162ff68c30a57719f7fe3b64f9f17de090eb51cd31e43cd5b13dbb821', 1, 1,
    'alter table review add constraint fk_review_customer foreign key (customer_id) references customer',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260309-1400-review-table, part index-book"
select pg_temp.migace_step('01JF4C9S2M7H5K3P8V6N1Y0E4R', '20260309-1400-review-table', 'index-book', 'v1:32ba7506604830e4e74e92e89f9fea328737731f4ba5599b01e01d11fd72c7b7', 1, 1,
    'create index ix_review_book on review (book_id)',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement
select pg_temp.migace_snippet('01JF4C9S2M7H5K3P8V6N1Y0E4R', '20260309-1400-review-table', array['create-table', 'fk-book', 'fk-customer', 'index-book']::text[], null)
-- @migace guard
select pg_temp.migace_outside_begin('01JFM8W1Y3A5C7E9G1J3L5N7Q9', '20260401-0830-orders-customer-index', 'index', 'v1:e31894b2e2071f48e107587a66349aa17a712aec0fcb5970c9802dce3ed563a5', 1, 1,
    'create index concurrently ix_orders_customer on orders (customer_id)',
    null::text[], null::text[],
    null::text[], null::text[],
    'drop index if exists ix_orders_customer')
-- @migace statement outside-transaction label="20260401-0830-orders-customer-index, part index"
create index concurrently ix_orders_customer on orders (customer_id)
-- @migace statement
select pg_temp.migace_outside_end('01JFM8W1Y3A5C7E9G1J3L5N7Q9', '20260401-0830-orders-customer-index', 'index', 'v1:e31894b2e2071f48e107587a66349aa17a712aec0fcb5970c9802dce3ed563a5', 1, 1,
    null::text[], null::text[])
-- @migace statement
select pg_temp.migace_snippet('01JFM8W1Y3A5C7E9G1J3L5N7Q9', '20260401-0830-orders-customer-index', array['index']::text[], null)
-- @migace statement label="20260518-1000-order-status, part create-status-table"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'create-status-table', 'v1:6d038856d0ae8419d42dec79f9d94464c79c8b01c7bd0465e121e5e05a490b83', 1, 1,
    'create table order_status (
    id bigint not null,
    code varchar(20) not null,
    label varchar(50) not null,
    primary key (id),
    constraint uq_order_status_code unique (code)
)',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260518-1000-order-status, part add-statuses"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'add-statuses', 'v1:e2211f2711807c75301dd39fdf617336ca5364591f7663afc0dd520c9c5fafc7', 1, 1,
    'insert into order_status (id, code, label) values
    (1, ''OPEN'', ''Open''),
    (2, ''PAID'', ''Paid''),
    (3, ''SHIPPED'', ''Shipped''),
    (4, ''CANCELLED'', ''Cancelled''),
    (5, ''UNKNOWN'', ''Unknown'')',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260518-1000-order-status, part add-status-id"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'add-status-id', 'v1:565f102dcee3aaff9855c355b74bc5a1693f720be8b6066dc2c31acd3b0c9353', 1, 1,
    'alter table orders add column status_id bigint',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260518-1000-order-status, part link-status"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'link-status', 'v1:917a2f1a33824d6b5a48654cd9e9f4ae710f06386669589ad6c718558a3e87fd', 1, 1,
    'update orders o set status_id = (select s.id from order_status s where s.code = upper(trim(o.status))) where o.status_id is null',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260518-1000-order-status, part default-unknown"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'default-unknown', 'v1:c8f6d2c5a09acf91d7f1f299208bfff2255b64a72d342be8c01dc00be6e0325d', 1, 1,
    'update orders set status_id = (select id from order_status where code = ''UNKNOWN'') where status_id is null',
    null::text[], null::text[],
    null::text[], null::text[],
    array['not exists (select 1 from orders where (orders.status_id is not null) is not true)']::text[], array['all: orders.status_id is not null']::text[],
    null)
-- @migace statement label="20260518-1000-order-status, part status-fk"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'status-fk', 'v1:5ba567981c8f0a05a8cf3c16eae712defd3d002db6206c2dfc5bef29c007682f', 1, 2,
    'alter table orders add constraint fk_orders_status foreign key (status_id) references order_status not valid',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260518-1000-order-status, part status-fk"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'status-fk', 'v1:5ba567981c8f0a05a8cf3c16eae712defd3d002db6206c2dfc5bef29c007682f', 2, 2,
    'alter table orders validate constraint fk_orders_status',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260518-1000-order-status, part status-mandatory"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'status-mandatory', 'v1:6d47f209123e8a25bf676e5e8369b15930f7d7b107f5bbfdfadf51fb0c317d0a', 1, 4,
    'alter table orders add constraint orders_status_id_not_null check (status_id is not null) not valid',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260518-1000-order-status, part status-mandatory"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'status-mandatory', 'v1:6d47f209123e8a25bf676e5e8369b15930f7d7b107f5bbfdfadf51fb0c317d0a', 2, 4,
    'alter table orders validate constraint orders_status_id_not_null',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260518-1000-order-status, part status-mandatory"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'status-mandatory', 'v1:6d47f209123e8a25bf676e5e8369b15930f7d7b107f5bbfdfadf51fb0c317d0a', 3, 4,
    'alter table orders alter column status_id set not null',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260518-1000-order-status, part status-mandatory"
select pg_temp.migace_step('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', 'status-mandatory', 'v1:6d47f209123e8a25bf676e5e8369b15930f7d7b107f5bbfdfadf51fb0c317d0a', 4, 4,
    'alter table orders drop constraint orders_status_id_not_null',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement
select pg_temp.migace_snippet('01JG1D5R8Y3B6F9J2L4N7Q0T3W', '20260518-1000-order-status', array['create-status-table', 'add-statuses', 'add-status-id', 'link-status', 'default-unknown', 'status-fk', 'status-mandatory']::text[], null)
-- @migace statement label="20260525-1100-orders-ship-by, part add-column"
select pg_temp.migace_step('01JG2K8T5W1Z4C7F0H3M6P9S2V', '20260525-1100-orders-ship-by', 'add-column', 'v1:a85676063ee9977634459bc8797346cb81d145da2b76b97cde9dfb19224810d4', 1, 1,
    'alter table orders add column ship_by date',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260525-1100-orders-ship-by, part fill-ship-by"
select pg_temp.migace_step('01JG2K8T5W1Z4C7F0H3M6P9S2V', '20260525-1100-orders-ship-by', 'fill-ship-by', 'v1:e1c19603c02b0ec41d671168220944abb776f225571f46f05c981f95707e7962', 1, 1,
    'update orders set ship_by = cast(created_at as date) + make_interval(days => 3) where ship_by is null',
    null::text[], null::text[],
    null::text[], null::text[],
    array['not exists (select 1 from orders where (orders.ship_by is not null) is not true)']::text[], array['all: orders.ship_by is not null']::text[],
    null)
-- @migace statement
select pg_temp.migace_snippet('01JG2K8T5W1Z4C7F0H3M6P9S2V', '20260525-1100-orders-ship-by', array['add-column', 'fill-ship-by']::text[], null)
-- @migace statement label="20260601-0900-book-price-check, part price-not-negative"
select pg_temp.migace_step('01JG3A1D4G7K0N3R6U9X2B5E8H', '20260601-0900-book-price-check', 'price-not-negative', 'v1:3dd5f50446f1af7ba1f67726c307a8c964d5daa494f5fdc5d401171d156ca97d', 1, 2,
    'alter table book add constraint ck_book_price check (price_cents >= 0) not valid',
    null::text[], null::text[],
    array['not exists (select 1 from book where (book.price_cents < 0))']::text[], array['none: book.price_cents < 0']::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260601-0900-book-price-check, part price-not-negative"
select pg_temp.migace_step('01JG3A1D4G7K0N3R6U9X2B5E8H', '20260601-0900-book-price-check', 'price-not-negative', 'v1:3dd5f50446f1af7ba1f67726c307a8c964d5daa494f5fdc5d401171d156ca97d', 2, 2,
    'alter table book validate constraint ck_book_price',
    null::text[], null::text[],
    array['not exists (select 1 from book where (book.price_cents < 0))']::text[], array['none: book.price_cents < 0']::text[],
    null::text[], null::text[],
    null)
-- @migace statement
select pg_temp.migace_snippet('01JG3A1D4G7K0N3R6U9X2B5E8H', '20260601-0900-book-price-check', array['price-not-negative']::text[], null)
-- @migace statement label="20260608-1500-book-title-search, part trigram-extension"
select pg_temp.migace_step('01JG3N7V4C8Q1S6W9Y2A5E0H3K', '20260608-1500-book-title-search', 'trigram-extension', 'v1:36b3a14b05a6994a3d0b9922e69f84e6f88dd97dff9c3cabc1298402faf3fe23', 1, 1,
    'create extension if not exists pg_trgm',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement label="20260608-1500-book-title-search, part title-search-index"
select pg_temp.migace_step('01JG3N7V4C8Q1S6W9Y2A5E0H3K', '20260608-1500-book-title-search', 'title-search-index', 'v1:d311c0f4773936dfabc15494980069cda6a9a7df51cc87646c615f521cf15fc7', 1, 1,
    'create index ix_book_title_search on book
using gin (title gin_trgm_ops)',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement
select pg_temp.migace_snippet('01JG3N7V4C8Q1S6W9Y2A5E0H3K', '20260608-1500-book-title-search', array['trigram-extension', 'title-search-index']::text[], null)
-- @migace statement label="20260622-0900-repair-order-status, part relink"
select pg_temp.migace_step('01JG8T3B6X9D2F5H7K1M4Q0W8Z', '20260622-0900-repair-order-status', 'relink', 'v1:9d845bca24990b3e88d965efd61a203707bfbabd2fc2855f3b4ffe213e15b6cf', 1, 1,
    'update orders o set status_id = (select s.id from order_status s where s.code = upper(trim(o.status))) where o.status_id = (select id from order_status where code = ''UNKNOWN'') and exists (select 1 from order_status s where s.code = upper(trim(o.status)))',
    array['pg_temp.migace_ran(''01JG1D5R8Y3B6F9J2L4N7Q0T3W'', ''link-status'')']::text[], array['ran order-status.link-status']::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement
select pg_temp.migace_snippet('01JG8T3B6X9D2F5H7K1M4Q0W8Z', '20260622-0900-repair-order-status', array['relink']::text[], null)
-- @migace statement label="20260907-1000-customer-email, part rename-mail"
select pg_temp.migace_step('01JH5P2R4T6V8X0Z2B4D6F8H0K', '20260907-1000-customer-email', 'rename-mail', 'v1:76730dec37f06625cb2cb36360e05d6c8ce3885b3ad7a9439687b367ba274c83', 1, 1,
    'alter table customer rename column mail to email',
    null::text[], null::text[],
    null::text[], null::text[],
    null::text[], null::text[],
    null)
-- @migace statement
select pg_temp.migace_snippet('01JH5P2R4T6V8X0Z2B4D6F8H0K', '20260907-1000-customer-email', array['rename-mail']::text[], null)
-- @migace statement
select pg_temp.migace_finish(null)
-- @migace statement
do $migace$
begin
    if current_setting('migace.failed') <> '' then
        raise exception '%', current_setting('migace.failed');
    end if;
end
$migace$
-- @migace finally
-- @migace statement
select set_config('search_path', current_setting('migace.session_search_path'), false),
    set_config('lock_timeout', current_setting('migace.session_lock_timeout'), false),
    set_config('statement_timeout', current_setting('migace.session_statement_timeout'), false)
where current_setting('migace.session_saved', true) = 'yes'
-- @migace statement
do $migace$
declare
    v_schema oid := to_regnamespace(quote_ident(nullif(current_setting('migace.run_schema', true), '')));
begin
    if exists (select 1 from pg_locks l where l.locktype = 'advisory' and l.pid = pg_backend_pid()
            and l.classid = 1296648001 and l.objid = v_schema and l.objsubid = 1) then
        perform pg_advisory_unlock((1296648001::bigint << 32) | v_schema::bigint);
    end if;
end
$migace$
-- @migace statement
do $migace$
declare
    v_function regprocedure;
begin
    for v_function in select p.oid::regprocedure from pg_proc p where p.pronamespace = pg_my_temp_schema() and p.proname like 'migace\_%' loop
        execute 'drop function ' || v_function;
    end loop;
end
$migace$
-- @migace statement
select set_config('migace.' || name, '', false) from unnest(array['schema', 'other_schemas', 'lock_timeout', 'lock_attempts', 'lock_wait', 'run_schema', 'session_saved', 'session_search_path', 'session_lock_timeout', 'session_statement_timeout', 'failed', 'executed', 'skip', 'run']::text[]) as name
