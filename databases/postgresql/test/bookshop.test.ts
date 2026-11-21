import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { canonicalForm, compare, differencesText, fingerprint } from '@migace/core';
import { createDatabase } from './support.js';

const SCHEMA_FOLDER = fileURLToPath(new URL('../../../examples/bookshop/schema', import.meta.url));
const GOLDEN = fileURLToPath(new URL('./golden', import.meta.url));

const { schemaWith, read } = createDatabase();

/** The schema files of the bookshop in the order of their names. */
function schemaFiles(): Array<{ name: string, sql: string }> {
    return fs.readdirSync(SCHEMA_FOLDER).filter(file => file.endsWith('.sql')).sort()
        .map(name => ({ name, sql: fs.readFileSync(path.join(SCHEMA_FOLDER, name), 'utf8') }));
}

/** Builds the bookshop in a new schema. One piece of text in the files can be replaced before. */
async function bookshop(change?: { from: string, to: string }): Promise<string> {
    const files = schemaFiles().map(file => file.sql);
    if (change) {
        expect(files.filter(sql => sql.includes(change.from))).toHaveLength(1);
    }
    return schemaWith(...files.map(sql => (change ? sql.replace(change.from, change.to) : sql)));
}

describe('The schema of the bookshop', () => {
    // M2-AC-20
    test('its files run in the order of their names on an empty database', async () => {
        expect(schemaFiles().map(file => file.name)).toEqual([
            '101-generated.sql', '102-indexes.sql', '103-search.sql', '110-views.sql', '120-functions.sql',
        ]);

        const model = await read(await bookshop());

        expect(model.tables.map(table => table.name)).toEqual(['book', 'customer', 'order_item', 'orders']);
    });

    // M2-AC-21
    test('its model in canonical form is the golden file', async () => {
        const model = await read(await bookshop());

        await expect(canonicalForm(model)).toMatchFileSnapshot(path.join(GOLDEN, 'bookshop-model.txt'));
    });

    // M2-AC-03, M2-AC-11
    test('two databases built from the same files have the same fingerprint', async () => {
        const first = await read(await bookshop());
        const second = await read(await bookshop());

        expect(compare(first, second)).toEqual([]);
        expect(fingerprint(second)).toBe(fingerprint(first));
    });

    // M2-AC-02, M2-AC-03
    test('the order of the columns and of the statements does not change the fingerprint', async () => {
        const expected = await read(await schemaWith(
            'create table customer (id bigint primary key, name varchar(100) not null)',
            'create table orders (id bigint primary key, customer_id bigint references customer, total_cents integer)',
            'create index ix_orders_customer on orders (customer_id)'));
        const otherOrder = await read(await schemaWith(
            'create table orders (total_cents integer, id bigint primary key, customer_id bigint)',
            'create index ix_orders_customer on orders (customer_id)',
            'create table customer (name varchar(100) not null, id bigint primary key)',
            'alter table orders add constraint orders_customer_id_fkey foreign key (customer_id) references customer'));

        expect(differencesText(compare(expected, otherOrder))).toBe('');
        expect(fingerprint(otherOrder)).toBe(fingerprint(expected));
    });
});

// M2-AC-06, M2-AC-22
describe('One changed statement in the schema files', () => {
    test.each([
        ['a-column-is-longer', { from: 'title       varchar(200)  not null,', to: 'title       varchar(300)  not null,' }],
        ['a-column-is-missing', { from: '  stock       integer       not null,\n', to: '' }],
        ['an-index-has-another-name', { from: 'create index ix_orders_customer on orders', to: 'create index orders_customer_idx on orders' }],
        ['a-view-has-another-column', { from: 'sum(o.total_cents) as total_cents', to: 'max(o.created_at) as last_order_at' }],
        ['a-foreign-key-is-missing', { from: 'book_id     bigint        not null references book,', to: 'book_id     bigint        not null,' }],
        ['a-trigger-fires-less-often', { from: 'after insert or update or delete on order_item', to: 'after insert or delete on order_item' }],
    ])('%s: the comparison reports exactly that change', async (name, change) => {
        const expected = await read(await bookshop());
        const actual = await read(await bookshop(change));

        const differences = compare(expected, actual);

        await expect(differencesText(differences)).toMatchFileSnapshot(path.join(GOLDEN, 'differences', `${name}.txt`));
        expect(differences).toHaveLength(1);
        expect(fingerprint(actual)).not.toBe(fingerprint(expected));
    });
});

// M2-AC-24
describe('Time to read and compare', () => {
    test('the bookshop schema is measured', async () => {
        const first = await bookshop();
        const second = await bookshop();
        await read(first);

        const start = performance.now();
        const expected = await read(first);
        const afterFirstRead = performance.now();
        const actual = await read(second);
        const afterSecondRead = performance.now();
        const differences = compare(expected, actual);
        fingerprint(expected);
        const end = performance.now();

        expect(differences).toEqual([]);
        console.log(`bookshop schema on PGlite: read ${(afterFirstRead - start).toFixed(1)} ms and ${(afterSecondRead - afterFirstRead).toFixed(1)} ms, ` +
            `compare and fingerprint ${(end - afterSecondRead).toFixed(2)} ms`);
    });
});
