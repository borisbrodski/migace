import type { Plan, PlanCondition, PlanPart, PlanSnippet, PlanStep } from '@migace/core';

/** The version of the format of the script: its marker lines and what a runner has to do with them. */
export const SCRIPT_FORMAT = 1;
/** The version of the format of the ledger tables. */
export const LEDGER_FORMAT = 1;

const MARKER = '-- @migace';

/**
 * The limits of a run and their defaults. Each is a parameter of the run; `0` means no limit.
 * One wait for a lock is short, because every statement of the application queues behind a waiting migration.
 * The attempts together give fifteen minutes. A statement has no time limit.
 */
export const LIMITS = {
    /** How long one wait for a lock may take. */
    lock_timeout: '5s',
    /** How often a step is tried when it got no lock. */
    lock_attempts: '90',
    /** The pause between two attempts. */
    lock_wait: '5s',
    /** How long one statement of the script may take, its waits for locks included. */
    statement_timeout: '0',
};

/** The parameters that a run accepts. A name that is not here stops the run. */
export const PARAMETERS = ['schema', 'other_schemas', ...Object.keys(LIMITS)];

/**
 * Every session setting that a run sets: the parameters, and what the script keeps for itself.
 * The last statements of the script set each of them back to empty.
 */
export const RUN_SETTINGS = [
    'schema', 'other_schemas', 'lock_timeout', 'lock_attempts', 'lock_wait', 'statement_timeout', 'parameters',
    'run_schema', 'session_saved', 'session_search_path', 'session_lock_timeout', 'session_statement_timeout',
    'failed', 'executed', 'skip', 'run', 'try', 'waited_since',
] as const;

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
    return [`${MARKER} script format=${SCRIPT_FORMAT}`, ...sections.map(sectionText), `${MARKER} finally`, ...cleanUp().map(sectionText), ''].join('\n');
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
        // A retired part does not count: the snippet is done when the others are.
        statement(`select pg_temp.migace_snippet(${literal(snippet.uid)}, ${literal(snippet.name)}, ${list(snippet.parts.filter(part => part.retired === undefined).map(part => part.name))}, ${literal(snippet.retired)})`),
    ];
}

function partSections(snippet: PlanSnippet, part: PlanPart): Section[] {
    const when = part.when ? [part.when] : [];
    const identity = `${literal(snippet.uid)}, ${literal(snippet.name)}, ${literal(part.name)}, ${literal(part.checksum)}`;
    if (part.retired !== undefined) {
        return [statement(`select pg_temp.migace_retired(${identity}, ${literal(part.retired)})`)];
    }
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
                { kind: 'guard', sql: `select pg_temp.migace_begin(${identity}, ${position},\n    ${literal(step.sql)},\n    ${before},\n    ${literal(step.cleanup)})` },
                { kind: 'statement', sql: step.sql, outsideTransaction: true, label },
                statement(`select pg_temp.migace_outside_end(${identity}, ${position},\n    ${after})`),
            ];
        }
        // The start of the try is committed on its own, before the statement runs: a try that never ends still leaves its row.
        return [
            { kind: 'statement', label, sql: `select pg_temp.migace_begin(${identity}, ${position},\n    ${literal(step?.sql)},\n    ${before},\n    null)` },
            { kind: 'statement', label, sql: `select pg_temp.migace_step(${identity}, ${position},\n    ${literal(step?.sql)},\n    ${after},\n    ${literal(part.stop)})` },
        ];
    });
}

/** Stands for the schema of the run in the text of a statement, until the statement puts the name in. */
const SCHEMA = '@migace_schema@';
/** The schema of the run, as the first statement of the script stores it. */
const RUN_SCHEMA = "current_setting('migace.run_schema')";
/**
 * The key of the lock of a run: "MIGA" in the upper half, the number of the schema in the lower half.
 * Two schemas of one database never share it.
 */
const LOCK_KEY = `(1296648001::bigint << 32) | quote_ident(${RUN_SCHEMA})::regnamespace::oid::bigint`;

/**
 * A statement that names the tables of the ledger. Their schema is known only when the script runs,
 * so the statement is the text of an `execute`, and the name of the schema is put in first.
 */
