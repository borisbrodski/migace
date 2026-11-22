import { describe, expect, test } from 'vitest';
import { canonicalForm, compare, differencesText, namesThatDifferOnlyInCase, type SchemaModel } from '../src/index.js';
import { bookshop, table } from './bookshop-model.js';

const EMPTY: SchemaModel = { tables: [], sequences: [], views: [], routines: [], enums: [], domains: [], extensions: [] };

const column = (name: string) => ({ name, type: 'text', nullable: true });

// M3.1-AC-19
describe('Order of names', () => {
    test('depends on the characters only: upper case comes before lower case', () => {
        const model: SchemaModel = { ...EMPTY, tables: [table('t', [column('email'), column('eMail'), column('Email'), column('_x'), column('Zip'), column('a1')])] };

        const names = [...canonicalForm(model).matchAll(/^column t\.(.*)$/gm)].map(match => match[1]);

        expect(names).toEqual(['Email', 'Zip', '_x', 'a1', 'eMail', 'email']);
    });

    test('tables are ordered the same way', () => {
        const model: SchemaModel = { ...EMPTY, tables: [table('orders', []), table('Orders', []), table('ORDERS', [])] };

        expect([...canonicalForm(model).matchAll(/^table (.*)$/gm)].map(match => match[1])).toEqual(['ORDERS', 'Orders', 'orders']);
    });
});

/** The differences between the bookshop and the bookshop after a change, as text. */
function after(change: (model: SchemaModel) => void): string {
    const changed = bookshop();
    change(changed);
    return differencesText(compare(bookshop(), changed));
}

// M3.1-AC-23
describe('Comparison: names that differ only in case', () => {
    test('a column under a name in another case is one difference', () => {
        expect(after(model => { model.tables[0].columns[2].name = 'Mail'; })).toBe(
            'different   column customer.mail: name: expected mail, actual Mail (the names differ only in case)\n');
    });

    test('a column in another case with another definition is a missing and an unexpected column', () => {
        expect(after(model => { model.tables[0].columns[2] = { name: 'Mail', type: 'text', nullable: true }; })).toBe(
            'unexpected  column customer.Mail\nmissing     column customer.mail\n');
    });

    test('a table under a name in another case is one difference, and its columns are not listed', () => {
        expect(after(model => {
            model.tables[1].name = 'ORDERS';
        })).toBe('different   table orders: name: expected orders, actual ORDERS (the names differ only in case)\n');
    });

    test('a table in another case with another column is reported as two tables', () => {
        expect(after(model => {
            model.tables[1].name = 'Orders';
            model.tables[1].columns.pop();
        })).toBe('unexpected  table Orders\nmissing     table orders\n');
    });

    test.each<[string, (model: SchemaModel) => void, string]>([
        ['a constraint', model => { model.tables[1].checks[0].name = 'CK_Orders_Total'; },
            'different   check constraint orders.ck_orders_total: name: expected ck_orders_total, actual CK_Orders_Total (the names differ only in case)\n'],
        ['an index', model => { model.tables[1].indexes[0].name = 'IX_ORDERS_CUSTOMER'; },
            'different   index orders.ix_orders_customer: name: expected ix_orders_customer, actual IX_ORDERS_CUSTOMER (the names differ only in case)\n'],
        ['a sequence', model => { model.sequences[0].name = 'Bookshop_Seq'; },
            'different   sequence bookshop_seq: name: expected bookshop_seq, actual Bookshop_Seq (the names differ only in case)\n'],
    ])('%s under a name in another case is one difference', (_what, change, text) => {
        expect(after(change)).toBe(text);
    });

    test('a constraint with another name that differs in more than case has no remark', () => {
        expect(after(model => { model.tables[1].checks[0].name = 'orders_total_check'; })).toBe(
            'different   check constraint orders.ck_orders_total: name: expected ck_orders_total, actual orders_total_check\n');
    });
});

// M3.1-AC-24
describe('Names that differ only in case', () => {
    test('are listed with their place', () => {
        const model: SchemaModel = {
            ...EMPTY,
            tables: [
                table('Customer', [column('Email'), column('email'), column('EMAIL'), column('Name')]),
                table('customer', [column('Name'), column('id')]),
                table('orders', [column('id')]),
            ],
            sequences: [
                { name: 'Seq', type: 'bigint', start: '1', increment: '1', min: '1', max: '9', cache: '1', cycle: false },
                { name: 'seq', type: 'bigint', start: '1', increment: '1', min: '1', max: '9', cache: '1', cycle: false },
            ],
        };

        expect(namesThatDifferOnlyInCase(model)).toEqual([
            { kind: 'sequence', names: ['Seq', 'seq'] },
            { kind: 'table', names: ['Customer', 'customer'] },
            { kind: 'column', table: 'Customer', names: ['EMAIL', 'Email', 'email'] },
        ]);
    });

    test('a schema without such names gives nothing', () => {
        expect(namesThatDifferOnlyInCase(bookshop())).toEqual([]);
    });
});
