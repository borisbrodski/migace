import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { canonicalForm, compare, fingerprint, namesThatDifferOnlyInCase } from '@migace/core';
import { createDatabase } from './support.js';

const GOLDEN = fileURLToPath(new URL('./golden', import.meta.url));

const { schemaWith, read } = createDatabase();

function schemaFiles(example: string): string[] {
    const folder = fileURLToPath(new URL(`../../../examples/${example}/schema`, import.meta.url));
    return fs.readdirSync(folder).filter(file => file.endsWith('.sql')).sort().map(file => fs.readFileSync(path.join(folder, file), 'utf8'));
}

const mixedCase = async () => read(await schemaWith(...schemaFiles('bookshop-mixed-case')));
const plain = async () => read(await schemaWith(...schemaFiles('bookshop')));

// M3.1-AC-17, M3.1-AC-18
describe('The bookshop with names in mixed case', () => {
    test('the model has the names exactly as the schema files write them', async () => {
        const model = await mixedCase();

        expect(model.tables.map(table => table.name)).toEqual(['Book', 'Customer', 'Order', 'OrderItem']);
        expect(model.tables[0].columns.map(column => column.name)).toEqual(['Id', 'Title', 'title', 'Author', 'PriceCents', 'Stock']);
        expect(model.sequences.map(sequence => sequence.name)).toEqual(['BookshopSeq']);
        expect(model.views.map(view => view.name)).toEqual(['V_OrderTotals']);
        expect(model.routines.map(routine => routine.name)).toEqual(['RefreshOrderTotal']);
        expect(model.tables[3].triggers).toEqual([{
            name: 'TRG_OrderItem_Total', timing: 'after', events: ['insert', 'delete', 'update'], level: 'row', function: 'RefreshOrderTotal()',
        }]);
        expect(model.tables[2].foreignKeys).toEqual([{
            name: 'Order_CustomerId_fkey', columns: ['CustomerId'], target: 'Customer', targetColumns: ['Id'], onUpdate: 'no action', onDelete: 'no action',
        }]);
        expect(model.tables[2].indexes).toEqual([{ name: 'IX_Order_Customer', unique: false, method: 'btree', columns: ['"CustomerId"'] }]);
    });

    test('its model in canonical form is the golden file', async () => {
        await expect(canonicalForm(await mixedCase())).toMatchFileSnapshot(path.join(GOLDEN, 'bookshop-mixed-case-model.txt'));
    });

    test('reading it twice gives the same fingerprint, which is not the one of the plain bookshop', async () => {
        const first = await mixedCase();
        const second = await mixedCase();

        expect(compare(first, second)).toEqual([]);
        expect(fingerprint(second)).toBe(fingerprint(first));
        expect(fingerprint(first)).not.toBe(fingerprint(await plain()));
    });

    // M3.1-AC-24
    test('has one pair of names that differ only in case, the plain bookshop has none', async () => {
        expect(namesThatDifferOnlyInCase(await mixedCase())).toEqual([{ kind: 'column', table: 'Book', names: ['Title', 'title'] }]);
        expect(namesThatDifferOnlyInCase(await plain())).toEqual([]);
    });

    // M3.1-AC-23
    test('a schema with one table in another case is one difference', async () => {
        const expected = await read(await schemaWith('create table "Customer" ("Id" bigint primary key, "Email" varchar(255))'));
        const actual = await read(await schemaWith('create table customer ("Id" bigint primary key, "Email" varchar(255))'));

        expect(compare(expected, actual)).toEqual([{
            kind: 'different', object: 'table Customer', property: 'name', expected: 'Customer', actual: 'customer', note: 'the names differ only in case',
        }]);
    });
});
