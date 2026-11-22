import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach } from 'vitest';

const folders: string[] = [];

afterEach(() => {
    for (const folder of folders.splice(0)) {
        fs.rmSync(folder, { recursive: true, force: true });
    }
});

/** Writes the files into a new folder and returns it. The folder is removed after the test. */
export function folderWith(files: Record<string, string>): string {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'migql-project-'));
    folders.push(folder);
    for (const [file, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true });
        fs.writeFileSync(path.join(folder, file), text);
    }
    return folder;
}

/** A project of snippets that are given as `name: [lines after the name and the uid]`. Every snippet gets a uid. */
export function projectWith(snippets: Record<string, string[]>): string {
    return folderWith(Object.fromEntries(Object.entries(snippets).map(([name, rest], index) =>
        [`${name}.migql.yaml`, [`migration: ${name}`, `uid: UID${index + 1}`, ...rest].join('\n') + '\n'])));
}
