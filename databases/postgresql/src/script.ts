import type { Plan, PlanCondition, PlanPart, PlanSnippet, PlanStep } from '@migace/core';

/** The version of the format of the script: its marker lines and what a runner has to do with them. */
export const SCRIPT_FORMAT = 1;
/** The version of the format of the ledger tables. */
export const LEDGER_FORMAT = 1;

const MARKER = '-- @migace';

/** The defaults of the parameters of a run that deal with locks. A runner can set `migace.lock_timeout` and the others. */
const LOCK_TIMEOUT = '5s';
const LOCK_ATTEMPTS = 3;
const LOCK_WAIT = '1s';

/** The plan cannot be written as a script. */
export class ScriptError extends Error { }

interface Section {
    kind: 'statement' | 'guard';
    sql: string;
    outsideTransaction?: boolean;
    /** Names what the statement belongs to, for the error of a runner. */
    label?: string;
}

/**
 * Writes a plan as one PostgreSQL script. The script holds all logic of the migration: it creates its ledger,
 * runs what is missing, records every step and stops after a failure. A runner only sends it, statement by statement.
 *
 * The same plan gives the same text, with LF line endings.
 */
export function writeScript(plan: Plan): string {
    if (!/^[a-z_][a-z0-9_]*$/.test(plan.ledgerPrefix)) {
        throw new ScriptError(`The prefix of the ledger tables is made of lower-case letters, digits and underscores: "${plan.ledgerPrefix}".`);
    }
    const sections: Section[] = [
        ...start(plan.ledgerPrefix),
        ...plan.snippets.flatMap(snippet => snippetSections(snippet)),
        ...finish(plan),
    ];
    return [`${MARKER} script format=${SCRIPT_FORMAT}`, ...sections.map(sectionText), ''].join('\n');
}

function sectionText(section: Section): string {
    // A line of a statement that looks like a marker would be read as one by a runner.
    const hostile = section.sql.split('\n').find(line => line.startsWith(MARKER));
    if (hostile) {
        throw new ScriptError(`${section.label ?? 'A statement'}: a line starts with "${MARKER}". The script uses such lines to separate statements. Change the line.`);
    }
    const attributes = (section.outsideTransaction ? ' outside-transaction' : '') + (section.label ? ` label="${section.label.replace(/"/g, "'")}"` : '');
    return `${MARKER} ${section.kind}${attributes}\n${section.sql}`;
}

const statement = (sql: string): Section => ({ kind: 'statement', sql });

/** A text as a literal. A quote inside it is doubled, so no text of a snippet can end the literal. */
function literal(value: string | undefined): string {
    return value === undefined ? 'null' : `'${value.replace(/'/g, "''")}'`;
}

function list(values: string[]): string {
    return values.length === 0 ? 'null::text[]' : `array[${values.map(literal).join(', ')}]::text[]`;
}

function snippetSections(snippet: PlanSnippet): Section[] {
    const parts = snippet.retired ? [] : snippet.parts.flatMap(part => partSections(snippet, part));
    return [
        ...parts,
        statement(`select pg_temp.migace_snippet(${literal(snippet.uid)}, ${literal(snippet.name)}, ${list(snippet.parts.map(part => part.name))}, ${literal(snippet.retired)})`),
    ];
}

