import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModule, parseSync } from 'libpg-query';
import { beforeAll, describe, expect, test } from 'vitest';
import { compare, differencesText, fingerprint } from '@migace/core';
import { BOOKSHOP_MIGRATIONS, createScriptDatabase, scriptOf } from './support.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const { bookshop, run, model, rows } = createScriptDatabase();

beforeAll(() => loadModule());

/** A few customers and orders, as a shop of release 1.0.0 has them. */
const DATA = `
    insert into customer (id, name, mail, created_at) values (1, 'Maria', 'maria@example.org', now()), (2, 'Jo', null, now());
    insert into book (id, title, author, price_cents, stock) values (1, 'The Trial', 'Franz Kafka', 990, 3);
    insert into orders (id, customer_id, status, created_at, total_cents) values
        (1, 1, 'SHIPPED', timestamp '2026-01-10 10:00', 990), (2, 1, 'shipped ', timestamp '2026-02-01 09:00', 990), (3, 2, 'no idea', timestamp '2026-02-02 09:00', 0);`;

// M4.1-AC-07, M4.1-AC-08, M4.1-AC-10
describe('The script of the bookshop', () => {
    test('is the committed expected file, the same every time, with LF line endings', async () => {
        const first = await scriptOf(BOOKSHOP_MIGRATIONS);
        const second = await scriptOf(BOOKSHOP_MIGRATIONS);

        expect(second).toBe(first);
        expect(first).not.toContain('\r');
        expect(first.split('\n')[0]).toBe('-- @migace script format=1');
        await expect(first).toMatchFileSnapshot(path.join(HERE, 'bookshop-script.sql'));
    });

    test('every statement is accepted by PostgreSQL\'s own parser, and nothing is a command of one client', async () => {
        const script = await scriptOf(BOOKSHOP_MIGRATIONS);
        const statements = script.split(/^-- @migace .*$/m).slice(1).map(text => text.trim()).filter(text => text.length > 0);

        expect(statements.length).toBeGreaterThan(40);
        for (const statement of statements) {
            expect(parseSync(statement).stmts, statement).toHaveLength(1);
        }
        expect(script).not.toMatch(/^\\/m);
        expect(script).not.toMatch(/:'?\w+'?(?=\s|$)(?<!::\w+)(?<=\s:\w+)/m);
    });
});

// M4.1-AC-18, M4.1-AC-19, M4.1-AC-24
describe('A run of the bookshop script', () => {
    test('runs every part once and in order, and a second run has nothing to do', async () => {
        await bookshop(DATA);
        const before = await model();
        const script = await scriptOf(BOOKSHOP_MIGRATIONS);

        const firstRun = await run(script);

        await expect(firstRun.join('\n') + '\n').toMatchFileSnapshot(path.join(HERE, 'bookshop-first-run.txt'));
        const after = await model();
        await expect(differencesText(compare(before, after))).toMatchFileSnapshot(path.join(HERE, 'bookshop-changes.txt'));
        expect(await rows('select id, status_id, ship_by::text as ship_by from orders order by id')).toEqual([
            { id: 1, status_id: 3, ship_by: '2026-01-13' }, { id: 2, status_id: 3, ship_by: '2026-02-04' }, { id: 3, status_id: 5, ship_by: '2026-02-05' },
        ]);
        expect(await rows('select loyalty_level, email from customer order by id')).toEqual([
            { loyalty_level: 'BRONZE', email: 'maria@example.org' }, { loyalty_level: 'BRONZE', email: null },
        ]);

        const secondRun = await run(script);

        await expect(secondRun.join('\n') + '\n').toMatchFileSnapshot(path.join(HERE, 'bookshop-second-run.txt'));
        expect(fingerprint(await model())).toBe(fingerprint(after));
        expect(await rows('select outcome from mig_run order by id')).toEqual([{ outcome: 'done' }, { outcome: 'nothing to do' }]);
    });
});
