import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { fingerprint } from '@migace/core';
import { LIMITS, RUN_SETTINGS, ScriptError, writeScript } from '@migace/postgresql';
import { projectWith } from '../plan/project-folder.js';
import { BOOKSHOP_MIGRATIONS, createScriptDatabase, EXTENSIONS, planOf, scriptOf, scriptWith } from './support.js';

const { bookshop, empty, run, runFailing, rows, exec, model, schema, session, sessionState } = createScriptDatabase();

const CUSTOMERS = "insert into customer (id, name, mail, created_at) values (1, 'Maria', 'maria@example.org', now()), (2, 'Jo', null, now())";

const partRuns = () => rows('select snippet_name, part, step, steps, state from mig_part_run order by id');
const states = async () => (await partRuns()).map(row => `${row.part} ${row.step}/${row.steps} ${row.state}`);

// M4.1-AC-13, M4.1-AC-15, M4.1-AC-16, M4.1-AC-17
describe('The ledger', () => {
    test('is created by the first run, with the prefix mig_ and without a batch table', async () => {
        await bookshop();

        await run(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: alter table customer add column note varchar(10)'] }));

        expect((await model({ ledgerPrefix: 'none_' })).tables.map(table => table.name).filter(name => name.startsWith('mig_')))
            .toEqual(['mig_log', 'mig_meta', 'mig_part_run', 'mig_run', 'mig_snippet']);
        expect(await rows("select value from mig_meta where key = 'format'")).toEqual([{ value: '1' }]);
    });

    test('its prefix is a parameter of the compiler', async () => {
        await bookshop();

        await run(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: delete from customer'] }, { ledgerPrefix: 'lg_' }));

        expect(await rows('select part, state from lg_part_run')).toEqual([{ part: 'p', state: 'done' }]);
    });

    test('the fingerprint of a schema is the same with and without the ledger', async () => {
        await bookshop();
        const before = fingerprint(await model());

        await run(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: delete from customer'] }));

        expect(fingerprint(await model())).toBe(before);
    });

    test('every run writes one row, and every attempt of a step one row with what ran', async () => {
        await bookshop(CUSTOMERS);
        const script = await scriptWith({ '20260302-0900-a': ['parts:', '  - fill:', "      do: update customer set mail = 'none' where mail is null", '  - mandatory:', '      column-set-not-null: { table: customer, column: mail }'] });

        await run(script);

        expect(await rows('select outcome, started_at <= ended_at as ordered from mig_run')).toEqual([{ outcome: 'done', ordered: true }]);
        expect(await rows(`select snippet_uid, snippet_name, part, step, steps, state, sql, left(checksum, 3) as rule, started_at <= ended_at as ordered,
            error_code, error_message from mig_part_run where part = 'fill'`)).toEqual([{
            snippet_uid: 'UID1', snippet_name: '20260302-0900-a', part: 'fill', step: 1, steps: 1, state: 'done',
            sql: "update customer set mail = 'none' where mail is null", rule: 'v1:', ordered: true, error_code: null, error_message: null,
        }]);
        expect(await states()).toEqual(['fill 1/1 done', 'mandatory 1/4 done', 'mandatory 2/4 done', 'mandatory 3/4 done', 'mandatory 4/4 done']);
        expect(await rows('select uid, name, state from mig_snippet')).toEqual([{ uid: 'UID1', name: '20260302-0900-a', state: 'done' }]);
    });

    test('the run holds a lock of the session and releases it at the end, also after a failure', async () => {
        await bookshop();
        const locks = () => rows("select count(*)::integer as held from pg_locks where locktype = 'advisory'");

        await run(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: delete from customer'] }));
        expect(await locks()).toEqual([{ held: 0 }]);

        const script = await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: delete from customer', '  - q:', '      do: delete from no_such_table'] });
        const [main, last] = script.split(/^-- @migace finally$/m).map(part => part.split(/^-- @migace .*$/m).slice(1).map(text => text.trim()));
        await session(`select set_config('migace.schema', '${schema()}', false), set_config('migace.other_schemas', '${EXTENSIONS}', false)`);
        for (const statement of main.slice(0, -1)) {
            await session(statement);
        }
        expect(await locks()).toEqual([{ held: 1 }]);
        await expect(session(main[main.length - 1])).rejects.toThrow('20260302-0900-a, part q: relation "no_such_table" does not exist');
        expect(await locks()).toEqual([{ held: 1 }]);
        for (const statement of last) {
            await session(statement);
        }
        expect(await locks()).toEqual([{ held: 0 }]);
    });

    // M4.1-AC-14
    test('a ledger with a higher format number than the script knows stops the run, and nothing is changed', async () => {
        await bookshop();
        const script = await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: alter table customer add column note varchar(10)'] });
        await run(script.replace('add column note', 'add column first_note'));
        await exec("update mig_meta set value = '2' where key = 'format'");
        const before = await model();

        const { error } = await runFailing(script);

        expect(error).toBe('The ledger of this database has the format 2. This script knows the format 1 and changes nothing. Use the script of a newer version.');
        expect(fingerprint(await model())).toBe(fingerprint(before));
        expect(await rows('select count(*)::integer as runs from mig_run')).toEqual([{ runs: 1 }]);
    });
});

// M4.1-AC-39
describe('The schema of a run', () => {
    test('is a parameter of the runner, and no other schema is touched', async () => {
        await empty('create table customer (id bigint)');
        const other = schema();
        await empty('create table customer (id bigint)');

        await run(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: alter table customer add column note varchar(10)'] }));

        const columns = (name: string) => rows(`select column_name from information_schema.columns where table_schema = '${name}' and table_name = 'customer' order by 1`);
        expect(await columns(schema())).toEqual([{ column_name: 'id' }, { column_name: 'note' }]);
        expect(await columns(other)).toEqual([{ column_name: 'id' }]);
        expect(await rows(`select count(*)::integer as tables from information_schema.tables where table_schema in ('${other}', 'public') and table_name like 'mig_%'`))
            .toEqual([{ tables: 0 }]);
    });
});

describe('One schema, nothing shared', () => {
    const ledgerOf = (name: string) => rows(`select snippet_name, part, state from ${name}.mig_part_run order by id`);

    // M4.4-AC-01
    test('a run finds its ledger only in the schema of the migration, also when the search path of the session names another one', async () => {
        await bookshop();
        const first = schema();
        await run(await scriptOf(BOOKSHOP_MIGRATIONS));
        const ledgerOfFirst = await ledgerOf(first);
        await bookshop();
        const second = schema();
        await session(`set search_path to public, ${first}`);

        await run(await scriptOf(BOOKSHOP_MIGRATIONS), { schema: second, other_schemas: EXTENSIONS });

        expect(await ledgerOf(second)).toEqual(ledgerOfFirst);
        expect(await ledgerOf(first)).toEqual(ledgerOfFirst);
        expect(await rows(`select count(*)::integer as runs from ${first}.mig_run`)).toEqual([{ runs: 1 }]);
    });

    // M4.4-AC-02
    test('the search path of a run is its schema; a table of another schema is not found without its schema', async () => {
        await empty('create table archive (id bigint)');
        const other = schema();
        await empty('create table customer (id bigint)');
        await session(`set search_path to ${other}, public`);

        const { error } = await runFailing(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: delete from archive'] }));

        expect(error).toBe('20260302-0900-a, part p: relation "archive" does not exist');
    });

    // M4.4-AC-03
    test('the bookshop needs the schema of pg_trgm in other_schemas; without it the index of the title search fails', async () => {
        await bookshop();

        const { error } = await runFailing(await scriptOf(BOOKSHOP_MIGRATIONS), { schema: schema() });

        expect(error).toMatch(/^20260608-1500-book-title-search, part title-search-index: operator class "gin_trgm_ops" does not exist/);
    });

    // M4.4-AC-04
    test('a schema that other_schemas names is seen, and its own ledger is neither read nor written', async () => {
        await bookshop();
        const first = schema();
        await run(await scriptOf(BOOKSHOP_MIGRATIONS));
        const ledgerOfFirst = await ledgerOf(first);
        await bookshop();
        const second = schema();

        await run(await scriptOf(BOOKSHOP_MIGRATIONS), { schema: second, other_schemas: `${EXTENSIONS}, ${first}` });

        expect(await ledgerOf(second)).toEqual(ledgerOfFirst);
        expect(await ledgerOf(first)).toEqual(ledgerOfFirst);
        expect(await rows(`select count(*)::integer as runs from ${first}.mig_run`)).toEqual([{ runs: 1 }]);
    });

    test('a schema that other_schemas names is found by a statement of a snippet', async () => {
        await empty('create table archive (id bigint)');
        const other = schema();
        await empty('create table customer (id bigint)');

        await run(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: delete from archive'] }), { schema: schema(), other_schemas: other });

        expect(await rows('select state from mig_part_run')).toEqual([{ state: 'done' }]);
    });
});

describe('Every try is recorded', () => {
    const log = () => rows('select event, snippet_name, part, step, message from mig_log order by id');

    // M4.4-AC-11
    test('the start of a try is committed before its statement runs', async () => {
        await bookshop();
        const script = await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      native:', '        postgresql: |',
            '          do $$ begin',
            "            if not exists (select 1 from mig_part_run where part = 'p' and state = 'started') then raise exception 'the try is not recorded'; end if;",
            '          end $$'] });

        await run(script);

        expect(await states()).toEqual(['p 1/1 done']);
    });

    // M4.4-AC-12
    test('a try that did not end is marked as abandoned by the next run, which writes a row of its own', async () => {
        await bookshop();
        const script = await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: alter table customer add column note varchar(10)'] });
        await run(await scriptWith({ '20260301-0900-z': ['parts:', '  - z:', '      do: delete from customer'] }));
        // What a session leaves that ended in the middle of the step.
        await exec(`insert into mig_part_run (run_id, snippet_uid, snippet_name, part, step, steps, state, sql, checksum, started_at)
            values (1, 'UID1', '20260302-0900-a', 'p', 1, 1, 'started', 'alter table customer add column note varchar(10)', 'v1:x', now())`);

        await run(script);

        expect((await rows("select state, ended_at is not null as ended from mig_part_run where part = 'p' order by id")))
            .toEqual([{ state: 'abandoned', ended: true }, { state: 'done', ended: true }]);
        expect((await log()).filter(line => line.part === 'p').map(line => line.event)).toEqual(['abandoned', 'started', 'done']);
    });

    // M4.4-AC-13
    test('the log has a line for the start and the end of the run, and for every start, end, failure and skip of a step', async () => {
        await bookshop();
        const script = await scriptWith({ '20260302-0900-a': ['parts:',
            '  - skipped:', '      when: column customer.no_such_column exists', '      do: delete from customer',
            '  - done:', '      do: delete from customer',
            '  - broken:', '      do: delete from no_such_table'] });

        await runFailing(script);

        expect(await log()).toEqual([
            { event: 'run started', snippet_name: null, part: null, step: null, message: null },
            { event: 'skipped', snippet_name: '20260302-0900-a', part: 'skipped', step: 1, message: 'when is not true: column customer.no_such_column exists' },
            { event: 'started', snippet_name: '20260302-0900-a', part: 'done', step: 1, message: null },
            { event: 'done', snippet_name: '20260302-0900-a', part: 'done', step: 1, message: null },
            { event: 'started', snippet_name: '20260302-0900-a', part: 'broken', step: 1, message: null },
            { event: 'failed', snippet_name: '20260302-0900-a', part: 'broken', step: 1, message: 'relation "no_such_table" does not exist' },
            { event: 'run ended', snippet_name: null, part: null, step: null, message: 'failed' },
        ]);
    });
});

describe('Limits', () => {
    const DELETE = { '20260302-0900-a': ['parts:', '  - p:', '      do: delete from customer'] };

    // M4.4-AC-19
    test('a parameter that the script does not know stops the run before it changes anything, and the message lists the parameters', async () => {
        await bookshop();

        const { error } = await runFailing(await scriptWith(DELETE), { schema: schema(), other_schemas: EXTENSIONS, lock_timout: '1s' });

        expect(error).toBe('The parameter "lock_timout" is unknown. The parameters of this script are: schema, other_schemas, lock_timeout, lock_attempts, lock_wait, statement_timeout.');
        expect(await rows("select to_regclass('mig_meta') is null as no_ledger")).toEqual([{ no_ledger: true }]);
    });

    // M4.4-AC-16, M4.4-AC-17
    test('every limit has a default: one wait for a lock takes seconds, all attempts together at least fifteen minutes, a statement has no limit', () => {
        const seconds = (value: string) => Number(value.replace(/s$/, ''));

        expect(Object.keys(LIMITS)).toEqual(['lock_timeout', 'lock_attempts', 'lock_wait', 'statement_timeout']);
        expect(seconds(LIMITS.lock_timeout)).toBeLessThanOrEqual(10);
        expect(Number(LIMITS.lock_attempts) * (seconds(LIMITS.lock_timeout) + seconds(LIMITS.lock_wait))).toBeGreaterThanOrEqual(15 * 60);
        expect(LIMITS.statement_timeout).toBe('0');
    });
});

describe('What a run leaves in its session', () => {
    const CLEAN = { lock_timeout: '0', statement_timeout: '0', settings: '', locks: 0, functions: 0 };
    const before = async () => {
        for (const setting of ['set search_path to public, extensions', "set lock_timeout = '7s'", "set statement_timeout = '1h'"]) {
            await session(setting);
        }
        return sessionState();
    };
    const reset = async () => {
        for (const setting of ['set search_path to public', 'reset lock_timeout', 'reset statement_timeout']) {
            await session(setting);
        }
    };

    // M4.4-AC-06
    test('after a good run: the search path and the limits it had before, no lock, no function and no setting of MIG-Ace', async () => {
        await bookshop();
        const state = await before();

        await run(await scriptOf(BOOKSHOP_MIGRATIONS));

        expect(await sessionState()).toEqual(state);
        expect(state).toEqual({ ...CLEAN, search_path: 'public, extensions', lock_timeout: '7s', statement_timeout: '1h' });
        await reset();
    });

    // M4.4-AC-07
    test('after a failure that the script reports at its end', async () => {
        await bookshop();
        const state = await before();

        const { error } = await runFailing(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: delete from no_such_table'] }));

        expect(error).toBe('20260302-0900-a, part p: relation "no_such_table" does not exist');
        expect(await sessionState()).toEqual(state);
        await reset();
    });

    // M4.4-AC-07
    test('after a failure at a statement outside a transaction, after which the runner stops', async () => {
        await bookshop();
        const state = await before();

        const { error } = await runFailing(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: create index concurrently ix_x on customer (no_such_column)'] }));

        expect(error).toBe('20260302-0900-a, part p: column "no_such_column" does not exist');
        expect(await sessionState()).toEqual(state);
        expect(await rows('select state from mig_part_run')).toEqual([{ state: 'started' }]);
        await reset();
    });

    test('every setting of MIG-Ace that the script uses is one that its last statements set back', async () => {
        const script = await scriptOf(BOOKSHOP_MIGRATIONS);
        const used = new Set([...script.matchAll(/'migace\.(\w+)'/g), ...script.matchAll(/migace_setting\('(\w+)'/g)].map(match => match[1]));

        expect([...used].filter(name => !(RUN_SETTINGS as readonly string[]).includes(name))).toEqual([]);
        expect(used.size).toBeGreaterThan(10);
    });
});

// M4.1-AC-20, M4.1-AC-21, M4.1-AC-22, M4.1-AC-23
describe('A changed project', () => {
    const FIRST = { '20260302-0900-a': ['parts:', '  - p:', '      do: alter table customer add column a integer'] };

    test('a new snippet: only its parts run', async () => {
        await bookshop();
        await run(await scriptWith(FIRST));

        const notices = await run(await scriptWith({ ...FIRST, '20260303-0900-b': ['parts:', '  - q:', '      do: alter table customer add column b integer'] }));

        expect(notices).toEqual(['20260302-0900-a, part p: already done', '20260303-0900-b, part q: done', 'Done: 1 steps ran.']);
    });

    test('a snippet whose file was renamed keeps its uid and is known as already run', async () => {
        await bookshop();
        await run(await scriptWith(FIRST));

        const notices = await run(await scriptWith({ '20260101-0900-moved': FIRST['20260302-0900-a'] }));

        expect(notices).toEqual(['20260101-0900-moved, part p: already done', 'Nothing to do.']);
        expect(await rows('select uid, name, state from mig_snippet')).toEqual([{ uid: 'UID1', name: '20260101-0900-moved', state: 'done' }]);
    });

    test('a part that ran and was changed afterwards is not run again; a notice says that the versions differ', async () => {
        await bookshop();
        await run(await scriptWith(FIRST));

        const notices = await run(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: alter table customer add column a bigint'] }));

        expect(notices).toEqual([
            expect.stringMatching(/^20260302-0900-a, part p: already done, in another version than this script has \(ran v1:[0-9a-f]{64}, now v1:[0-9a-f]{64}\)$/),
            'Nothing to do.',
        ]);
        expect((await model()).tables.find(table => table.name === 'customer')!.columns.find(column => column.name === 'a')!.type).toBe('integer');
    });

    test('a retired snippet never runs and is recorded as retired', async () => {
        await bookshop();

        const notices = await run(await scriptWith({ '20260302-0900-a': ['retired: The column was a bad idea.', ...FIRST['20260302-0900-a']] }));

        expect(notices).toEqual(['20260302-0900-a: retired, never runs: The column was a bad idea.', 'Nothing to do.']);
        expect(await rows('select name, state from mig_snippet')).toEqual([{ name: '20260302-0900-a', state: 'retired' }]);
        expect((await model()).tables.find(table => table.name === 'customer')!.columns.map(column => column.name)).not.toContain('a');
    });
});

// M4.1-AC-25
describe('The fingerprint of the desired schema', () => {
    test('is stored after a run without a failure, and not after a failed one', async () => {
        await bookshop();
        const failing = { '20260302-0900-a': ['parts:', '  - p:', '      do: delete from no_such_table'] };

        await runFailing(await scriptWith(failing, { fingerprint: 'abc123' }));
        expect(await rows("select value from mig_meta where key = 'fingerprint'")).toEqual([]);

        await exec('create table no_such_table (id bigint)');
        await run(await scriptWith(failing, { fingerprint: 'abc123' }));
        expect(await rows("select value from mig_meta where key = 'fingerprint'")).toEqual([{ value: 'abc123' }]);
    });
});

// M4.1-AC-26, M4.1-AC-27, M4.1-AC-28
describe('A step that fails', () => {
    const PROJECT = {
        '20260302-0900-a': ['parts:', '  - first:', '      do: alter table customer add column a integer', '  - broken:', "      do: update customer set a = 1 / (select count(*) from book)",
            '  - after:', '      do: alter table customer add column b integer'],
        '20260303-0900-b': ['parts:', '  - later:', '      do: alter table customer add column c integer'],
    };

    test('leaves nothing of its statement, one row with the full error, and nothing after it runs', async () => {
        await bookshop(CUSTOMERS);

        const { error, notices } = await runFailing(await scriptWith(PROJECT));

        expect(error).toBe('20260302-0900-a, part broken: division by zero');
        expect(notices).toEqual([
            '20260302-0900-a, part first: done',
            '20260302-0900-a, part broken: FAILED: division by zero',
            'Stopped. Nothing after the failed part was run.',
        ]);
        expect(await states()).toEqual(['first 1/1 done', 'broken 1/1 failed']);
        expect(await rows("select error_code, error_message, error_context is not null as has_context, sql from mig_part_run where state = 'failed'")).toEqual([
            { error_code: '22012', error_message: 'division by zero', has_context: true, sql: 'update customer set a = 1 / (select count(*) from book)' },
        ]);
        expect(await rows('select a from customer order by id')).toEqual([{ a: null }, { a: null }]);
        expect((await model()).tables.find(table => table.name === 'customer')!.columns.map(column => column.name)).not.toContain('b');
        expect(await rows('select outcome from mig_run')).toEqual([{ outcome: 'failed' }]);
        expect(await rows('select name, state from mig_snippet order by name')).toEqual([
            { name: '20260302-0900-a', state: 'failed' }, { name: '20260303-0900-b', state: 'pending' },
        ]);
    });

    test('the next run repeats the failed step and continues with everything that follows', async () => {
        await bookshop(CUSTOMERS);
        await runFailing(await scriptWith(PROJECT));
        await exec("insert into book (id, title, author, price_cents, stock) values (1, 'T', 'A', 1, 1)");

        const notices = await run(await scriptWith(PROJECT));

        expect(notices).toEqual([
            '20260302-0900-a, part first: already done',
            '20260302-0900-a, part broken: done',
            '20260302-0900-a, part after: done',
            '20260303-0900-b, part later: done',
            'Done: 3 steps ran.',
        ]);
        expect(await states()).toEqual(['first 1/1 done', 'broken 1/1 failed', 'broken 1/1 done', 'after 1/1 done', 'later 1/1 done']);
    });

    // M4.1-AC-29
    test('a part with several steps continues at the step that failed', async () => {
        await bookshop(CUSTOMERS);
        const script = await scriptWith({ '20260302-0900-a': ['parts:', '  - mandatory:', '      column-set-not-null: { table: customer, column: mail }'] });

        const { error } = await runFailing(script);

        expect(error).toMatch(/^20260302-0900-a, part mandatory: check constraint "customer_mail_not_null" of relation "customer" is violated by some row/);
        expect(await states()).toEqual(['mandatory 1/4 done', 'mandatory 2/4 failed']);

        await exec("update customer set mail = 'jo@example.org' where mail is null");
        const notices = await run(script);

        expect(notices).toEqual(['20260302-0900-a, part mandatory: done', 'Done: 3 steps ran.']);
        const customer = (await model()).tables.find(table => table.name === 'customer')!;
        expect(customer.columns.find(column => column.name === 'mail')!.nullable).toBe(false);
        expect(customer.checks).toEqual([]);
    });
});

// M4.1-AC-30, M4.1-AC-31, M4.1-AC-32, M4.1-AC-33
describe('Conditions', () => {
    test('a part whose when is false is skipped, decided again on the next run, and runs when the condition has become true', async () => {
        await bookshop(CUSTOMERS);
        const script = await scriptWith({ '20260302-0900-a': ['parts:', '  - copy:', '      when: column customer.legacy_mail exists', '      do: update customer set mail = legacy_mail',
            '  - other:', '      do: alter table customer add column a integer'] });

        expect(await run(script)).toEqual([
            '20260302-0900-a, part copy: skipped, because this is not true: column customer.legacy_mail exists',
            '20260302-0900-a, part other: done',
            'Done: 1 steps ran.',
        ]);
        expect(await rows('select state from mig_snippet')).toEqual([{ state: 'skipped' }]);

        await exec("alter table customer add column legacy_mail varchar(255) default 'old@example.org'");
        expect(await run(script)).toEqual(['20260302-0900-a, part copy: done', '20260302-0900-a, part other: already done', 'Done: 1 steps ran.']);
        expect(await rows('select distinct mail from customer')).toEqual([{ mail: 'old@example.org' }]);
        expect(await states()).toEqual(['copy 1/1 skipped', 'other 1/1 done', 'copy 1/1 done']);
    });

    test('when on a snippet holds for all its parts, and names of let work in every condition', async () => {
        await bookshop(CUSTOMERS);
        const script = await scriptWith({ '20260302-0900-a': [
            'when: has_customers and not has_books', 'let:', '  has_customers: exists (select 1 from customer)', '  has_books: exists (select 1 from book where stock > 0)',
            'parts:', '  - one:', '      do: alter table customer add column a integer',
            '  - two:', '      when: has_books', '      do: alter table customer add column b integer',
            '  - three:', '      when: not has_books', '      do: alter table customer add column c integer',
        ] });

        expect(await run(script)).toEqual([
            '20260302-0900-a, part one: done',
            '20260302-0900-a, part two: skipped, because this is not true: has_books',
            '20260302-0900-a, part three: done',
            'Done: 2 steps ran.',
        ]);

        await empty('create table customer (id bigint)', 'create table book (id bigint, stock integer)');
        expect((await run(script)).slice(0, 3).map(notice => notice.replace(/^.*part /, ''))).toEqual([
            'one: skipped, because this is not true: has_customers and not has_books',
            'two: skipped, because this is not true: has_customers and not has_books',
            'three: skipped, because this is not true: has_customers and not has_books',
        ]);
    });

    test('a condition on the history is true when the part ran with success on this database', async () => {
        await bookshop(CUSTOMERS);
        const first = { '20260302-0900-first': ['parts:', '  - link:', '      when: column customer.mail exists', '      do: alter table customer add column a integer'] };
        const repair = { '20260303-0900-repair': ['when: ran first.link', 'parts:', '  - fix:', '      do: alter table customer add column fixed integer'] };

        await exec('alter table customer rename column mail to email');
        expect(await run(await scriptWith({ ...first, ...repair }))).toEqual([
            '20260302-0900-first, part link: skipped, because this is not true: column customer.mail exists',
            '20260303-0900-repair, part fix: skipped, because this is not true: ran first.link',
            'Nothing to do.',
        ]);

        await exec('alter table customer rename column email to mail');
        expect(await run(await scriptWith({ ...first, ...repair }))).toEqual([
            '20260302-0900-first, part link: done', '20260303-0900-repair, part fix: done', 'Done: 2 steps ran.',
        ]);
    });

    test('a part of several steps that stopped at a later step has not run', async () => {
        await bookshop(CUSTOMERS);
        const repair = { '20260301-0900-repair': ['when: ran a.mandatory', 'parts:', '  - fix:', '      do: alter table customer add column fixed integer'] };
        const script = await scriptWith({ ...repair, '20260302-0900-a': ['parts:', '  - mandatory:', '      column-set-not-null: { table: customer, column: mail }'] });
        await runFailing(script);
        expect(await states()).toEqual(['fix 1/1 skipped', 'mandatory 1/4 done', 'mandatory 2/4 failed']);

        const { notices } = await runFailing(script);

        expect(notices[0]).toBe('20260301-0900-repair, part fix: skipped, because this is not true: ran a.mandatory');

        await exec("update customer set mail = 'jo@example.org' where mail is null");
        await run(script);
        expect(await run(script)).toEqual(['20260301-0900-repair, part fix: done', '20260302-0900-a, part mandatory: already done', 'Done: 1 steps ran.']);
    });
});

// M4.1-AC-34, M4.1-AC-35
describe('Checks and stop', () => {
    test('a false verify-before fails the part before its statement runs', async () => {
        await bookshop("insert into book (id, title, author, price_cents, stock) values (1, 'T', 'A', -5, 1)");
        const script = await scriptWith({ '20260302-0900-a': ['parts:', '  - check:', '      verify-before:', '        - none: book.price_cents < 0',
            '      do: update book set stock = 99'] });

        const { error } = await runFailing(script);

        expect(error).toBe('20260302-0900-a, part check: verify-before is not true: none: book.price_cents < 0');
        expect(await rows('select stock from book')).toEqual([{ stock: 1 }]);
        expect(await states()).toEqual(['check 1/1 failed']);
    });

    test('a false verify-after fails the part, and its statement is undone', async () => {
        await bookshop(CUSTOMERS);
        const script = await scriptWith({ '20260302-0900-a': ['parts:', '  - fill:', "      do: update customer set mail = 'x' where id = 1", '      verify-after:', '        - all: customer.mail is not null'] });

        const { error } = await runFailing(script);

        expect(error).toBe('20260302-0900-a, part fill: verify-after is not true: all: customer.mail is not null');
        expect(await rows('select mail from customer order by id')).toEqual([{ mail: 'maria@example.org' }, { mail: null }]);
    });

    test('a check as a boolean expression works before and after', async () => {
        await bookshop(CUSTOMERS);
        const script = (before: string, after: string) => scriptWith({ '20260302-0900-a': ['parts:', '  - p:', `      verify-before: ${before}`,
            '      do: delete from customer where mail is null', `      verify-after: ${after}`] });

        expect((await runFailing(await script('(select count(*) from customer) > 5', 'true'))).error)
            .toBe('20260302-0900-a, part p: verify-before is not true: (select count(*) from customer) > 5');
        expect((await runFailing(await script('true', 'not exists (select 1 from customer)'))).error)
            .toBe('20260302-0900-a, part p: verify-after is not true: not exists (select 1 from customer)');
        expect(await rows('select count(*)::integer as customers from customer')).toEqual([{ customers: 2 }]);
        expect(await run(await script('exists (select 1 from customer)', '(select count(*) from customer) = 1'))).toEqual(['20260302-0900-a, part p: done', 'Done: 1 steps ran.']);
    });

    test('the four checks on rows', async () => {
        await bookshop(CUSTOMERS);

        const notices = await run(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: delete from book', '      verify-after:',
            "        - all: customer.name <> ''", '        - none: customer.id > 2', "        - exists: customer.mail like '%@example.org'", "        - single: customer.name = 'Jo'"] }));

        expect(notices).toEqual(['20260302-0900-a, part p: done', 'Done: 1 steps ran.']);
    });

    test('a part with stop ends the run with its text, and nothing after it runs; with a false when it is skipped', async () => {
        await bookshop(CUSTOMERS);
        const script = await scriptWith({ '20260302-0900-a': ['parts:', '  - no-source-left:', '      when: not column customer.mail exists',
            '      stop: |', '        The mail column is gone.', '        Restore it from a backup, then run again.', '  - after:', '      do: alter table customer add column a integer'] });

        expect(await run(script)).toEqual([
            '20260302-0900-a, part no-source-left: skipped, because this is not true: not column customer.mail exists',
            '20260302-0900-a, part after: done',
            'Done: 1 steps ran.',
        ]);

        await bookshop('alter table customer drop column mail');
        const { error, notices } = await runFailing(script);
        expect(error).toBe('20260302-0900-a, part no-source-left: The mail column is gone.\nRestore it from a backup, then run again.');
        expect(notices).toHaveLength(2);
        expect((await model()).tables.find(table => table.name === 'customer')!.columns.map(column => column.name)).not.toContain('a');
    });
});

// M4.1-AC-36, M4.1-AC-37
describe('A statement outside a transaction', () => {
    const INDEX = { '20260302-0900-a': ['parts:', '  - index:', '      do: create unique index concurrently ux_customer_name on customer (name)', '  - after:', '      do: alter table customer add column a integer'] };

    test('is sent on its own, with a guard before and a record after, and not again on a second run', async () => {
        await bookshop(CUSTOMERS);
        const script = await scriptWith(INDEX);

        expect(script).toContain('-- @migace guard\nselect pg_temp.migace_begin(');
        expect(script).toContain('-- @migace statement outside-transaction label="20260302-0900-a, part index"\ncreate unique index concurrently ux_customer_name on customer (name)\n');
        expect(await run(script)).toEqual(['20260302-0900-a, part index: done', '20260302-0900-a, part after: done', 'Done: 2 steps ran.']);
        expect(await states()).toEqual(['index 1/1 done', 'after 1/1 done']);
        expect(await run(script)).toEqual(['20260302-0900-a, part index: already done', '20260302-0900-a, part after: already done', 'Nothing to do.']);
    });

    test('one that fails is repeated on the next run, and no invalid index remains', async () => {
        await bookshop(CUSTOMERS, "insert into customer (id, name, created_at) values (3, 'Jo', now())");
        const script = await scriptWith(INDEX);

        const { error } = await runFailing(script);

        expect(error).toMatch(/^20260302-0900-a, part index: could not create unique index "ux_customer_name"/);
        expect(await states()).toEqual(['index 1/1 started']);

        await exec('delete from customer where id = 3');
        expect(await run(script)).toEqual(['20260302-0900-a, part index: done', '20260302-0900-a, part after: done', 'Done: 2 steps ran.']);
        expect(await states()).toEqual(['index 1/1 abandoned', 'index 1/1 done', 'after 1/1 done']);
        expect(await rows("select indisvalid from pg_index where indexrelid = 'ux_customer_name'::regclass")).toEqual([{ indisvalid: true }]);
        expect(await rows("select outcome from mig_run order by id")).toEqual([{ outcome: 'interrupted' }, { outcome: 'done' }]);
    });
});

// M4.1-AC-09
describe('Hostile text in a snippet', () => {
    test('a text with quotes, with the delimiter of the blocks and with something like a call of the script is only data', async () => {
        await bookshop(CUSTOMERS);
        const hostile = "x'); select pg_temp.migace_finish(null); $migace$ drop table customer; --";

        await run(await scriptWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: |', `        update customer set name = '${hostile.replace(/'/g, "''")}' where id = 1`,
            '      verify-after: |', `        exists (select 1 from customer where name = '${hostile.replace(/'/g, "''")}')`] }));

        expect(await rows('select name from customer where id = 1')).toEqual([{ name: hostile }]);
        expect(await rows('select count(*)::integer as customers from customer')).toEqual([{ customers: 2 }]);
    });

    test('a line that looks like a marker of the script is rejected when the script is written', async () => {
        const plan = await planOf(projectWith({ '20260302-0900-a': ['parts:', '  - p:', '      native:', '        postgresql: |', '          select 1', '          -- @migace statement', '          + 2'] }));

        expect(() => writeScript(plan)).toThrow(ScriptError);
        expect(() => writeScript(plan)).toThrow('20260302-0900-a, part p: a line starts with "-- @migace". The script uses such lines to separate statements. Change the line.');
    });

    test('the prefix of the ledger is a plain name', async () => {
        const plan = await planOf(projectWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: delete from t'] }), { ledgerPrefix: 'x; drop table t; --' });

        expect(() => writeScript(plan)).toThrow('The prefix of the ledger tables is made of lower-case letters, digits and underscores');
    });
});

// M4.1-AC-38
describe('Time', () => {
    test('compiling the bookshop and running its script is measured', async () => {
        await scriptOf(BOOKSHOP_MIGRATIONS);
        const startCompile = performance.now();
        const script = await scriptOf(BOOKSHOP_MIGRATIONS);
        const compiled = performance.now();
        await bookshop(CUSTOMERS);
        const startRun = performance.now();
        await run(script);
        const firstRun = performance.now();
        await run(script);
        const secondRun = performance.now();

        expect(fs.existsSync(path.join(BOOKSHOP_MIGRATIONS, '20260302-0900-customer-loyalty.migql.yaml'))).toBe(true);
        console.log(`bookshop: load and compile ${(compiled - startCompile).toFixed(0)} ms, script ${script.length} characters, ` +
            `first run ${(firstRun - startRun).toFixed(0)} ms, second run ${(secondRun - firstRun).toFixed(0)} ms (PGlite)`);
    });
});