function partSections(snippet: PlanSnippet, part: PlanPart): Section[] {
    const when = [snippet.when, part.when].filter((condition): condition is PlanCondition => condition !== undefined);
    const identity = `${literal(snippet.uid)}, ${literal(snippet.name)}, ${literal(part.name)}, ${literal(part.checksum)}`;
    const conditions = (checks: PlanCondition[]) => `${list(checks.map(check => check.sql))}, ${list(checks.map(check => check.text))}`;
    const label = `${snippet.name}, part ${part.name}`;
    // A part that stops the run has no statement. It is one step that fails with the message of the author.
    const steps: Array<PlanStep | undefined> = part.stop === undefined ? part.steps : [undefined];
    return steps.flatMap((step, index): Section[] => {
        const position = `${index + 1}, ${steps.length}`;
        const before = `${conditions(when)},\n    ${conditions(part.verifyBefore)}`;
        const after = conditions(part.verifyAfter);
        if (step?.outsideTransaction) {
            return [
                { kind: 'guard', sql: `select pg_temp.migace_outside_begin(${identity}, ${position},\n    ${literal(step.sql)},\n    ${before},\n    ${literal(step.cleanup)})` },
                { kind: 'statement', sql: step.sql, outsideTransaction: true, label },
                statement(`select pg_temp.migace_outside_end(${identity}, ${position},\n    ${after})`),
            ];
        }
        return [{
            kind: 'statement',
            label,
            sql: `select pg_temp.migace_step(${identity}, ${position},\n    ${literal(step?.sql)},\n    ${before},\n    ${after},\n    ${literal(part.stop)})`,
        }];
    });
}

/** What every run does first: the schema, the lock, the ledger, the functions of this session and the row of the run. */
function start(prefix: string): Section[] {
    const t = (name: string) => `${prefix}${name}`;
    return [
        // The schema of the migration comes first: everything is created and looked up there. What the session had in its
        // search path stays behind it, so that types and operators of extensions are still found.
        statement("select set_config('search_path', quote_ident(coalesce(nullif(current_setting('migace.schema', true), ''), current_schema())) || ', ' || current_setting('search_path'), false)"),
        statement("select set_config('migace.failed', '', false), set_config('migace.executed', '0', false), set_config('migace.skip', '', false), set_config('migace.run', '', false)"),
        // One run at a time. A run that waits here must not hold a transaction open: "create index concurrently" of the run
        // that has the lock waits for every older transaction, and the two would wait for each other. So the wait is a loop
        // that ends its transaction before every pause.
        statement(`do $migace$
begin
    while not pg_try_advisory_lock(hashtext('migace ' || current_schema())) loop
        commit;
        perform pg_sleep(0.2);
        commit;
    end loop;
end
$migace$`),
        statement(`do $migace$
declare
    v_format integer;
    v_run bigint;
begin
    if to_regclass('${t('meta')}') is not null then
        select value::integer into v_format from ${t('meta')} where key = 'format';
        if v_format > ${LEDGER_FORMAT} then
            perform set_config('migace.failed', format('The ledger of this database has the format %s. This script knows the format %s and changes nothing. Use the script of a newer version.', v_format, ${LEDGER_FORMAT}), false);
            return;
        end if;
    end if;
    if to_regclass('${t('meta')}') is null then
        create table ${t('meta')} (key text primary key, value text not null);
        create table ${t('run')} (
            id bigint generated always as identity primary key,
            started_at timestamptz not null, ended_at timestamptz, outcome text not null);
        create table ${t('snippet')} (uid text primary key, name text not null, state text not null, updated_at timestamptz not null);
        create table ${t('part_run')} (
            id bigint generated always as identity primary key,
            run_id bigint not null, snippet_uid text not null, snippet_name text not null, part text not null,
            step integer not null, steps integer not null, state text not null, sql text, checksum text not null,
            started_at timestamptz not null, ended_at timestamptz,
            error_code text, error_message text, error_detail text, error_context text);
        create index ${t('part_run_step')} on ${t('part_run')} (snippet_uid, part, step);
        create table ${t('log')} (
            id bigint generated always as identity primary key, run_id bigint, at timestamptz not null, message text not null);
    end if;
    insert into ${t('meta')} (key, value) values ('format', '${LEDGER_FORMAT}') on conflict (key) do nothing;
    update ${t('run')} set outcome = 'interrupted', ended_at = clock_timestamp() where outcome = 'running';
    insert into ${t('run')} (started_at, outcome) values (clock_timestamp(), 'running') returning id into v_run;
    perform set_config('migace.run', v_run::text, false);
end
$migace$`),
        ...functions(t).map(statement),
    ];
}

