import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { describe, expect, test } from 'vitest';
import { canonicalForm, compare, type Difference, differencesText, fingerprint } from '@migace/core';
import { PostgresqlSchemaReader, runScript } from '@migace/postgresql';
import { BOOKSHOP_MIGRATIONS, scriptOf } from '../script/support.js';
import { DATA, EXTENSIONS, LEDGER, RELEASE_1_0_0, RUN_PARAMETERS, useServer } from './support.js';

const { bookshop, run, rows, model, server } = useServer();

/** The same bookshop on PGlite, in the schema public. */
async function pglite() {
    const database = new PGlite({ extensions: { pg_trgm } });
    for (const sql of [`create schema ${EXTENSIONS}; create extension pg_trgm with schema ${EXTENSIONS}`, ...RELEASE_1_0_0, DATA]) {
        await database.exec(sql);
    }
    const query = async (sql: string, parameters?: unknown[]) => (await database.query<Record<string, unknown>>(sql, parameters)).rows;
    return {
        query,
        major: async () => Number((await query("select current_setting('server_version_num')::integer / 10000 as major"))[0].major),
        model: () => new PostgresqlSchemaReader(query, { schema: 'public' }).read(),
        run: async (script: string) => {
            const notices: string[] = [];
            await runScript(script, async (sql, onNotice) => (await database.query<Record<string, unknown>>(sql, [], { onNotice: notice => onNotice(notice.message ?? '') })).rows,
                { parameters: RUN_PARAMETERS, onNotice: notice => notices.push(notice) });
            return notices;
        },
    };
}

const serverMajor = async (database: string) => Number((await rows(database, "select current_setting('server_version_num')::integer / 10000 as major"))[0].major);

/**
 * PostgreSQL writes the text of a view in its own form, and that form differs between major versions.
 * Two major versions therefore give two fingerprints for the same schema; everything else is the same.
 */
function onlyTextOfViews(differences: Difference[]): boolean {
    return differences.every(difference => difference.kind === 'different' && difference.object.startsWith('view ') && difference.property === 'definition');
}

// M4.2-AC-08
describe('The reader on a real server', () => {
    test('gives the same model and the same fingerprint as on PGlite, if both are the same major version', async () => {
        const database = await bookshop();
        const local = await pglite();
        const onServer = await model(database);
        const onPglite = await local.model();

        if (await serverMajor(database) !== await local.major()) {
            expect(onlyTextOfViews(compare(onPglite, onServer))).toBe(true);
            return;
        }
        expect(differencesText(compare(onPglite, onServer))).toBe('');
        expect(canonicalForm(onServer)).toBe(canonicalForm(onPglite));
        expect(fingerprint(onServer)).toBe(fingerprint(onPglite));
    });
});

// M4.2-AC-07, M4.2-AC-09
describe('The bookshop script on a real server', () => {
    test('runs with the reference runner, and the notices of the server reach the caller', async () => {
        const database = await bookshop();
        const script = await scriptOf(BOOKSHOP_MIGRATIONS);

        const notices = await run(database, script);

        expect(notices[0]).toBe('20260302-0900-customer-loyalty, part add-column: done');
        expect(notices[notices.length - 1]).toBe('Done: 30 steps ran.');
        expect(await run(database, script)).toContain('Nothing to do.');
    });

    test('gives the same model and the same ledger content as on PGlite', async () => {
        const database = await bookshop();
        const local = await pglite();
        const script = await scriptOf(BOOKSHOP_MIGRATIONS);

        const serverNotices = await run(database, script);
        const pgliteNotices = await local.run(script);

        expect(serverNotices).toEqual(pgliteNotices);
        expect(onlyTextOfViews(compare(await local.model(), await model(database)))).toBe(true);
        if (await serverMajor(database) === await local.major()) {
            expect(differencesText(compare(await local.model(), await model(database)))).toBe('');
        }
        expect(await rows(database, LEDGER)).toEqual(await local.query(LEDGER));
        expect(await rows(database, 'select uid, name, state from mig_snippet order by name')).toEqual(await local.query('select uid, name, state from mig_snippet order by name'));
        expect(await rows(database, 'select outcome from mig_run')).toEqual([{ outcome: 'done' }]);
    });

    // M4.2-AC-21
    test('the time to start a server, to copy the prepared database and to run the script is measured', async () => {
        const script = await scriptOf(BOOKSHOP_MIGRATIONS);
        const { startTemporaryServer } = await import('@migace/postgresql');
        const startServer = performance.now();
        const second = await startTemporaryServer();
        const started = performance.now();
        await second.stop();
        const startCopy = performance.now();
        const database = await bookshop();
        const copied = performance.now();
        await run(database, script);
        const firstRun = performance.now();
        await run(database, script);
        const secondRun = performance.now();
        const [{ version }] = await rows(database, "select current_setting('server_version') as version");

        expect(server().port).toBeGreaterThan(0);
        console.log(`PostgreSQL ${version}: start a server ${(started - startServer).toFixed(0)} ms, copy the prepared database ${(copied - startCopy).toFixed(0)} ms, ` +
            `first run of the bookshop script ${(firstRun - copied).toFixed(0)} ms, second run ${(secondRun - firstRun).toFixed(0)} ms`);
    });
});
