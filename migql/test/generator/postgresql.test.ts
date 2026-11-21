import { parseSync, loadModule } from 'libpg-query';
import { beforeAll, describe, expect, test } from 'vitest';
import { generatePart } from '../../generators/postgresql/index.js';
import { partsOf } from '../../src/model/snippet.js';
import { createMigql, lines } from '../support.js';

const { parse, clear } = createMigql();

beforeAll(() => loadModule());

/** The PostgreSQL text of a part whose body is given. */
async function generated(...body: string[]): Promise<string> {
    const document = await parse(lines('migration: 20260302-0900-x', 'parts:', '  - p:', ...body.map(line => '      ' + line)));
    expect(document).toHaveNoErrors();
    return generatePart(partsOf(document.parseResult.value)[0]);
}

async function statement(...text: string[]): Promise<string> {
    return generated('do: |', ...text.map(line => '  ' + line));
}

describe('PostgreSQL: schema statements', () => {
    test.each([
        ['alter table customer add column loyalty_level varchar(10)', 'alter table customer add column loyalty_level varchar(10);'],
        ['alter table orders drop column status', 'alter table orders drop column status;'],
        ['alter table customer alter column loyalty_level drop not null', 'alter table customer alter column loyalty_level drop not null;'],
        ['alter table orders alter column total_cents set data type bigint', 'alter table orders alter column total_cents type bigint;'],
        ['alter table orders alter column total_cents type bigint', 'alter table orders alter column total_cents type bigint;'],
        ["alter table customer alter column loyalty_level set default 'BRONZE'", "alter table customer alter column loyalty_level set default 'BRONZE';"],
        ['alter table customer alter column loyalty_level drop default', 'alter table customer alter column loyalty_level drop default;'],
        ['alter table book add constraint ck_book_price check (price_cents >= 0)', 'alter table book add constraint ck_book_price check (price_cents >= 0);'],
        ['alter table t add constraint uq unique (a, b)', 'alter table t add constraint uq unique (a, b);'],
        ['alter table t add constraint pk primary key (id)', 'alter table t add constraint pk primary key (id);'],
        ['create index ix_review_book on review (book_id)', 'create index ix_review_book on review (book_id);'],
        ['create unique index ux on customer (mail, name)', 'create unique index ux on customer (mail, name);'],
        ['alter table review add foreign key (book_id) references book', 'alter table review add foreign key (book_id) references book;'],
        ['rename column customer.mail to email', 'alter table customer rename column mail to email;'],
        ['drop table order_status_legacy', 'drop table order_status_legacy;'],
    ])('%s', async (source, sql) => {
        expect(await statement(source)).toBe(sql);
    });

    test('create table puts every column and constraint on a line of its own', async () => {
        expect(await statement(
            'create table review (id bigint not null primary key, book_id bigint not null references book (id),',
            '  stars integer not null check (stars between 1 and 5), code varchar(20) unique,',
            '  primary key (id), constraint uq_review unique (book_id, stars))',
        )).toBe([
            'create table review (',
            '    id bigint not null primary key,',
            '    book_id bigint not null references book (id),',
            '    stars integer not null check (stars between 1 and 5),',
            '    code varchar(20) unique,',
            '    primary key (id),',
            '    constraint uq_review unique (book_id, stars)',
            ');',
        ].join('\n'));
    });
});

describe('PostgreSQL: statements that change rows', () => {
    test.each([
        ["update customer set loyalty_level = 'BRONZE'", "update customer set loyalty_level = 'BRONZE';"],
        ['update orders o set a = 1, b = o.c where o.status_id is null', 'update orders o set a = 1, b = o.c where o.status_id is null;'],
        ['delete from order_item where quantity = 0', 'delete from order_item where quantity = 0;'],
        ['delete from review r', 'delete from review r;'],
        ["insert into order_status (id, code) values (1, 'OPEN')", "insert into order_status (id, code) values (1, 'OPEN');"],
        ['insert into book_copy (id, title) select b.id, b.title from book b where b.stock > 0',
            'insert into book_copy (id, title) select b.id, b.title from book b where b.stock > 0;'],
    ])('%s', async (source, sql) => {
        expect(await statement(source)).toBe(sql);
    });
});

