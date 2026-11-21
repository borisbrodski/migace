import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { loadProject } from '../../src/project.js';
import { lines } from '../support.js';

const folders: string[] = [];

/** Writes the files into a new folder and returns it. */
function folderWith(files: Record<string, string>): string {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'migql-project-'));
    folders.push(folder);
    for (const [file, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true });
        fs.writeFileSync(path.join(folder, file), text);
    }
    return folder;
}

afterEach(() => {
    for (const folder of folders.splice(0)) {
        fs.rmSync(folder, { recursive: true, force: true });
    }
});

function snippet(name: string, ...rest: string[]): string {
    return lines(`migration: ${name}`, ...rest);
}

const DELETE = ['parts:', '  - p:', '      do: delete from t'];

describe('Loading a project', () => {
    // M1.1-AC-04
    test('every snippet file below the folder is loaded, also in sub-folders', async () => {
        const project = await loadProject(folderWith({
            '20260302-0900-a.migql.yaml': snippet('20260302-0900-a', ...DELETE),
            'archive/2025/20250101-0900-b.migql.yaml': snippet('20250101-0900-b', ...DELETE),
            'notes.yaml': 'not: a snippet\n',
            'README.md': '# no snippet\n',
        }));

        expect(project.files).toEqual(['20260302-0900-a.migql.yaml', 'archive/2025/20250101-0900-b.migql.yaml']);
        expect(project.problems).toEqual([]);
    });

    // M1.1-AC-05
    test('a file that cannot be parsed does not stop the others, and every problem names its file', async () => {
        const project = await loadProject(folderWith({
            '20260302-0900-a.migql.yaml': snippet('20260302-0900-a', 'parts:', '  - p:', '      do: delete t'),
            '20260303-0900-b.migql.yaml': snippet('20260303-0900-b', 'parts:', '  - p:', '      when: true'),
            '20260304-0900-c.migql.yaml': snippet('20260304-0900-c', ...DELETE),
        }));

        expect(project.files).toHaveLength(3);
        expect(project.problems.map(problem => `${problem.file}:${problem.line}:${problem.column} ${problem.severity} ${problem.message}`)).toEqual([
            '20260302-0900-a.migql.yaml:4:18 error Expected "from", but found "t".',
            '20260303-0900-b.migql.yaml:3:5 error The part "p" has no operation. Add one of: do, insert, upsert, native, stop.',
        ]);
    });
});

