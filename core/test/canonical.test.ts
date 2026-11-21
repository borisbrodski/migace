import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { canonicalForm, fingerprint, type SchemaModel } from '../src/index.js';
import { bookshop, table } from './bookshop-model.js';

// M2-AC-01, M2-AC-13
describe('Canonical form', () => {
    test('is readable text with every object and its properties, in a fixed order', () => {
        expect(canonicalForm(bookshop())).toBe(`extension pg_trgm

enum type loyalty_level
  labels: BRONZE, SILVER, GOLD

domain cents
  check cents_check: (VALUE >= 0)
  nullable: no
  type: integer

sequence bookshop_seq
  cache: 1
  cycle: no
  increment: 50
  max: 9223372036854775807
  min: 1
  start: 1
  type: bigint

table customer
  comment: People who buy books

column customer.id
  nullable: no
  type: bigint

column customer.mail
  comment: The e-mail address
  nullable: yes
  type: character varying
  type details: 255

column customer.name
  nullable: no
  type: character varying
  type details: 100

primary key customer.customer_pkey
  columns: id

unique constraint customer.uq_customer_mail
  columns: mail

table orders

column orders.customer_id
  nullable: no
  type: bigint

column orders.id
  identity: by default
  nullable: no
  type: bigint

column orders.status
  default: 'OPEN'::character varying
  nullable: no
  type: character varying
  type details: 20

column orders.total_cents
  nullable: no
  type: integer

primary key orders.orders_pkey
  columns: id

foreign key orders.fk_orders_customer
  columns: customer_id
  on delete: cascade
  on update: no action
  references: customer (id)

check constraint orders.ck_orders_total
  expression: (total_cents >= 0)

index orders.ix_orders_customer
  columns: customer_id
  method: btree
  unique: no

trigger orders.trg_orders_total
  events: insert, update
  function: refresh_order_total()
  level: row
  timing: after

view v_order_totals
  definition:
    | SELECT customer_id,
    |    count(*) AS orders
    |   FROM orders o
    |  GROUP BY customer_id;

function refresh_order_total()
  body:
    |
    |begin
    |  return null;
    |end 
  language: plpgsql
  returns: trigger
`);
    });

    // M2-AC-02
    test('does not depend on the order of the columns of a table', () => {
        const reordered = bookshop();
        reordered.tables[0].columns.reverse();

        expect(canonicalForm(reordered)).toBe(canonicalForm(bookshop()));
    });

    test('keeps the order where the order means something', () => {
        const model: SchemaModel = { ...bookshop(), tables: [table('t', [], { primaryKey: { name: 'pk', columns: ['b', 'a'] } })] };

        expect(canonicalForm(model)).toContain('primary key t.pk\n  columns: b, a\n');
    });
});

/** The same model with every list in another order, except the lists whose order has a meaning. */
function shuffled(model: SchemaModel, random: (length: number) => number): SchemaModel {
    const shuffle = <T>(items: T[]): T[] => {
        const result = [...items];
        for (let index = result.length - 1; index > 0; index--) {
            const other = random(index + 1);
            [result[index], result[other]] = [result[other], result[index]];
        }
        return result;
    };
    return {
        tables: shuffle(model.tables).map(each => ({
            ...each,
            columns: shuffle(each.columns),
            uniques: shuffle(each.uniques),
            foreignKeys: shuffle(each.foreignKeys),
            checks: shuffle(each.checks),
            indexes: shuffle(each.indexes),
            triggers: shuffle(each.triggers),
        })),
        sequences: shuffle(model.sequences),
        views: shuffle(model.views),
        routines: shuffle(model.routines),
        enums: shuffle(model.enums),
        domains: shuffle(model.domains).map(each => ({ ...each, checks: shuffle(each.checks) })),
        extensions: shuffle(model.extensions),
    };
}

describe('Fingerprint', () => {
    // M2-AC-10
    test('is the SHA-256 hash of the canonical form, written as 64 hexadecimal digits', async () => {
        const { createHash } = await import('node:crypto');

        expect(fingerprint(bookshop())).toBe(createHash('sha256').update(canonicalForm(bookshop())).digest('hex'));
        expect(fingerprint(bookshop())).toMatch(/^[0-9a-f]{64}$/);
    });

    // M2-AC-03, M2-AC-11
    test('is the same for the same schema, whatever the order of its objects and columns', () => {
        const expected = fingerprint(bookshop());

        fc.assert(fc.property(fc.infiniteStream(fc.nat()), numbers => {
            const iterator = numbers[Symbol.iterator]();
            const model = shuffled(bookshop(), length => (iterator.next().value as number) % length);

            expect(fingerprint(model)).toBe(expected);
        }), { seed: 20261121, numRuns: 200 });
    });
});