describe('PostgreSQL: expressions', () => {
    test.each([
        ["'it''s'", "'it''s'"],
        ['4.25 + 2', '4.25 + 2'],
        ["date '2026-01-31'", "date '2026-01-31'"],
        ['null', 'null'],
        ['true and not false', 'true and not false'],
        ['-(a + b) * c / d - e', '-(a + b) * c / d - e'],
        ["name || ' (old)'", "name || ' (old)'"],
        ['a <> 1 or b <= 2 and c >= 3', 'a <> 1 or b <= 2 and c >= 3'],
        ['a IS NOT NULL', 'a is not null'],
        ["a not in ('x', 'y')", "a not in ('x', 'y')"],
        ['a in (select id from t)', 'a in (select id from t)'],
        ['a not between 1 and 5', 'a not between 1 and 5'],
        ["a like 'x%'", "a like 'x%'"],
        ["case when stock = 0 then 'OUT' else 'OK' end", "case when stock = 0 then 'OUT' else 'OK' end"],
        ["case status when 'A' then 1 end", "case status when 'A' then 1 end"],
        ['cast(created_at as date)', 'cast(created_at as date)'],
        ['upper(trim(o.status))', 'upper(trim(o.status))'],
        ['count(*)', 'count(*)'],
        ["(select s.id from order_status s where s.code = 'X')", "(select s.id from order_status s where s.code = 'X')"],
        ['not exists (select 1 from orders)', 'not exists (select 1 from orders)'],
    ])('%s', async (source, sql) => {
        expect(await statement(`update t set c = ${source}`)).toBe(`update t set c = ${sql};`);
    });

    test('next value for a sequence is a call of nextval', async () => {
        expect(await statement('update t set c = next value for bookshop_seq')).toBe("update t set c = nextval('bookshop_seq');");
    });

    test('days is an interval', async () => {
        expect(await statement('update t set c = cast(created_at as date) + days(3)'))
            .toBe('update t set c = cast(created_at as date) + make_interval(days => 3);');
    });
});

// M1-AC-23
describe('PostgreSQL: insert in YAML form', () => {
    test('values give the same statement as the insert in SQL form', async () => {
        const yamlForm = await generated(
            'insert:', '  into: order_status', '  values:', '    id:    next value for bookshop_seq', "    code:  'UNKNOWN'", "    label: 'Unknown'",
        );
        const sqlForm = await statement(
            'insert into order_status (id, code, label)', "values (next value for bookshop_seq, 'UNKNOWN', 'Unknown')",
        );

        expect(yamlForm).toBe(sqlForm);
        expect(yamlForm).toBe("insert into order_status (id, code, label) values (nextval('bookshop_seq'), 'UNKNOWN', 'Unknown');");
    });

    test('rows give one statement with a line per row', async () => {
        expect(await generated(
            'insert:', '  into: order_status', '  rows:', "    - { id: 1, code: 'OPEN' }", "    - { id: 2, code: 'PAID' }",
        )).toBe([
            'insert into order_status (id, code) values',
            "    (1, 'OPEN'),",
            "    (2, 'PAID');",
        ].join('\n'));
    });
});

describe('PostgreSQL: other operations', () => {
    test('native SQL for PostgreSQL is used as it is', async () => {
        expect(await generated('native:', '  postgresql: |', '    create index ix_book_title_search on book', '      using gin (title gin_trgm_ops)'))
            .toBe('create index ix_book_title_search on book\n  using gin (title gin_trgm_ops);');
    });

    // M3-AC-12
    test('a native part without an entry for PostgreSQL is an error', async () => {
        await expect(generated('native:', '  oracle: select 1 from dual')).rejects.toThrow(
            'The part "p" has native SQL for oracle, but none for postgresql.');
    });
});

