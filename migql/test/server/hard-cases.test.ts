import type pg from 'pg';
import { describe, expect, test } from 'vitest';
import { compare, differencesText } from '@migace/core';
import { runScript } from '@migace/postgresql';
import { BOOKSHOP_MIGRATIONS, scriptOf, scriptWith } from '../script/support.js';
import { executeOn, RUN_PARAMETERS, useServer } from './support.js';

const { bookshop, connect, run, rows, model, server } = useServer();

const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

/** Every step of every part that the ledger knows, with the number of its successful rows. */
const doneRows = (database: string) => rows(database,
    "select snippet_name, part, step, count(*) filter (where state = 'done')::integer as done from mig_part_run group by 1, 2, 3 order by 1, 2, 3");

async function failure(run: Promise<unknown>): Promise<string> {
    try {
        await run;
    } catch (error) {
        return (error as Error).message;
    }
    throw new Error('The run did not fail.');
}

// M4.2-AC-10
describe('Two runs at the same time', () => {
    test('do not disturb each other: the second waits for the lock and finds nothing to do', async () => {
        const database = await bookshop();
        const script = await scriptWith({
            '20260302-0900-a': ['parts:', '  - slow:', '      native:', '        postgresql: select pg_sleep(0.5)', '  - column:', '      do: alter table customer add column a integer'],
            '20260303-0900-b': ['parts:', '  - index:', '      do: create index concurrently ix_customer_a on customer (a)'],
        });

        const [first, second] = await Promise.all([run(database, script), run(database, script)]);

        expect([first, second].filter(notices => notices.includes('Nothing to do.'))).toHaveLength(1);
        expect([first, second].filter(notices => notices.includes('Done: 3 steps ran.'))).toHaveLength(1);
        expect((await doneRows(database)).map(row => row.done)).toEqual([1, 1, 1]);
        expect((await rows(database, 'select outcome from mig_run order by id')).map(row => row.outcome)).toEqual(['done', 'nothing to do']);
    });

    // M4.4-AC-05
    test('on two schemas they do not wait for each other; on the same schema they do', async () => {
        // Two names with the same hashtext('migace ' || name): a lock made from a hash of the name would be shared.
        const [first, second] = ['tenant_28465', 'tenant_132194'];
        const database = await bookshop();
        const admin = await connect(database);
        await admin.query(`create schema ${first}; create table ${first}.customer (id bigint primary key);
            create schema ${second}; create table ${second}.customer (id bigint primary key)`);
        const slow = await scriptWith({ '20260302-0900-a': ['parts:', '  - slow:', '      native:', '        postgresql: select pg_sleep(2)'] });
        const quick = await scriptWith({ '20260302-0900-b': ['parts:', '  - quick:', '      do: alter table customer add column a integer'] });
        const timed = async (running: Promise<unknown>) => {
            await running;
            return performance.now();
        };

        const started = performance.now();
        const slowEnd = timed(run(database, slow, { schema: first }));
        await sleep(300);
        const [onOtherSchema, onSameSchema] = await Promise.all([
            timed(run(database, quick, { schema: second })),
            timed(run(database, quick, { schema: first })),
        ]);

        expect(onOtherSchema - started).toBeLessThan(1500);
        expect(onSameSchema).toBeGreaterThanOrEqual(await slowEnd);
    });
});

