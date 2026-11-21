import { describe, expect, test } from 'vitest';
import { compare, differencesText, fingerprint, type SchemaModel } from '../src/index.js';
import { bookshop, table } from './bookshop-model.js';

/** The differences between the bookshop and the bookshop after a change, as text. */
function after(change: (model: SchemaModel) => void): string {
    const changed = bookshop();
    change(changed);
    return differencesText(compare(bookshop(), changed));
}

const customer = (model: SchemaModel) => model.tables[0];
const orders = (model: SchemaModel) => model.tables[1];

describe('Comparison', () => {
    // M2-AC-09
    test('two equal models have no differences', () => {
        expect(compare(bookshop(), bookshop())).toEqual([]);
        expect(differencesText([])).toBe('');
    });

    // M2-AC-05
    test('a difference has a kind, an object, and for a changed property the expected and the actual value', () => {
        const changed = bookshop();
        customer(changed).columns[1].typeDetails = '50';
        customer(changed).columns.pop();
        orders(changed).columns.push({ name: 'note', type: 'text', nullable: true });

        expect(compare(bookshop(), changed)).toEqual([
            { kind: 'missing', object: 'column customer.mail' },
            { kind: 'different', object: 'column customer.name', property: 'type details', expected: '100', actual: '50' },
            { kind: 'unexpected', object: 'column orders.note' },
        ]);
    });

    // M2-AC-06
    test('the differences have a fixed order and a text form', () => {
        expect(after(model => {
            model.views = [];
            orders(model).columns.push({ name: 'note', type: 'text', nullable: true });
            customer(model).columns[1].nullable = true;
            model.extensions.push({ name: 'citext' });
        })).toBe([
            'unexpected  extension citext',
            'different   column customer.name: nullable: expected no, actual yes',
            'unexpected  column orders.note',
            'missing     view v_order_totals',
            '',
        ].join('\n'));
    });

    test('a missing table is one difference, not one per column', () => {
        expect(after(model => model.tables.pop())).toBe('missing     table orders\n');
        expect(after(model => model.tables.push(table('review', [{ name: 'id', type: 'bigint', nullable: false }]))))
            .toBe('unexpected  table review\n');
    });

    // M2-AC-07
    test.each([
        ['a foreign key', (model: SchemaModel) => { orders(model).foreignKeys[0].name = 'orders_customer_id_fkey'; },
            'different   foreign key orders.fk_orders_customer: name: expected fk_orders_customer, actual orders_customer_id_fkey\n'],
        ['a check constraint', (model: SchemaModel) => { orders(model).checks[0].name = 'orders_total_cents_check'; },
            'different   check constraint orders.ck_orders_total: name: expected ck_orders_total, actual orders_total_cents_check\n'],
        ['an index', (model: SchemaModel) => { orders(model).indexes[0].name = 'orders_customer_id_idx'; },
            'different   index orders.ix_orders_customer: name: expected ix_orders_customer, actual orders_customer_id_idx\n'],
        ['a unique constraint', (model: SchemaModel) => { customer(model).uniques[0].name = 'customer_mail_key'; },
            'different   unique constraint customer.uq_customer_mail: name: expected uq_customer_mail, actual customer_mail_key\n'],
        ['a primary key', (model: SchemaModel) => { customer(model).primaryKey!.name = 'pk_customer'; },
            'different   primary key customer.customer_pkey: name: expected customer_pkey, actual pk_customer\n'],
    ])('%s with the same definition and another name is one difference', (_what, change, text) => {
        expect(after(change)).toBe(text);
    });

    test('another name and another definition are a missing and an unexpected object', () => {
        expect(after(model => {
            orders(model).indexes[0] = { name: 'ix_orders_status', unique: false, method: 'btree', columns: ['status'] };
        })).toBe('missing     index orders.ix_orders_customer\nunexpected  index orders.ix_orders_status\n');
    });
});