// M3-AC-03
describe('PostgreSQL: names', () => {
    test.each([
        ['update Customer set Loyalty_Level = 1', 'update customer set loyalty_level = 1;'],
        ['update "customer" set "loyalty_level" = 1', 'update customer set loyalty_level = 1;'],
        ['update "Customer" set "Loyalty Level" = "Customer"."Old" where "naïve" = 1',
            'update "Customer" set "Loyalty Level" = "Customer"."Old" where "naïve" = 1;'],
        ['update "order" o set "index" = "table"."column", "user" = 1', 'update "order" o set index = "table"."column", "user" = 1;'],
        ['update t set value = key + date + type + data + next + required + finish', 'update t set value = key + date + type + data + next + required + finish;'],
        ['alter table "order" add column "Total" VARCHAR(10)', 'alter table "order" add column "Total" varchar(10);'],
        ['create index "Ix" on "order" ("index", id)', 'create index "Ix" on "order" (index, id);'],
        ['update t set c = UPPER(Trim(Name))', 'update t set c = upper(trim(name));'],
        ['update t set c = next value for "Bookshop_Seq"', `update t set c = nextval('"Bookshop_Seq"');`],
        ['update t set c = next value for Bookshop_Seq', "update t set c = nextval('bookshop_seq');"],
    ])('%s', async (source, sql) => {
        expect(await statement(source)).toBe(sql);
    });
});

// M3-AC-04
describe('PostgreSQL: text literals', () => {
    test('a quote inside a text is doubled', async () => {
        expect(await statement("update customer set name = 'O''Brien'")).toBe("update customer set name = 'O''Brien';");
    });

    test('a value cannot end the literal and start a new statement', async () => {
        const hostile = "x''; drop table customer; --";
        const sql = await statement(`update customer set name = '${hostile}', note = '\\'' or 1=1 --'`);

        expect(sql).toBe("update customer set name = 'x''; drop table customer; --', note = '\\'' or 1=1 --';");
        const parsed = parseSync(sql);
        expect(parsed.stmts).toHaveLength(1);
        expect(Object.keys(parsed.stmts![0].stmt!)).toEqual(['UpdateStmt']);
    });

    test('a text in YAML form is written as a literal too', async () => {
        const sql = await generated('insert:', '  into: customer', '  rows:', "    - { name: 'x''); drop table customer; --' }");

        expect(sql).toBe("insert into customer (name) values ('x''); drop table customer; --');");
        expect(parseSync(sql).stmts).toHaveLength(1);
    });
});

// M3-AC-05
describe('PostgreSQL: formatting of the snippet', () => {
    test('the same statement gives the same text, however it is written', async () => {
        const oneLine = await statement("update orders o set status_id = (select s.id from order_status s where s.code = upper(trim(o.status))) where o.status_id is null");
        await clear();
        const formatted = await statement(
            'UPDATE   orders O', '  SET status_id = ( SELECT s.id   FROM order_status s -- look it up',
            '                     WHERE s.code = UPPER( TRIM( o.status ) ) )', '', 'WHERE  o.status_id   IS NULL');

        expect(formatted).toBe(oneLine);
    });
});