// M4.2-AC-11
describe('A run whose connection is closed', () => {
    test('after any statement of the bookshop script: the next run ends with the same model, and every part is done once', async () => {
        const script = await scriptOf(BOOKSHOP_MIGRATIONS);
        const reference = await bookshop();
        let statements = 0;
        const counting = await connect(reference);
        await runScript(script, async (sql, onNotice) => { statements++; return executeOn(counting)(sql, onNotice); }, { parameters: RUN_PARAMETERS });
        const expectedModel = await model(reference);
        const expectedDone = await doneRows(reference);
        expect(statements).toBeGreaterThan(50);

        for (let last = 1; last < statements; last++) {
            const database = await bookshop();
            const client = await connect(database);
            let sent = 0;
            await runScript(script, async (sql, onNotice) => {
                if (sent === last) {
                    await client.end();
                    throw new Error('connection closed by the test');
                }
                sent++;
                return executeOn(client)(sql, onNotice);
            }, { parameters: RUN_PARAMETERS }).catch(() => undefined);

            await run(database, script);

            expect(differencesText(compare(expectedModel, await model(database))), `closed after statement ${last}`).toBe('');
            expect(await doneRows(database), `closed after statement ${last}`).toEqual(expectedDone);
        }
    });

    // M4.2-AC-12
    test('by the server in the middle of a long statement: the next run does the statement again', async () => {
        const database = await bookshop();
        const script = await scriptWith({ '20260302-0900-a': [
            'parts:', '  - before:', '      do: alter table customer add column a integer',
            '  - long:', '      native:', '        postgresql: update book set stock = stock + 1 + coalesce((select 0 from pg_sleep((select case when count(*) = 0 then 30 else 0 end from orders where total_cents = 1))), 0)',
            '  - after:', '      do: alter table customer add column b integer',
        ] });
        const running = connect(database).then(async client => {
            const result = failure(runScript(script, executeOn(client), { parameters: RUN_PARAMETERS }));
            return result;
        });
        const killer = await connect(database);
        let ended = 0;
        while (ended === 0) {
            await sleep(100);
            ended = (await killer.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = current_database() and query like '%migace_step%pg_sleep%' and pid <> pg_backend_pid() and state = 'active'")).rowCount ?? 0;
        }

        expect(await running).toMatch(/terminat|Connection terminated/i);
        expect(await rows(database, 'select stock from book')).toEqual([{ stock: 3 }]);
        expect((await rows(database, 'select part, state from mig_part_run order by id')).map(row => `${row.part} ${row.state}`)).toEqual(['before done']);

        await killer.query('update orders set total_cents = 1 where id = 3');
        expect(await run(database, script)).toEqual([
            '20260302-0900-a, part before: already done', '20260302-0900-a, part long: done', '20260302-0900-a, part after: done', 'Done: 2 steps ran.',
        ]);
        expect(await rows(database, 'select stock from book')).toEqual([{ stock: 4 }]);
        expect((await rows(database, 'select outcome from mig_run order by id')).map(row => row.outcome)).toEqual(['interrupted', 'done']);
    });
});

/** A session that holds a lock on a table that blocks every change of the table, until `release` is called. */
async function lockedBy(database: string, table: string): Promise<{ release: () => Promise<void> }> {
    const holder: pg.Client = await connect(database);
    await holder.query(`begin; lock table ${table} in access exclusive mode`);
    return { release: async () => { await holder.query('commit'); } };
}

// M4.2-AC-13, M4.2-AC-14, M4.2-AC-15
describe('A lock that another session holds', () => {
    const COLUMN = { '20260302-0900-a': ['parts:', '  - column:', '      do: alter table customer add column a integer', '  - after:', '      do: alter table book add column b integer'] };
    const QUICK = { lock_timeout: '300ms', lock_wait: '200ms' };

    test('a step gives up after the time limit, waits and tries again; when the lock is released it succeeds', async () => {
        const database = await bookshop();
        const lock = await lockedBy(database, 'customer');
        const script = await scriptWith(COLUMN);

        const running = run(database, script, { ...QUICK, lock_attempts: '20' });
        await sleep(900);
        await lock.release();
        const notices = await running;

        expect(notices[0]).toBe('20260302-0900-a, part column: no lock within 300ms, attempt 1 of 20. Locked by another session: customer');
        expect(notices.slice(-3)).toEqual(['20260302-0900-a, part column: done', '20260302-0900-a, part after: done', 'Done: 2 steps ran.']);
        const attempts = (await rows(database, "select state from mig_part_run where part = 'column' order by id")).map(row => row.state);
        expect(attempts.length).toBeGreaterThanOrEqual(2);
        expect(attempts.slice(0, -1).every(state => state === 'no lock')).toBe(true);
        expect(attempts[attempts.length - 1]).toBe('done');
    });

    test('when every attempt fails, the run ends with a failure that names the snippet, the part and the table; the next run repeats the step', async () => {
        const database = await bookshop();
        const lock = await lockedBy(database, 'customer');
        const script = await scriptWith(COLUMN);

        const message = await failure(run(database, script, { ...QUICK, lock_attempts: '2' }));

        expect(message).toBe('20260302-0900-a, part column: no lock within 300ms, attempt 2 of 2. Locked by another session: customer');
        expect((await rows(database, 'select part, state, error_code from mig_part_run order by id')).map(row => `${row.part} ${row.state} ${row.error_code}`))
            .toEqual(['column no lock 55P03', 'column failed 55P03']);
        expect((await model(database)).tables.find(table => table.name === 'book')!.columns.map(column => column.name)).not.toContain('b');

        await lock.release();
        expect(await run(database, script, QUICK)).toEqual(['20260302-0900-a, part column: done', '20260302-0900-a, part after: done', 'Done: 2 steps ran.']);
    });

    test('the limits have defaults', async () => {
        const script = await scriptWith(COLUMN);

        expect(script).toContain("pg_temp.migace_setting('lock_timeout', '5s')");
        expect(script).toContain("pg_temp.migace_setting('lock_attempts', '3')");
        expect(script).toContain("pg_temp.migace_setting('lock_wait', '1s')");
    });
});

// M4.4-AC-09
describe('A session that is used again', () => {
    test('fails outside a transaction and stays open; a second session runs the corrected script without waiting; then the first finds nothing to do', async () => {
        const database = await bookshop();
        const broken = await scriptWith({ '20260302-0900-a': ['parts:', '  - index:', '      do: create index concurrently ix_customer_x on customer (no_such_column)'] });
        const corrected = await scriptWith({ '20260302-0900-a': ['parts:', '  - index:', '      do: create index concurrently ix_customer_x on customer (name)'] });
        const first = await connect(database);
        const second = await connect(database);
        const notices = (client: pg.Client, script: string) => {
            const received: string[] = [];
            return runScript(script, executeOn(client), { parameters: RUN_PARAMETERS, onNotice: notice => received.push(notice) }).then(() => received);
        };

        expect(await failure(runScript(broken, executeOn(first), { parameters: RUN_PARAMETERS })))
            .toBe('20260302-0900-a, part index: column "no_such_column" does not exist');
        const started = performance.now();
        // The try of the first session is abandoned; what it may have left is removed first.
        expect(await notices(second, corrected)).toEqual(['index "ix_customer_x" does not exist, skipping', '20260302-0900-a, part index: done', 'Done: 1 steps ran.']);
        expect(performance.now() - started).toBeLessThan(3000);
        expect(await notices(first, corrected)).toEqual(['20260302-0900-a, part index: already done', 'Nothing to do.']);
        expect((await first.query("select current_setting('search_path') as path")).rows).toEqual([{ path: '"$user", public' }]);
    });
});

// M4.2-AC-16, M4.2-AC-17
describe('A statement outside a transaction on a real server', () => {
    const INDEX = { '20260302-0900-a': ['parts:', '  - index:', '      do: create index concurrently ix_customer_name on customer (name)'] };

    test('PostgreSQL refuses it inside a transaction, and the script sends it on its own', async () => {
        const database = await bookshop();
        const client = await connect(database);
        await client.query('begin');
        await expect(client.query('create index concurrently ix_inside on customer (name)')).rejects.toThrow('CREATE INDEX CONCURRENTLY cannot run inside a transaction block');
        await client.query('rollback');

        expect(await run(database, await scriptWith(INDEX))).toEqual(['20260302-0900-a, part index: done', 'Done: 1 steps ran.']);
        expect(await rows(database, "select indisvalid from pg_index where indexrelid = 'ix_customer_name'::regclass")).toEqual([{ indisvalid: true }]);
    });

    test('one whose session is ended in the middle leaves an invalid index; the next run removes it and builds the index', async () => {
        const database = await bookshop();
        const script = await scriptWith(INDEX);
        // An open transaction that wrote to the table makes the index build wait after it has created the index entry.
        const writer = await connect(database);
        await writer.query("begin; update customer set name = name || '!' where id = 1");
        const runner = await connect(database);
        const running = failure(runScript(script, executeOn(runner), { parameters: RUN_PARAMETERS }));
        const killer = await connect(database);
        let invalid = 0;
        while (invalid === 0) {
            await sleep(100);
            invalid = (await killer.query("select 1 from pg_index where indexrelid = to_regclass('ix_customer_name') and not indisvalid")).rowCount ?? 0;
        }
        await killer.query("select pg_terminate_backend(pid) from pg_stat_activity where query like 'create index concurrently%' and pid <> pg_backend_pid()");

        expect(await running).toMatch(/^20260302-0900-a, part index: .*terminat/i);
        await writer.query('commit');
        expect(await rows(database, "select indisvalid from pg_index where indexrelid = 'ix_customer_name'::regclass")).toEqual([{ indisvalid: false }]);
        expect((await rows(database, 'select state from mig_part_run')).map(row => row.state)).toEqual(['started']);

        expect(await run(database, script)).toEqual(['20260302-0900-a, part index: done', 'Done: 1 steps ran.']);
        expect(await rows(database, "select indisvalid from pg_index where indexrelid = 'ix_customer_name'::regclass")).toEqual([{ indisvalid: true }]);
        expect((await rows(database, 'select state from mig_part_run order by id')).map(row => row.state)).toEqual(['abandoned', 'done']);
    });
});

// M4.2-AC-18, M4.2-AC-19
describe('Roles', () => {
    test('the script runs as the owner of the schema, who is no superuser; an application needs read access to the meta table only', async () => {
        const database = await bookshop();
        const admin = await connect(database);
        const suffix = database;
        await admin.query(`
            create role owner_${suffix} login nosuperuser;
            create role app_${suffix} login nosuperuser;
            create schema shop authorization owner_${suffix};`);
        const owner = await connect(database, `owner_${suffix}`);
        await owner.query('create table shop.customer (id bigint primary key, name varchar(100), mail varchar(255))');
        const script = await scriptWith({ '20260302-0900-a': [
            'parts:', '  - mandatory:', '      column-set-not-null: { table: customer, column: name }',
            '  - index:', '      do: create index concurrently ix_customer_name on customer (name)',
        ] }, { fingerprint: 'abc123' });

        const notices: string[] = [];
        await runScript(script, executeOn(owner), { parameters: { schema: 'shop' }, onNotice: notice => notices.push(notice) });

        expect(notices).toEqual(['20260302-0900-a, part mandatory: done', '20260302-0900-a, part index: done', 'Done: 5 steps ran.']);
        expect(await rows(database, `select rolsuper from pg_roles where rolname = 'owner_${suffix}'`)).toEqual([{ rolsuper: false }]);
        expect(await rows(database, "select tableowner from pg_tables where schemaname = 'shop' and tablename = 'mig_meta'")).toEqual([{ tableowner: `owner_${suffix}` }]);

        const application = await connect(database, `app_${suffix}`);
        await expect(application.query("select value from shop.mig_meta where key = 'fingerprint'")).rejects.toThrow('permission denied for schema shop');
        await owner.query(`grant usage on schema shop to app_${suffix}; grant select on shop.mig_meta to app_${suffix}`);
        expect((await application.query("select value from shop.mig_meta where key = 'fingerprint'")).rows).toEqual([{ value: 'abc123' }]);
        await expect(application.query('select * from shop.mig_part_run')).rejects.toThrow('permission denied for table mig_part_run');
        await expect(application.query('select * from shop.customer')).rejects.toThrow('permission denied for table customer');
        expect(server().host).toBe('127.0.0.1');
    });
});
