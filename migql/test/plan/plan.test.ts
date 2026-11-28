import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { compilePlan, PlanError } from '../../generators/postgresql/plan.js';
import { loadProject } from '../../src/project.js';
import { folderWith, projectWith } from './project-folder.js';

const BOOKSHOP = fileURLToPath(new URL('../../../examples/bookshop/migrations', import.meta.url));
const HERE = fileURLToPath(new URL('.', import.meta.url));

const DELETE = ['parts:', '  - p:', '      do: delete from t'];

async function planOf(snippets: Record<string, string[]>) {
    return compilePlan(await loadProject(projectWith(snippets)));
}

async function problemsOf(folder: string): Promise<string[]> {
    try {
        await compilePlan(await loadProject(folder));
        return [];
    } catch (error) {
        if (error instanceof PlanError) {
            return error.problems;
        }
        throw error;
    }
}

// M4.1-AC-01
describe('The bookshop snippets', () => {
    test('load without a problem, and every snippet has a uid', async () => {
        const project = await loadProject(BOOKSHOP);

        expect(project.problems).toEqual([]);
        expect(project.files).toHaveLength(9);
        expect((await compilePlan(project)).snippets.map(snippet => snippet.uid).every(uid => /^[0-9A-Z]{26}$/.test(uid))).toBe(true);
    });
});

// M4.1-AC-02, M4.1-AC-03
describe('The plan', () => {
    test('of the bookshop is the committed expected file, and the same every time', async () => {
        const first = JSON.stringify(await compilePlan(await loadProject(BOOKSHOP)), null, 2) + '\n';
        const second = JSON.stringify(await compilePlan(await loadProject(BOOKSHOP)), null, 2) + '\n';

        expect(second).toBe(first);
        await expect(first).toMatchFileSnapshot(path.join(HERE, 'bookshop-plan.json'));
    });

    test('has the snippets in the order of their names and the parts in the order of the file', async () => {
        const plan = await planOf({
            '20260302-0900-b': ['parts:', '  - second:', '      do: delete from b', '  - first:', '      do: delete from a'],
            '20260301-0900-c': DELETE,
            '20260303-0900-a': DELETE,
        });

        expect(plan.snippets.map(snippet => [snippet.name, snippet.slug, snippet.uid])).toEqual([
            ['20260301-0900-c', 'c', 'UID2'], ['20260302-0900-b', 'b', 'UID1'], ['20260303-0900-a', 'a', 'UID3'],
        ]);
        expect(plan.snippets[1].parts.map(part => part.name)).toEqual(['second', 'first']);
    });

    test('has the steps of every part, and what the script has to know about them', async () => {
        const plan = await planOf({
            '20260302-0900-a': [
                'let:', '  has_mail: column customer.mail exists',
                'parts:',
                '  - mandatory:', '      when: has_mail and not table gone exists', '      column-set-not-null: { table: customer, column: mail }',
                '  - index:', '      do: create index concurrently ix_customer_mail on customer (mail)',
                '  - checked:', '      verify-before: exists (select 1 from customer)', '      do: delete from customer where mail is null',
                '      verify-after:', '        - none: customer.mail is null', "        - all: customer.name <> ''",
                "        - exists: customer.id > 0", "        - single: customer.name = 'Jo'",
                '  - halt:', '      when: not index ix_customer_mail exists', '      stop: Call the administrator.',
            ],
        });

        const [snippet] = plan.snippets;
        expect(snippet).not.toHaveProperty('when');
        const [mandatory, index, checked, halt] = snippet.parts;
        expect(mandatory.steps.map(step => step.sql)).toEqual([
            'alter table customer add constraint customer_mail_not_null check (mail is not null) not valid',
            'alter table customer validate constraint customer_mail_not_null',
            'alter table customer alter column mail set not null',
            'alter table customer drop constraint customer_mail_not_null',
        ]);
        expect(mandatory.when?.sql).toBe(
            "(exists (select 1 from pg_attribute a where a.attrelid = to_regclass('customer') and a.attname = 'mail' and a.attnum > 0 and not a.attisdropped))" +
            " and not exists (select 1 from pg_class c where c.oid = to_regclass('gone') and c.relkind in ('r', 'p'))");
        expect(mandatory.checksum).toMatch(/^v1:[0-9a-f]{64}$/);
        expect(index.steps).toEqual([{
            sql: 'create index concurrently ix_customer_mail on customer (mail)', outsideTransaction: true, cleanup: 'drop index if exists ix_customer_mail',
        }]);
        expect(checked.verifyBefore).toEqual([{ text: 'exists (select 1 from customer)', sql: 'exists (select 1 from customer)' }]);
        expect(checked.verifyAfter).toEqual([
            { text: 'none: customer.mail is null', sql: 'not exists (select 1 from customer where (customer.mail is null))' },
            { text: "all: customer.name <> ''", sql: "not exists (select 1 from customer where (customer.name <> '') is not true)" },
            { text: 'exists: customer.id > 0', sql: 'exists (select 1 from customer where (customer.id > 0))' },
            { text: "single: customer.name = 'Jo'", sql: "(select count(*) from customer where (customer.name = 'Jo')) = 1" },
        ]);
        expect(halt).toMatchObject({ stop: 'Call the administrator.', steps: [] });
        expect(halt.when?.sql).toBe("not exists (select 1 from pg_class c where c.oid = to_regclass('ix_customer_mail') and c.relkind in ('i', 'I'))");
    });

    // M4.1-AC-33
    test('a condition on the history asks the ledger for the part of the other snippet', async () => {
        const plan = await planOf({
            '20260302-0900-first': ['parts:', '  - link:', '      do: delete from t'],
            '20260303-0900-repair': ['parts:', '  - p:', '      when: ran first.link', '      do: delete from t'],
        });

        expect(plan.snippets[1].parts[0].when).toEqual({ text: 'ran first.link', sql: "pg_temp.migace_ran('UID1', 'link')" });
    });

    // M4.4-AC-40
    test('a retired part is marked with its reason, and keeps its steps', async () => {
        const plan = await planOf({ '20260302-0900-a': ['parts:', '  - p:', '      retired: The application fills it now.', '      do: delete from t', '  - q:', '      do: delete from u'] });

        expect(plan.snippets[0].parts.map(part => [part.name, part.retired, part.steps.length])).toEqual([['p', 'The application fills it now.', 1], ['q', undefined, 1]]);
    });

    test('a retired snippet is marked, and the fingerprint and the prefix of the ledger are options', async () => {
        const project = await loadProject(projectWith({ '20260302-0900-a': ['retired: The index slowed down the import.', ...DELETE] }));

        const plan = await compilePlan(project, { ledgerPrefix: 'lg_', fingerprint: 'abc' });

        expect(plan).toMatchObject({ ledgerPrefix: 'lg_', fingerprint: 'abc', snippets: [{ retired: 'The index slowed down the import.' }] });
        expect((await compilePlan(project)).ledgerPrefix).toBe('mig_');
    });
});