// M3-AC-11
describe('PostgreSQL: upsert', () => {
    test('is one statement that inserts missing rows and updates existing ones by the key', async () => {
        expect(await generated(
            'upsert:', '  into: order_status', '  key: code', '  rows:', "    - { id: 1, code: 'OPEN', label: 'Open' }", "    - { id: 2, code: 'PAID', label: 'Paid' }",
        )).toBe([
            'insert into order_status (id, code, label) values',
            "    (1, 'OPEN', 'Open'),",
            "    (2, 'PAID', 'Paid')",
            'on conflict (code) do update set id = excluded.id, label = excluded.label;',
        ].join('\n'));
    });

    test('a key of several columns', async () => {
        expect(await generated(
            'upsert:', '  into: book_price', '  key: [book_id, currency]', '  rows:', "    - { book_id: 1, currency: 'EUR', price_cents: 990 }",
        )).toBe("insert into book_price (book_id, currency, price_cents) values (1, 'EUR', 990)\non conflict (book_id, currency) do update set price_cents = excluded.price_cents;");
    });

    test('rows that hold nothing but the key change nothing where the row exists', async () => {
        expect(await generated('upsert:', '  into: tag', '  key: name', '  rows:', "    - { name: 'new' }"))
            .toBe("insert into tag (name) values ('new')\non conflict (name) do nothing;");
    });

    test('every row needs the same columns', async () => {
        await expect(generated('upsert:', '  into: tag', '  key: name', '  rows:', "    - { name: 'a', label: 'A' }", "    - { name: 'b' }"))
            .rejects.toThrow('The rows of the part "p" have different columns. Every row of an upsert or an insert gives the same columns.');
    });
});

// M3-AC-13, M3-AC-14, M3-AC-15, M3-AC-16
describe('PostgreSQL: forms that do not lock a table for long', () => {
    test('set not null is four steps', async () => {
        expect(await statement('alter table customer alter column loyalty_level set not null')).toBe([
            '-- step 1 of 4',
            'alter table customer add constraint customer_loyalty_level_not_null check (loyalty_level is not null) not valid;',
            '-- step 2 of 4',
            'alter table customer validate constraint customer_loyalty_level_not_null;',
            '-- step 3 of 4',
            'alter table customer alter column loyalty_level set not null;',
            '-- step 4 of 4',
            'alter table customer drop constraint customer_loyalty_level_not_null;',
        ].join('\n'));
    });

    test('a new foreign key with a name is two steps', async () => {
        expect(await statement('alter table review add constraint fk_review_book foreign key (book_id) references book (id)')).toBe([
            '-- step 1 of 2',
            'alter table review add constraint fk_review_book foreign key (book_id) references book (id) not valid;',
            '-- step 2 of 2',
            'alter table review validate constraint fk_review_book;',
        ].join('\n'));
    });

    test('an index that is built concurrently runs outside a transaction', async () => {
        expect(await statement('create index concurrently ix_orders_customer on orders (customer_id)'))
            .toBe('-- outside transaction\ncreate index concurrently ix_orders_customer on orders (customer_id);');
        await clear();
        expect(await statement('drop index concurrently ix_orders_customer'))
            .toBe('-- outside transaction\ndrop index concurrently ix_orders_customer;');
    });
});

// M3-AC-09
describe('PostgreSQL: ensure column', () => {
    test('is code that decides on the database', async () => {
        expect(await statement('ensure column orders.note varchar(500)')).toBe(`do $ensure$
declare
    existing record;
begin
    select a.atttypid, a.atttypmod, format_type(a.atttypid, a.atttypmod) as type into existing
    from pg_attribute a
    where a.attrelid = 'orders'::regclass and a.attname = 'note' and a.attnum > 0 and not a.attisdropped;
    if not found then
        alter table orders add column note varchar(500);
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod = 504 then
        null;
    elsif existing.atttypid = 'varchar'::regtype and existing.atttypmod between 5 and 503 then
        alter table orders alter column note type varchar(500);
    else
        raise exception 'ensure column orders.note varchar(500): the column exists as %. It can neither be kept nor widened.', existing.type;
    end if;
end
$ensure$;`);
    });

    test('a type without details is kept if it is the same', async () => {
        const sql = await statement('ensure column orders.ship_by date');

        expect(sql).toContain("    elsif existing.atttypid = 'date'::regtype and existing.atttypmod = -1 then\n        null;\n    else\n");
    });
});
