import { describe, expect, test } from 'vitest';
import { expectCompletion } from 'langium/test';
import { createMigql, lines } from '../support.js';

const { services, parse } = createMigql();
const completion = expectCompletion(services.migql);

/** The labels that are offered at the place marked with <|>. */
async function offered(text: string): Promise<string[]> {
    let labels: string[] = [];
    await completion({
        text,
        index: 0,
        parseOptions: { documentUri: `file:///completion-${Math.random()}/20260302-0900-x.migql.yaml` },
        assert: completions => {
            labels = completions.items.map(item => item.label);
        },
    });
    return labels;
}

const NAME = 'migration: 20260302-0900-x';

describe('Completion: keys', () => {
    test('an empty file offers the keys of a snippet', async () => {
        expect(await offered('<|>')).toEqual(expect.arrayContaining(['migration:', 'repair:', 'uid:', 'doc:', 'parts:', 'testdata:']));
    });

    test('a new line at the start offers the keys of a snippet', async () => {
        const labels = await offered(lines(NAME, '<|>'));

        expect(labels).toEqual(expect.arrayContaining(['uid:', 'doc:', 'when:', 'let:', 'parts:', 'testdata:', 'testdata-before:']));
        expect(labels).not.toContain('do:');
    });

    test('inside a part the keys of a part are offered', async () => {
        const labels = await offered(lines(NAME, 'parts:', '  - p:', '      <|>'));

        expect(labels).toEqual(expect.arrayContaining(['do:', 'insert:', 'native:', 'stop:', 'when:', 'verify-before:', 'verify-after:', 'batch:', 'expect-rows:', 'phase:', 'todo:']));
        expect(labels).not.toContain('uid:');
    });

    test('after an entry of a part the keys of a part are offered again', async () => {
        const labels = await offered(lines(NAME, 'parts:', '  - p:', '      do: delete from t', '      <|>'));

        expect(labels).toEqual(expect.arrayContaining(['when:', 'verify-after:', 'batch:']));
    });

    test('the start of a key narrows the offer', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      do: delete from t', '      ver<|>'))).toEqual(['verify-before:', 'verify-after:']);
    });
});

describe('Completion: statements', () => {
    test('after do the statements are offered', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      do: <|>')))
            .toEqual(expect.arrayContaining(['create', 'alter', 'drop', 'ensure', 'rename', 'update', 'delete', 'insert']));
    });

    test('inside a statement the next keywords are offered', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      do: alter table orders <|>'))).toEqual(['add', 'drop', 'alter']);
    });

    test('inside a literal block the next keywords are offered', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      do: |', '        alter table orders', '          alter column total_cents s<|>')))
            .toEqual(['set']);
    });
});

describe('Completion: names', () => {
    test('a condition offers the names defined under let', async () => {
        const labels = await offered(lines(NAME, 'let:', '  has_old_status: column orders.status exists', '  audited: true', 'when: <|>'));

        expect(labels).toEqual(expect.arrayContaining(['has_old_status', 'audited', 'not', 'ran', 'column', 'table', 'exists']));
    });

    test('after ran the parts of all snippets are offered', async () => {
        await parse(lines('migration: 20260518-1000-order-status', 'parts:', '  - add-status-id:', '      do: delete from t', '  - link-status:', '      do: delete from t'));

        expect(await offered(lines('repair: 20260622-0900-repair-order-status', 'when: ran <|>')))
            .toEqual(expect.arrayContaining(['order-status.add-status-id', 'order-status.link-status']));
    });
});