// M4.1-AC-05
describe('What cannot be compiled', () => {
    test('a project with an error', async () => {
        expect(await problemsOf(projectWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: delete t'] }))).toEqual([
            '20260302-0900-a.migql.yaml:5:18: Expected "from", but found "t".',
        ]);
    });

    test('a warning does not stop the compiler', async () => {
        expect(await problemsOf(projectWith({ '20260302-0900-a': ['parts:', '  - p:', '      do: alter table t alter column c set not null'] }))).toEqual([]);
    });

    test.each([
        [['parts:', '  - p:', '      todo: Choose a value', '      do: update t set c = ?'],
            '20260302-0900-a.migql.yaml, part "p": a todo is left: Choose a value'],
        [['parts:', '  - p:', '      do: delete from t', '      batch: 100 by id'],
            '20260302-0900-a.migql.yaml, part "p": "batch" is not built yet. Remove it for now.'],
        [['parts:', '  - p:', '      do: delete from t', '      expect-rows: 0..5'],
            '20260302-0900-a.migql.yaml, part "p": "expect-rows" is not built yet. Remove it for now.'],
        [['parts:', '  - p:', '      native:', '        oracle: select 1 from dual'],
            '20260302-0900-a.migql.yaml, part "p": The part "p" has native SQL for oracle, but none for postgresql.'],
        // M4.1-AC-42
        [['parts:', '  - p:', '      native:', '        postgresql: |', '          create extension pg_trgm;', '          create index ix on book using gin (title gin_trgm_ops)'],
            '20260302-0900-a.migql.yaml, part "p": the native SQL has 2 statements. A part is one statement or one block; write two parts.'],
        [['parts:', '  - p:', '      native:', '        postgresql: create index ix on book using (title'],
            '20260302-0900-a.migql.yaml, part "p": PostgreSQL cannot read the native SQL: syntax error at or near "("'],
        [['parts:', '  - p:', '      do: delete from t', '      verify-after:', '        - all: c is not null'],
            '20260302-0900-a.migql.yaml, part "p": the check "all: c is not null" names no table. Write the table in front of a column: orders.status_id is not null.'],
        [['parts:', '  - p:', '      do: delete from t', '      verify-after:', '        - none: a.x = b.y'],
            '20260302-0900-a.migql.yaml, part "p": the check "none: a.x = b.y" names the tables a and b. A check on rows looks at one table.'],
    ])('%j', async (rest, problem) => {
        expect(await problemsOf(projectWith({ '20260302-0900-a': rest }))).toEqual([problem]);
    });

    test('a snippet without a uid', async () => {
        expect(await problemsOf(folderWith({ '20260302-0900-a.migql.yaml': ['migration: 20260302-0900-a', ...DELETE].join('\n') + '\n' }))).toEqual([
            '20260302-0900-a.migql.yaml: the snippet has no uid. Every snippet needs one; the ledger knows a snippet by it.',
        ]);
    });

    test('a condition on a release, until release files exist', async () => {
        expect(await problemsOf(projectWith({
            '20260302-0900-first': ['parts:', '  - link:', '      do: delete from t'],
            '20260303-0900-repair': ['parts:', '  - p:', '      when: ran first.link from 1.2.0', '      do: delete from t'],
        }))).toEqual([
            '20260303-0900-repair.migql.yaml, part "p": "ran first.link from 1.2.0" needs the checksums of a release file. Release files are not built yet; write the condition without "from".',
        ]);
    });

    test('all problems of all snippets are reported together', async () => {
        expect(await problemsOf(folderWith({
            '20260302-0900-a.migql.yaml': ['migration: 20260302-0900-a', ...DELETE, '      batch: 5 by id'].join('\n') + '\n',
            '20260303-0900-b.migql.yaml': ['migration: 20260303-0900-b', 'uid: B', ...DELETE, '      todo: Later'].join('\n') + '\n',
        }))).toHaveLength(3);
    });
});
