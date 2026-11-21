import { describe, expect, test } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function lint(file: string, code: string): Promise<string[]> {
    const eslint = new ESLint({ cwd: root });
    const [result] = await eslint.lintText(code, { filePath: path.join(root, file) });
    return result.messages.map(message => message.message);
}

// M0-AC-05
describe('core/ stays database-neutral', () => {
    test('an import from databases/ is an error', async () => {
        const messages = await lint('core/src/probe.ts', `import '../../databases/postgresql/src/index.js';\n`);

        expect(messages).toEqual([expect.stringContaining('core/ imports nothing from databases/')]);
    });

    test('an import from migql/generators/ is an error', async () => {
        const messages = await lint('core/src/probe.ts', `import '../../migql/generators/postgresql/index.js';\n`);

        expect(messages).toEqual([expect.stringContaining('core/ imports nothing from migql/generators/')]);
    });

    test('an import inside core/ is accepted', async () => {
        const messages = await lint('core/src/probe.ts', `import './index.js';\n`);

        expect(messages).toEqual([]);
    });

    test('the same imports are accepted outside core/', async () => {
        const messages = await lint('cli/src/probe.ts', `import '../../databases/postgresql/src/index.js';\n`);

        expect(messages).toEqual([]);
    });
});
