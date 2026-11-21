import type { SchemaModel, Table } from '../src/index.js';

/** A table with the given columns and nothing else. Tests add what they are about. */
export function table(name: string, columns: Table['columns'], rest: Partial<Table> = {}): Table {
    return { name, columns, uniques: [], foreignKeys: [], checks: [], indexes: [], triggers: [], ...rest };
}

/** A small part of the bookshop schema, written by hand. Every call returns a new model. */
export function bookshop(): SchemaModel {
    return {
        tables: [
            table('customer', [
                { name: 'id', type: 'bigint', nullable: false },
                { name: 'name', type: 'character varying', typeDetails: '100', nullable: false },
                { name: 'mail', type: 'character varying', typeDetails: '255', nullable: true, comment: 'The e-mail address' },
            ], {
                comment: 'People who buy books',
                primaryKey: { name: 'customer_pkey', columns: ['id'] },
                uniques: [{ name: 'uq_customer_mail', columns: ['mail'] }],
            }),
            table('orders', [
                { name: 'id', type: 'bigint', nullable: false, identity: 'by default' },
                { name: 'customer_id', type: 'bigint', nullable: false },
                { name: 'status', type: 'character varying', typeDetails: '20', nullable: false, default: "'OPEN'::character varying" },
                { name: 'total_cents', type: 'integer', nullable: false },
            ], {
                primaryKey: { name: 'orders_pkey', columns: ['id'] },
                foreignKeys: [{
                    name: 'fk_orders_customer', columns: ['customer_id'], target: 'customer', targetColumns: ['id'],
                    onUpdate: 'no action', onDelete: 'cascade',
                }],
                checks: [{ name: 'ck_orders_total', expression: '(total_cents >= 0)' }],
                indexes: [{ name: 'ix_orders_customer', unique: false, method: 'btree', columns: ['customer_id'] }],
                triggers: [{
                    name: 'trg_orders_total', timing: 'after', events: ['insert', 'update'], level: 'row', function: 'refresh_order_total()',
                }],
            }),
        ],
        sequences: [{ name: 'bookshop_seq', type: 'bigint', start: '1', increment: '50', min: '1', max: '9223372036854775807', cache: '1', cycle: false }],
        views: [{ name: 'v_order_totals', definition: ' SELECT customer_id,\n    count(*) AS orders\n   FROM orders o\n  GROUP BY customer_id;' }],
        routines: [{
            kind: 'function', name: 'refresh_order_total', arguments: '', returns: 'trigger', language: 'plpgsql',
            body: '\nbegin\n  return null;\nend ',
        }],
        enums: [{ name: 'loyalty_level', labels: ['BRONZE', 'SILVER', 'GOLD'] }],
        domains: [{ name: 'cents', type: 'integer', nullable: false, checks: [{ name: 'cents_check', expression: '(VALUE >= 0)' }] }],
        extensions: [{ name: 'pg_trgm' }],
    };
}