/** The functions of the script. They exist for this session only, so nothing of MIG-Ace stays in the database but the ledger. */
function functions(t: (name: string) => string): string[] {
    const identity = 'p_uid text, p_snippet text, p_part text, p_checksum text, p_step integer, p_steps integer';
    const conditions = 'p_when text[], p_when_text text[], p_before text[], p_before_text text[]';
    return [
        `create or replace function pg_temp.migace_ran(p_uid text, p_part text) returns boolean language plpgsql as $migace$
begin
    return exists (select 1 from ${t('part_run')} r where r.snippet_uid = p_uid and r.part = p_part and r.state = 'done' and r.step = r.steps);
end
$migace$`,
        `create or replace function pg_temp.migace_first_untrue(p_conditions text[]) returns integer language plpgsql as $migace$
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
$migace$`,
        `create or replace function pg_temp.migace_record(${identity}, p_state text, p_sql text, p_started timestamptz,
    p_code text, p_message text, p_detail text, p_context text) returns void language plpgsql as $migace$
begin
    insert into ${t('part_run')} (run_id, snippet_uid, snippet_name, part, step, steps, state, sql, checksum, started_at, ended_at,
        error_code, error_message, error_detail, error_context)
    values (current_setting('migace.run')::bigint, p_uid, p_snippet, p_part, p_step, p_steps, p_state, p_sql, p_checksum, p_started,
        case when p_state = 'started' then null else clock_timestamp() end, p_code, p_message, p_detail, p_context);
end
$migace$`,
        `create or replace function pg_temp.migace_fail(${identity}, p_sql text, p_started timestamptz,
    p_code text, p_message text, p_detail text, p_context text) returns void language plpgsql as $migace$
begin
    perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'failed', p_sql, p_started, p_code, p_message, p_detail, p_context);
    perform set_config('migace.failed', format('%s, part %s: %s', p_snippet, p_part, p_message), false);
    insert into ${t('log')} (run_id, at, message) values (current_setting('migace.run')::bigint, clock_timestamp(), current_setting('migace.failed'));
    raise notice '%, part %: FAILED: %', p_snippet, p_part, p_message;
end
$migace$`,
        `create or replace function pg_temp.migace_begin(${identity}, p_sql text, ${conditions}) returns boolean language plpgsql as $migace$
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
    select r.checksum into v_done from ${t('part_run')} r
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
$migace$`,
        `create or replace function pg_temp.migace_setting(p_name text, p_default text) returns text language plpgsql as $migace$
begin
    return coalesce(nullif(current_setting('migace.' || p_name, true), ''), p_default);
end
$migace$`,
        `create or replace function pg_temp.migace_step(${identity}, p_sql text, ${conditions},
    p_after text[], p_after_text text[], p_stop text) returns void language plpgsql as $migace$
declare
    v_untrue integer;
    v_started timestamptz := clock_timestamp();
    v_attempts integer := pg_temp.migace_setting('lock_attempts', '${LOCK_ATTEMPTS}')::integer;
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
            perform set_config('lock_timeout', pg_temp.migace_setting('lock_timeout', '${LOCK_TIMEOUT}'), true);
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
                where l.granted and l.pid <> pg_backend_pid() and l.locktype = 'relation' and c.relkind in ('r', 'p') and n.nspname = current_schema();
                v_message := format('no lock within %s, attempt %s of %s. Locked by another session: %s',
                    pg_temp.migace_setting('lock_timeout', '${LOCK_TIMEOUT}'), v_attempt, v_attempts, coalesce(v_locked, 'unknown'));
                if v_attempt = v_attempts then
                    perform pg_temp.migace_fail(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, p_sql, v_started, '55P03', v_message, null, null);
                    return;
                end if;
                perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'no lock', p_sql, v_started, '55P03', v_message, null, null);
                raise notice '%, part %: %', p_snippet, p_part, v_message;
                perform pg_sleep(extract(epoch from pg_temp.migace_setting('lock_wait', '${LOCK_WAIT}')::interval));
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
$migace$`,
        `create or replace function pg_temp.migace_outside_begin(${identity}, p_sql text, ${conditions}, p_cleanup text) returns boolean language plpgsql as $migace$
begin
    if not pg_temp.migace_begin(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, p_sql, p_when, p_when_text, p_before, p_before_text) then
        return false;
    end if;
    update ${t('part_run')} r set state = 'abandoned', ended_at = clock_timestamp()
    where r.snippet_uid = p_uid and r.part = p_part and r.step = p_step and r.state = 'started';
    if found and p_cleanup is not null then
        execute p_cleanup;
    end if;
    perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'started', p_sql, clock_timestamp(), null, null, null, null);
    return true;
end
$migace$`,
        `create or replace function pg_temp.migace_outside_end(${identity}, p_after text[], p_after_text text[]) returns void language plpgsql as $migace$
declare
    v_untrue integer;
begin
    if current_setting('migace.failed') <> '' then
        return;
    end if;
    update ${t('part_run')} r set state = 'done', ended_at = clock_timestamp()
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
$migace$`,
        `create or replace function pg_temp.migace_snippet(p_uid text, p_name text, p_parts text[], p_retired text) returns void language plpgsql as $migace$
declare
    v_run bigint := nullif(current_setting('migace.run'), '')::bigint;
    v_state text;
begin
    if v_run is null then
        return;
    end if;
    v_state := case
        when p_retired is not null then 'retired'
        when exists (select 1 from ${t('part_run')} r where r.run_id = v_run and r.snippet_uid = p_uid and r.state = 'failed') then 'failed'
        when not exists (select 1 from unnest(p_parts) as part where not pg_temp.migace_ran(p_uid, part)) then 'done'
        when exists (select 1 from ${t('part_run')} r where r.run_id = v_run and r.snippet_uid = p_uid and r.state = 'skipped') then 'skipped'
        else 'pending'
    end;
    insert into ${t('snippet')} (uid, name, state, updated_at) values (p_uid, p_name, v_state, clock_timestamp())
    on conflict (uid) do update set name = excluded.name, state = excluded.state, updated_at = excluded.updated_at;
    if p_retired is not null and current_setting('migace.failed') = '' then
        raise notice '%: retired, never runs: %', p_name, p_retired;
    end if;
end
$migace$`,
        `create or replace function pg_temp.migace_finish(p_fingerprint text) returns void language plpgsql as $migace$
declare
    v_run bigint := nullif(current_setting('migace.run'), '')::bigint;
    v_failed boolean := current_setting('migace.failed') <> '';
    v_executed integer := current_setting('migace.executed')::integer;
begin
    if v_run is null then
        return;
    end if;
    update ${t('run')} set ended_at = clock_timestamp(),
        outcome = case when v_failed then 'failed' when v_executed = 0 then 'nothing to do' else 'done' end
    where id = v_run;
    if v_failed then
        raise notice 'Stopped. Nothing after the failed part was run.';
        return;
    end if;
    if p_fingerprint is not null then
        insert into ${t('meta')} (key, value) values ('fingerprint', p_fingerprint)
        on conflict (key) do update set value = excluded.value;
    end if;
    if v_executed = 0 then
        raise notice 'Nothing to do.';
    else
        raise notice 'Done: % steps ran.', v_executed;
    end if;
end
$migace$`,
    ];
}

/** What every run does last: the row of the run, the fingerprint, the lock, and the error if a part failed. */
function finish(plan: Plan): Section[] {
    return [
        statement(`select pg_temp.migace_finish(${literal(plan.fingerprint)})`),
        statement("select pg_advisory_unlock(hashtext('migace ' || current_schema()))"),
        statement(`do $migace$
begin
    if current_setting('migace.failed') <> '' then
        raise exception '%', current_setting('migace.failed');
    end if;
end
$migace$`),
    ];
}