function inSchema(sql: string): Section {
    return statement(`do $migace_in_schema$
begin
    execute replace($migace_body$${sql}$migace_body$, '${SCHEMA}', quote_ident(${RUN_SCHEMA}));
end
$migace_in_schema$`);
}

/** What every run does first: the schema, the lock, the ledger, the functions of this session and the row of the run. */
function start(prefix: string): Section[] {
    const t = (name: string) => `${SCHEMA}.${prefix}${name}`;
    const ledger = `to_regclass(quote_ident(${RUN_SCHEMA}) || '.${prefix}meta')`;
    return [
        // What the run changes in the session, so that the last statements can set it back.
        statement(`select set_config('migace.session_search_path', current_setting('search_path'), false),
    set_config('migace.session_lock_timeout', current_setting('lock_timeout'), false),
    set_config('migace.session_statement_timeout', current_setting('statement_timeout'), false),
    set_config('migace.session_saved', 'yes', false)`),
        // A mistyped parameter is never ignored. The runner names the parameters it sent in migace.parameters.
        statement(`do $migace$
declare
    v_unknown text;
begin
    select string_agg(format('"%s"', trim(name)), ', ') into v_unknown
    from unnest(string_to_array(coalesce(current_setting('migace.parameters', true), ''), ',')) as name
    where trim(name) <> '' and trim(name) <> all (${list(PARAMETERS)});
    if v_unknown is not null then
        raise exception 'The parameter % is unknown. The parameters of this script are: ${PARAMETERS.join(', ')}.', v_unknown;
    end if;
end
$migace$`),
        // The run works in its schema. It sees no other schema except those that the parameter other_schemas names.
        statement("select set_config('migace.run_schema', coalesce(nullif(current_setting('migace.schema', true), ''), current_schema()), false)"),
        statement(`select set_config('search_path', (select string_agg(quote_ident(trim(name)), ', ' order by position)
    from unnest(array[${RUN_SCHEMA}] || string_to_array(coalesce(current_setting('migace.other_schemas', true), ''), ','))
        with ordinality as schemas (name, position)
    where trim(name) <> ''), false)`),
        statement(`select set_config('migace.failed', '', false), set_config('migace.executed', '0', false), set_config('migace.skip', '', false),
    set_config('migace.run', '', false), set_config('migace.try', '', false), set_config('migace.waited_since', '', false)`),
        // One run at a time. A run that waits here must not hold a transaction open: "create index concurrently" of the run
        // that has the lock waits for every older transaction, and the two would wait for each other. So the wait is a loop
        // that ends its transaction before every pause.
        statement(`do $migace$
begin
    while not pg_try_advisory_lock(${LOCK_KEY}) loop
        if current_setting('migace.waited_since') = '' then
            perform set_config('migace.waited_since', clock_timestamp()::text, false);
        end if;
        commit;
        perform pg_sleep(0.2);
        commit;
    end loop;
end
$migace$`),
        // The limits hold for every statement after this one, also for a statement outside a transaction.
        statement(`select set_config('lock_timeout', lock_limit, false), set_config('statement_timeout', statement_limit, false)
from (select coalesce(nullif(current_setting('migace.lock_timeout', true), ''), '${LIMITS.lock_timeout}') as lock_limit,
    coalesce(nullif(current_setting('migace.statement_timeout', true), ''), '${LIMITS.statement_timeout}') as statement_limit) as limits`),
        inSchema(`do $migace$
declare
    v_format integer;
    v_run bigint;
begin
    if ${ledger} is not null then
        select value::integer into v_format from ${t('meta')} where key = 'format';
        if v_format > ${LEDGER_FORMAT} then
            perform set_config('migace.failed', format('The ledger of this database has the format %s. This script knows the format %s and changes nothing. Use the script of a newer version.', v_format, ${LEDGER_FORMAT}), false);
            return;
        end if;
    end if;
    if ${ledger} is null then
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
        create index ${prefix}part_run_step on ${t('part_run')} (snippet_uid, part, step);
        create table ${t('log')} (
            id bigint generated always as identity primary key, run_id bigint, at timestamptz not null,
            event text not null, snippet_name text, part text, step integer, message text);
    end if;
    insert into ${t('meta')} (key, value) values ('format', '${LEDGER_FORMAT}') on conflict (key) do nothing;
    update ${t('run')} set outcome = 'interrupted', ended_at = clock_timestamp() where outcome = 'running';
    insert into ${t('run')} (started_at, outcome) values (clock_timestamp(), 'running') returning id into v_run;
    perform set_config('migace.run', v_run::text, false);
    insert into ${t('log')} (run_id, at, event) values (v_run, clock_timestamp(), 'run started');
    if current_setting('migace.waited_since') <> '' then
        insert into ${t('log')} (run_id, at, event, message) values (v_run, clock_timestamp(), 'waited',
            format('waited %s for the lock of another run', clock_timestamp() - current_setting('migace.waited_since')::timestamptz));
    end if;
end
$migace$`),
        ...functions(t).map(sql => sql.includes(SCHEMA) ? inSchema(sql) : statement(sql)),
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
        `create or replace function pg_temp.migace_log(p_event text, p_snippet text, p_part text, p_step integer, p_message text) returns void language plpgsql as $migace$
begin
    insert into ${t('log')} (run_id, at, event, snippet_name, part, step, message)
    values (current_setting('migace.run')::bigint, clock_timestamp(), p_event, p_snippet, p_part, p_step, p_message);
end
$migace$`,
        `create or replace function pg_temp.migace_record(${identity}, p_state text, p_sql text, p_started timestamptz,
    p_code text, p_message text, p_detail text, p_context text) returns bigint language plpgsql as $migace$
declare
    v_id bigint;
begin
    insert into ${t('part_run')} (run_id, snippet_uid, snippet_name, part, step, steps, state, sql, checksum, started_at, ended_at,
        error_code, error_message, error_detail, error_context)
    values (current_setting('migace.run')::bigint, p_uid, p_snippet, p_part, p_step, p_steps, p_state, p_sql, p_checksum, p_started,
        case when p_state = 'started' then null else clock_timestamp() end, p_code, p_message, p_detail, p_context)
    returning id into v_id;
    return v_id;
end
$migace$`,
        `create or replace function pg_temp.migace_start_try(${identity}, p_sql text) returns void language plpgsql as $migace$
begin
    perform set_config('migace.try', pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'started', p_sql, clock_timestamp(),
        null, null, null, null)::text, false);
    perform pg_temp.migace_log('started', p_snippet, p_part, p_step, null);
end
$migace$`,
        `create or replace function pg_temp.migace_end_try(p_state text, p_code text, p_message text, p_detail text, p_context text) returns void language plpgsql as $migace$
begin
    update ${t('part_run')} set state = p_state, ended_at = clock_timestamp(),
        error_code = p_code, error_message = p_message, error_detail = p_detail, error_context = p_context
    where id = current_setting('migace.try')::bigint;
end
$migace$`,
        `create or replace function pg_temp.migace_fail(${identity}, p_sql text, p_started timestamptz,
    p_code text, p_message text, p_detail text, p_context text) returns void language plpgsql as $migace$
begin
    if current_setting('migace.try') <> '' then
        perform pg_temp.migace_end_try('failed', p_code, p_message, p_detail, p_context);
    else
        perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'failed', p_sql, p_started, p_code, p_message, p_detail, p_context);
    end if;
    perform set_config('migace.failed', format('%s, part %s: %s', p_snippet, p_part, p_message), false);
    perform pg_temp.migace_log('failed', p_snippet, p_part, p_step, p_message);
    raise notice '%, part %: FAILED: %', p_snippet, p_part, p_message;
end
$migace$`,
        `create or replace function pg_temp.migace_begin(${identity}, p_sql text, ${conditions}, p_cleanup text) returns boolean language plpgsql as $migace$
declare
    v_done text;
    v_untrue integer;
    v_abandoned integer;
    v_started timestamptz := clock_timestamp();
    v_code text;
    v_message text;
    v_detail text;
    v_context text;
begin
    perform set_config('migace.try', '', false);
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
    -- The conditions are decided before the first step only. A part that has started has to end.
    if p_step = 1 then
        begin
            v_untrue := pg_temp.migace_first_untrue(p_when);
            if v_untrue > 0 then
                perform set_config('migace.skip', p_uid || '/' || p_part, false);
                perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'skipped', null, v_started,
                    null, 'when is not true: ' || p_when_text[v_untrue], null, null);
                perform pg_temp.migace_log('skipped', p_snippet, p_part, p_step, 'when is not true: ' || p_when_text[v_untrue]);
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
    end if;
    -- A try that started and never ended: its session, the server or the computer ended in the middle.
    update ${t('part_run')} r set state = 'abandoned', ended_at = clock_timestamp()
    where r.snippet_uid = p_uid and r.part = p_part and r.step = p_step and r.state = 'started';
    get diagnostics v_abandoned = row_count;
    if v_abandoned > 0 then
        perform pg_temp.migace_log('abandoned', p_snippet, p_part, p_step, format('%s earlier try did not end', v_abandoned));
        if p_cleanup is not null then
            execute p_cleanup;
        end if;
    end if;
    perform pg_temp.migace_start_try(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, p_sql);
    return true;
end
$migace$`,
        `create or replace function pg_temp.migace_setting(p_name text, p_default text) returns text language plpgsql as $migace$
begin
    return coalesce(nullif(current_setting('migace.' || p_name, true), ''), p_default);
end
$migace$`,
        `create or replace function pg_temp.migace_blockers() returns text language plpgsql as $migace$
declare
    v_blockers text;
begin
    -- Who holds a lock on a table of the schema. The text of their statements is not read: it can hold data of persons.
    select string_agg(format('%s: process %s, user %s, application %s, %s since %s', c.relname, l.pid, coalesce(a.usename::text, 'unknown'),
            coalesce(nullif(a.application_name, ''), 'unknown'), l.mode, coalesce(a.xact_start::text, 'unknown')), '; ' order by c.relname, l.pid, l.mode)
    into v_blockers
    from pg_locks l join pg_class c on c.oid = l.relation join pg_namespace n on n.oid = c.relnamespace
    left join pg_stat_activity a on a.pid = l.pid
    where l.granted and l.pid <> pg_backend_pid() and l.locktype = 'relation' and c.relkind in ('r', 'p') and n.nspname = ${RUN_SCHEMA};
    return v_blockers;
end
$migace$`,
        `create or replace function pg_temp.migace_step(${identity}, p_sql text, p_after text[], p_after_text text[], p_stop text) returns void language plpgsql as $migace$
declare
    v_untrue integer;
    v_started timestamptz := clock_timestamp();
    v_attempts integer := pg_temp.migace_setting('lock_attempts', '${LIMITS.lock_attempts}')::integer;
    v_attempt integer := 0;
    v_locked text;
    v_code text;
    v_message text;
    v_detail text;
    v_context text;
begin
    if current_setting('migace.try') = '' then
        return;
    end if;
    -- A statement that waits for a lock makes everybody behind it wait too. It gives up after lock_timeout and tries again.
    loop
        v_attempt := v_attempt + 1;
        begin
            if p_stop is not null then
                raise exception using message = p_stop, errcode = 'MA001';
            end if;
            execute p_sql;
            if p_step = p_steps then
                v_untrue := pg_temp.migace_first_untrue(p_after);
                if v_untrue > 0 then
                    raise exception using message = 'verify-after is not true: ' || p_after_text[v_untrue], errcode = 'MA002';
                end if;
            end if;
            perform pg_temp.migace_end_try('done', null, null, null, null);
            perform pg_temp.migace_log('done', p_snippet, p_part, p_step, null);
            exit;
        exception
            when lock_not_available then
                v_detail := pg_temp.migace_blockers();
                select string_agg(distinct split_part(blocker, ':', 1), ', ') into v_locked from unnest(string_to_array(v_detail, '; ')) as blocker;
                v_message := format('no lock within %s, attempt %s %s. Locked by another session: %s',
                    current_setting('lock_timeout'), v_attempt, case when v_attempts = 0 then 'without a limit' else 'of ' || v_attempts end,
                    coalesce(v_locked, 'unknown'));
                if v_attempt = v_attempts then
                    perform pg_temp.migace_fail(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, p_sql, v_started, '55P03', v_message, v_detail, null);
                    return;
                end if;
                perform pg_temp.migace_end_try('no lock', '55P03', v_message, v_detail, null);
                perform pg_temp.migace_log('no lock', p_snippet, p_part, p_step, v_message || coalesce('. ' || v_detail, ''));
                raise notice '%, part %: %', p_snippet, p_part, v_message;
                perform pg_sleep(extract(epoch from pg_temp.migace_setting('lock_wait', '${LIMITS.lock_wait}')::interval));
                perform pg_temp.migace_log('attempt', p_snippet, p_part, p_step,
                    format('attempt %s %s', v_attempt + 1, case when v_attempts = 0 then 'without a limit' else 'of ' || v_attempts end));
                perform pg_temp.migace_start_try(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, p_sql);
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
        `create or replace function pg_temp.migace_outside_end(${identity}, p_after text[], p_after_text text[]) returns void language plpgsql as $migace$
declare
    v_untrue integer;
begin
    if current_setting('migace.failed') <> '' or current_setting('migace.try') = '' then
        return;
    end if;
    perform set_config('migace.executed', (current_setting('migace.executed')::integer + 1)::text, false);
    if p_step = p_steps then
        v_untrue := pg_temp.migace_first_untrue(p_after);
    end if;
    -- The statement ran and cannot be undone. Its try is done; a verify-after that is not true is a failure of its own.
    perform pg_temp.migace_end_try('done', null, null, null, null);
    perform pg_temp.migace_log('done', p_snippet, p_part, p_step, null);
    if v_untrue > 0 then
        perform set_config('migace.try', '', false);
        perform pg_temp.migace_fail(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, null, clock_timestamp(),
            'MA002', 'verify-after is not true: ' || p_after_text[v_untrue], null, null);
        return;
    end if;
    if p_step = p_steps then
        raise notice '%, part %: done', p_snippet, p_part;
    end if;
end
$migace$`,
        `create or replace function pg_temp.migace_retired(p_uid text, p_snippet text, p_part text, p_checksum text, p_reason text) returns void language plpgsql as $migace$
begin
    if current_setting('migace.failed') <> '' then
        return;
    end if;
    -- Recorded once. A database where the part ran before keeps that record, so "ran" stays true there.
    if not exists (select 1 from ${t('part_run')} r where r.snippet_uid = p_uid and r.part = p_part and r.state = 'retired') then
        perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, 0, 0, 'retired', null, clock_timestamp(), null, p_reason, null, null);
        perform pg_temp.migace_log('retired', p_snippet, p_part, null, p_reason);
    end if;
    raise notice '%, part %: retired, never runs: %', p_snippet, p_part, p_reason;
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
    perform pg_temp.migace_log('run ended', null, null, null, case when v_failed then 'failed' when v_executed = 0 then 'nothing to do' else 'done' end);
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

/** What every run does at its end: the row of the run, the fingerprint, and the error if a part failed. */
function finish(plan: Plan): Section[] {
    return [
        statement(`select pg_temp.migace_finish(${literal(plan.fingerprint)})`),
        statement(`do $migace$
begin
    if current_setting('migace.failed') <> '' then
        raise exception '%', current_setting('migace.failed');
    end if;
end
$migace$`),
    ];
}

/**
 * The statements after "-- @migace finally", which a runner sends also after an error. They leave the session as it was
 * before the run: its search path and limits, no lock and no function of MIG-Ace, and no setting of the run.
 */
function cleanUp(): Section[] {
    return [
        statement(`select set_config('search_path', current_setting('migace.session_search_path'), false),
    set_config('lock_timeout', current_setting('migace.session_lock_timeout'), false),
    set_config('statement_timeout', current_setting('migace.session_statement_timeout'), false)
where current_setting('migace.session_saved', true) = 'yes'`),
        statement(`do $migace$
declare
    v_schema oid := to_regnamespace(quote_ident(nullif(current_setting('migace.run_schema', true), '')));
begin
    if exists (select 1 from pg_locks l where l.locktype = 'advisory' and l.pid = pg_backend_pid()
            and l.classid = 1296648001 and l.objid = v_schema and l.objsubid = 1) then
        perform pg_advisory_unlock((1296648001::bigint << 32) | v_schema::bigint);
    end if;
end
$migace$`),
        statement(`do $migace$
declare
    v_function regprocedure;
begin
    for v_function in select p.oid::regprocedure from pg_proc p where p.pronamespace = pg_my_temp_schema() and p.proname like 'migace\\_%' loop
        execute 'drop function ' || v_function;
    end loop;
end
$migace$`),
        statement(`select set_config('migace.' || name, '', false) from unnest(${list([...RUN_SETTINGS])}) as name`),
    ];
}