// M2-AC-08, M2-AC-12
describe('Every single change is found, and it changes the fingerprint', () => {
    test.each<[string, (model: SchemaModel) => void, string]>([
        ['a column added', model => orders(model).columns.push({ name: 'ship_by', type: 'date', nullable: true }),
            'unexpected  column orders.ship_by\n'],
        ['a column removed', model => orders(model).columns.splice(2, 1),
            'missing     column orders.status\n'],
        ['a column with another type', model => { orders(model).columns[3].type = 'bigint'; },
            'different   column orders.total_cents: type: expected integer, actual bigint\n'],
        ['a column with another length', model => { orders(model).columns[2].typeDetails = '10'; },
            'different   column orders.status: type details: expected 20, actual 10\n'],
        ['a column with another nullability', model => { orders(model).columns[2].nullable = true; },
            'different   column orders.status: nullable: expected no, actual yes\n'],
        ['a column with another default', model => { orders(model).columns[2].default = "'NEW'::character varying"; },
            "different   column orders.status: default: expected 'OPEN'::character varying, actual 'NEW'::character varying\n"],
        ['a column without its default', model => { delete orders(model).columns[2].default; },
            "different   column orders.status: default: expected 'OPEN'::character varying, actual nothing\n"],
        ['a column that is no identity any more', model => { delete orders(model).columns[0].identity; },
            'different   column orders.id: identity: expected by default, actual nothing\n'],
        ['a constraint added', model => orders(model).checks.push({ name: 'ck_orders_status', expression: "(status <> ''::text)" }),
            'unexpected  check constraint orders.ck_orders_status\n'],
        ['a constraint removed', model => { orders(model).foreignKeys = []; },
            'missing     foreign key orders.fk_orders_customer\n'],
        ['a check constraint changed', model => { orders(model).checks[0].expression = '(total_cents > 0)'; },
            'different   check constraint orders.ck_orders_total: expression: expected (total_cents >= 0), actual (total_cents > 0)\n'],
        ['a foreign key changed', model => { orders(model).foreignKeys[0].onDelete = 'no action'; },
            'different   foreign key orders.fk_orders_customer: on delete: expected cascade, actual no action\n'],
        ['a primary key changed', model => { orders(model).primaryKey!.columns = ['id', 'customer_id']; },
            'different   primary key orders.orders_pkey: columns: expected id, actual id, customer_id\n'],
        ['an index added', model => orders(model).indexes.push({ name: 'ix_orders_status', unique: false, method: 'btree', columns: ['status'] }),
            'unexpected  index orders.ix_orders_status\n'],
        ['an index removed', model => { orders(model).indexes = []; },
            'missing     index orders.ix_orders_customer\n'],
        ['an index changed', model => { orders(model).indexes[0].unique = true; },
            'different   index orders.ix_orders_customer: unique: expected no, actual yes\n'],
        ['an index with a condition', model => { orders(model).indexes[0].condition = '(total_cents > 0)'; },
            'different   index orders.ix_orders_customer: condition: expected nothing, actual (total_cents > 0)\n'],
        ['a sequence changed', model => { model.sequences[0].increment = '1'; },
            'different   sequence bookshop_seq: increment: expected 50, actual 1\n'],
        ['a view changed', model => { model.views[0].definition = ' SELECT 1;'; },
            'different   view v_order_totals: definition: expected\n    | SELECT customer_id,\n    |    count(*) AS orders\n    |   FROM orders o\n    |  GROUP BY customer_id;\n  actual\n    | SELECT 1;\n'],
        ['a function changed', model => { model.routines[0].body = '\nbegin\n  return new;\nend '; },
            'different   function refresh_order_total(): body: expected\n    |\n    |begin\n    |  return null;\n    |end \n  actual\n    |\n    |begin\n    |  return new;\n    |end \n'],
        ['a trigger changed', model => { orders(model).triggers[0].events = ['insert']; },
            'different   trigger orders.trg_orders_total: events: expected insert, update, actual insert\n'],
        ['a comment on a table changed', model => { customer(model).comment = 'Customers'; },
            'different   table customer: comment: expected People who buy books, actual Customers\n'],
        ['a comment on a column changed', model => { customer(model).columns[2].comment = 'E-mail'; },
            'different   column customer.mail: comment: expected The e-mail address, actual E-mail\n'],
        ['a label of an enum type added', model => model.enums[0].labels.push('PLATINUM'),
            'different   enum type loyalty_level: labels: expected BRONZE, SILVER, GOLD, actual BRONZE, SILVER, GOLD, PLATINUM\n'],
        ['a domain changed', model => { model.domains[0].checks[0].expression = '(VALUE > 0)'; },
            'different   domain cents: check cents_check: expected (VALUE >= 0), actual (VALUE > 0)\n'],
        ['an extension removed', model => { model.extensions = []; },
            'missing     extension pg_trgm\n'],
    ])('%s', (_what, change, text) => {
        const changed = bookshop();
        change(changed);

        expect(differencesText(compare(bookshop(), changed))).toBe(text);
        expect(fingerprint(changed)).not.toBe(fingerprint(bookshop()));
    });
});
