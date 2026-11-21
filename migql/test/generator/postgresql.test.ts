import { describe, expect, test } from 'vitest';
import { generatePart } from '../../generators/postgresql/index.js';
import { partsOf } from '../../src/model/snippet.js';
import { createMigql, lines } from '../support.js';

const { parse } = createMigql();

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
        ["ALTER TABLE Customer ADD COLUMN Level NUMERIC(10, 2) NOT NULL DEFAULT 0", 'alter table Customer add column Level NUMERIC(10, 2) not null default 0;'],
        ['alter table orders drop column status', 'alter table orders drop column status;'],
        ['alter table customer alter column loyalty_level set not null', 'alter table customer alter column loyalty_level set not null;'],
        ['alter table customer alter column loyalty_level drop not null', 'alter table customer alter column loyalty_level drop not null;'],
        ['alter table orders alter column total_cents set data type bigint', 'alter table orders alter column total_cents type bigint;'],
        ['alter table orders alter column total_cents type bigint', 'alter table orders alter column total_cents type bigint;'],
        ["alter table customer alter column loyalty_level set default 'BRONZE'", "alter table customer alter column loyalty_level set default 'BRONZE';"],
        ['alter table customer alter column loyalty_level drop default', 'alter table customer alter column loyalty_level drop default;'],
        ['alter table review add constraint fk_review_book foreign key (book_id) references book',
            'alter table review add constraint fk_review_book foreign key (book_id) references book;'],
        ['alter table review add constraint fk foreign key (a, b) references book (c, d)',
            'alter table review add constraint fk foreign key (a, b) references book (c, d);'],
        ['alter table book add constraint ck_book_price check (price_cents >= 0)', 'alter table book add constraint ck_book_price check (price_cents >= 0);'],
        ['alter table t add constraint uq unique (a, b)', 'alter table t add constraint uq unique (a, b);'],
        ['alter table t add constraint pk primary key (id)', 'alter table t add constraint pk primary key (id);'],
        ['create index ix_review_book on review (book_id)', 'create index ix_review_book on review (book_id);'],
        ['create unique index concurrently ux on customer (mail, name)', 'create unique index concurrently ux on customer (mail, name);'],
        ['drop table order_status_legacy', 'drop table order_status_legacy;'],
        ['drop index concurrently ix_review_book', 'drop index concurrently ix_review_book;'],
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

    test('a construct that needs several steps is not generated yet', async () => {
        await expect(statement('rename column customer.mail to email')).rejects.toThrow(
            '"rename column" needs several steps. Its generation belongs to milestone M3.');
        await expect(statement('ensure column orders.note varchar(500)')).rejects.toThrow(
            '"ensure column" needs several steps. Its generation belongs to milestone M3.');
    });
});