describe('Checks across a project', () => {
    // M1.1-AC-06
    test('two snippets with the same slug are an error in both files, each naming the other', async () => {
        const project = await loadProject(folderWith({
            '20260302-0900-order-status.migql.yaml': snippet('20260302-0900-order-status', ...DELETE),
            '20260518-1000-order-status.migql.yaml': snippet('20260518-1000-order-status', ...DELETE),
            '20260519-1000-other.migql.yaml': snippet('20260519-1000-other', ...DELETE),
        }));

        expect(project.problems.map(problem => `${problem.file}:${problem.line}:${problem.column} ${problem.message}`)).toEqual([
            '20260302-0900-order-status.migql.yaml:1:12 The slug "order-status" is also used by 20260518-1000-order-status.migql.yaml. ' +
                'Slugs must be unique in a project, because snippets refer to each other by slug.',
            '20260518-1000-order-status.migql.yaml:1:12 The slug "order-status" is also used by 20260302-0900-order-status.migql.yaml. ' +
                'Slugs must be unique in a project, because snippets refer to each other by slug.',
        ]);
    });

    // M1.1-AC-07
    test('two snippets with the same uid are an error in both files, each naming the other', async () => {
        const project = await loadProject(folderWith({
            '20260302-0900-a.migql.yaml': snippet('20260302-0900-a', 'uid: 01JF2A6QW3ZK8M4T7R9B5X0C1D', ...DELETE),
            '20260303-0900-b.migql.yaml': snippet('20260303-0900-b', 'uid: 01JF2A6QW3ZK8M4T7R9B5X0C1D', ...DELETE),
        }));

        expect(project.problems.map(problem => `${problem.file}:${problem.line}:${problem.column} ${problem.message}`)).toEqual([
            '20260302-0900-a.migql.yaml:2:6 The uid "01JF2A6QW3ZK8M4T7R9B5X0C1D" is also used by 20260303-0900-b.migql.yaml. ' +
                'Every snippet needs a uid of its own; create a new one for the newer snippet.',
            '20260303-0900-b.migql.yaml:2:6 The uid "01JF2A6QW3ZK8M4T7R9B5X0C1D" is also used by 20260302-0900-a.migql.yaml. ' +
                'Every snippet needs a uid of its own; create a new one for the newer snippet.',
        ]);
    });

    // M1.1-AC-08
    test('ran is linked to a part in another file; unknown snippets and parts are errors', async () => {
        const project = await loadProject(folderWith({
            '20260518-1000-order-status.migql.yaml': snippet('20260518-1000-order-status', 'parts:', '  - link-status:', '      do: delete from t'),
            'repairs/20260622-0900-repair.migql.yaml': lines('repair: 20260622-0900-repair', 'when: ran order-status.link-status from 1.2.0'),
            'repairs/20260623-0900-wrong-part.migql.yaml': lines('repair: 20260623-0900-wrong-part', 'when: ran order-status.backfill'),
            'repairs/20260624-0900-wrong-snippet.migql.yaml': lines('repair: 20260624-0900-wrong-snippet', 'when: ran orders.link-status'),
        }));

        expect(project.problems.map(problem => `${problem.file} ${problem.message}`)).toEqual([
            'repairs/20260623-0900-wrong-part.migql.yaml The snippet "order-status" has no part "backfill". Its parts: link-status.',
            'repairs/20260624-0900-wrong-snippet.migql.yaml No snippet is named "orders". Name the snippet without its date and time, then the part: <snippet>.<part>.',
        ]);
    });

    // M1.1-AC-09
    test('a snippet may refer to itself with ran', async () => {
        const project = await loadProject(folderWith({
            '20260518-1000-order-status.migql.yaml': snippet('20260518-1000-order-status',
                'parts:', '  - first:', '      do: delete from t', '  - second:', '      when: ran order-status.first', '      do: delete from u'),
        }));

        expect(project.problems).toEqual([]);
    });

    // M1.1-AC-10
    test('after a file changed, the checks run again for the other files', async () => {
        const folder = folderWith({
            '20260302-0900-a.migql.yaml': snippet('20260302-0900-a', ...DELETE),
            '20260303-0900-b.migql.yaml': snippet('20260303-0900-b', ...DELETE),
            '20260304-0900-c.migql.yaml': lines('repair: 20260304-0900-c', 'when: ran b.p'),
        });
        const project = await loadProject(folder);
        expect(project.problems).toEqual([]);

        fs.renameSync(path.join(folder, '20260303-0900-b.migql.yaml'), path.join(folder, '20260303-0900-a.migql.yaml'));
        fs.writeFileSync(path.join(folder, '20260303-0900-a.migql.yaml'), snippet('20260303-0900-a', ...DELETE));
        await project.refresh();

        expect(project.problems.map(problem => `${problem.file} ${problem.message.split('.')[0]}`)).toEqual([
            '20260302-0900-a.migql.yaml The slug "a" is also used by 20260303-0900-a',
            '20260303-0900-a.migql.yaml The slug "a" is also used by 20260302-0900-a',
            '20260304-0900-c.migql.yaml No snippet is named "b"',
        ]);
    });

    test('a problem disappears when the other file is corrected', async () => {
        const folder = folderWith({
            '20260302-0900-a.migql.yaml': snippet('20260302-0900-a', 'uid: SAME', ...DELETE),
            '20260303-0900-b.migql.yaml': snippet('20260303-0900-b', 'uid: SAME', ...DELETE),
        });
        const project = await loadProject(folder);
        expect(project.problems).toHaveLength(2);

        fs.writeFileSync(path.join(folder, '20260303-0900-b.migql.yaml'), snippet('20260303-0900-b', 'uid: OTHER', ...DELETE));
        await project.refresh();

        expect(project.problems).toEqual([]);
    });
});
