import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { compare, differencesText } from '@migace/core';
import { BOOKSHOP_MIGRATIONS, scriptOf } from '../script/support.js';
import { EXTENSIONS, LEDGER, useServer } from './support.js';

const JAVA_BUILD = fileURLToPath(new URL('../../../clients/java/build', import.meta.url));
const JAR = path.join(JAVA_BUILD, 'libs', 'migace-runner.jar');
const DRIVER = path.join(JAVA_BUILD, 'driver');
const hasJdk = spawnSync('java', ['-version']).status === 0;

const { bookshop, run, rows, model, server } = useServer();

/** Runs the Java program with the PostgreSQL driver on the class path. */
function java(database: string, scriptFile: string) {
    const drivers = fs.readdirSync(DRIVER).map(file => path.join(DRIVER, file));
    const { host, port, user } = server().connection(database);
    const result = spawnSync('java', ['-cp', [JAR, ...drivers].join(path.delimiter), 'org.openbrod.migace.Main',
        '--url', `jdbc:postgresql://${host}:${port}/${database}`, '--user', user, '--schema', 'public', '--param', `other_schemas=${EXTENSIONS}`, scriptFile], { encoding: 'utf8' });
    return { code: result.status, lines: result.stdout.split(/\r?\n/).filter(line => line.length > 0), errors: result.stderr };
}

// M4.3-AC-16
describe.skipIf(!hasJdk)('The Java program on a real server', () => {
    test('runs the bookshop script with the same notices, model and ledger as the reference runner', async () => {
        const script = await scriptOf(BOOKSHOP_MIGRATIONS);
        const scriptFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migace-java-')), 'migration-script-pg.sql');
        fs.writeFileSync(scriptFile, script);
        const withReference = await bookshop();
        const withJava = await bookshop();

        const notices = await run(withReference, script);
        const first = java(withJava, scriptFile);

        expect(first.errors).toBe('');
        expect(first.code).toBe(0);
        expect(first.lines).toEqual(notices);
        expect(differencesText(compare(await model(withReference), await model(withJava)))).toBe('');
        expect(await rows(withJava, LEDGER)).toEqual(await rows(withReference, LEDGER));

        const second = java(withJava, scriptFile);
        expect(second.code).toBe(0);
        expect(second.lines[second.lines.length - 1]).toBe('Nothing to do.');
    });

    test('ends with the code 1 and the message of the script when a part fails', async () => {
        const scriptFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migace-java-')), 'failing.sql');
        fs.writeFileSync(scriptFile, (await scriptOf(BOOKSHOP_MIGRATIONS)).replace('-- @migace script format=1', '-- @migace script format=1\n-- @migace statement label="a label"\nselect 1 / 0'));

        const result = java(await bookshop(), scriptFile);

        expect(result.code).toBe(1);
        expect(result.errors.trim()).toBe('a label: ERROR: division by zero');
    });
});

test.skipIf(hasJdk)('No JDK found: the test of the Java program on a real server is left out', () => undefined);
