import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startTemporaryServer, type TemporaryServer } from '../../src/index.js';

let server: TemporaryServer;

beforeAll(async () => {
    server = await startTemporaryServer();
}, 60_000);

afterAll(() => server?.stop());

async function query(database: string, sql: string): Promise<Array<Record<string, unknown>>> {
    const client = new pg.Client(server.connection(database));
    await client.connect();
    try {
        return (await client.query(sql)).rows;
    } finally {
        await client.end();
    }
}

const isRunning = (pid: number): boolean => {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

async function eventually(condition: () => boolean, seconds: number): Promise<boolean> {
    for (let tenths = 0; tenths < seconds * 10 && !condition(); tenths++) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return condition();
}

// M4.2-AC-01
describe('The temporary server', () => {
    test('is a PostgreSQL in a folder of its own, on a free port, for connections from this computer only', async () => {
        expect(server.host).toBe('127.0.0.1');
        expect(server.port).toBeGreaterThan(1024);
        expect(fs.existsSync(server.dataFolder)).toBe(true);
        expect(await query('postgres', "select current_setting('listen_addresses') as listen, current_setting('server_version_num')::integer >= 150000 as supported"))
            .toEqual([{ listen: '127.0.0.1', supported: true }]);
    });

    // M4.2-AC-05
    test('a new database is a copy of a prepared one', async () => {
        await server.createDatabase('prepared');
        await query('prepared', "create table book (id bigint primary key, title text); insert into book values (1, 'The Trial')");

        await server.createDatabase('first_copy', 'prepared');
        await server.createDatabase('second_copy', 'prepared');
        await query('first_copy', 'delete from book');

        expect(await query('first_copy', 'select count(*)::integer as books from book')).toEqual([{ books: 0 }]);
        expect(await query('second_copy', 'select title from book')).toEqual([{ title: 'The Trial' }]);
    });

    test('stopping it ends the process and removes the folder', async () => {
        const other = await startTemporaryServer();
        expect(isRunning(other.pid)).toBe(true);

        await other.stop();

        expect(isRunning(other.pid)).toBe(false);
        expect(fs.existsSync(other.dataFolder)).toBe(false);
        await other.stop();
    }, 60_000);

    // M4.2-AC-03
    test('ends within some seconds when the process that started it ends without stopping it', async () => {
        const helper = spawn(process.execPath, [fileURLToPath(new URL('./start-and-wait.mjs', import.meta.url))], { stdio: ['ignore', 'pipe', 'inherit'] });
        const started = await new Promise<{ pid: number, dataFolder: string }>((resolve, reject) => {
            helper.stdout.once('data', data => resolve(JSON.parse(String(data))));
            helper.once('exit', code => reject(new Error(`The helper ended with code ${code} before it started a server.`)));
        });
        expect(isRunning(started.pid)).toBe(true);

        helper.kill('SIGKILL');

        expect(await eventually(() => !isRunning(started.pid), 15)).toBe(true);
        expect(await eventually(() => !fs.existsSync(started.dataFolder), 15)).toBe(true);
    }, 60_000);
});

// M4.2-AC-04
describe('A server that cannot start', () => {
    test('binaries that are not there', async () => {
        await expect(startTemporaryServer({ binaries: '/no/such/folder' })).rejects.toThrow(
            'No PostgreSQL binaries in "/no/such/folder". The folder must hold initdb, pg_ctl and postgres, directly or in "bin".');
    });

    test('a port that is taken', async () => {
        const taken = net.createServer();
        await new Promise<void>(resolve => taken.listen(0, '127.0.0.1', resolve));
        const port = (taken.address() as net.AddressInfo).port;
        try {
            await expect(startTemporaryServer({ port })).rejects.toThrow(`PostgreSQL could not start on port ${port}: the port is taken.`);
        } finally {
            taken.close();
        }
    }, 60_000);

    test('the user root, which PostgreSQL refuses', async () => {
        await expect(startTemporaryServer({ userId: 0 })).rejects.toThrow(
            'PostgreSQL refuses to run as the user root. Start the build as another user.');
    });
});
