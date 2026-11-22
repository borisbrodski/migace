import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll } from 'vitest';
import type { SchemaModel } from '@migace/core';
import { type Execute, PostgresqlSchemaReader, runScript, startTemporaryServer, type TemporaryServer } from '@migace/postgresql';

const BOOKSHOP_SCHEMA = fileURLToPath(new URL('../../../examples/bookshop/schema', import.meta.url));

/** The bookshop of release 1.0.0 as a database has it before any snippet ran, with a few rows. */
export const RELEASE_1_0_0 = ['101-generated.sql', '110-views.sql', '120-functions.sql']
    .map(file => fs.readFileSync(path.join(BOOKSHOP_SCHEMA, file), 'utf8'));

export const DATA = `
    insert into customer (id, name, mail, created_at) values (1, 'Maria', 'maria@example.org', now()), (2, 'Jo', null, now());
    insert into book (id, title, author, price_cents, stock) values (1, 'The Trial', 'Franz Kafka', 990, 3);
    insert into orders (id, customer_id, status, created_at, total_cents) values
        (1, 1, 'SHIPPED', timestamp '2026-01-10 10:00', 990), (2, 1, 'shipped ', timestamp '2026-02-01 09:00', 990), (3, 2, 'no idea', timestamp '2026-02-02 09:00', 0);`;

type Row = Record<string, unknown>;

/** Sends the statements of a runner over a connection of the PostgreSQL driver. */
export function executeOn(client: pg.Client): Execute {
    return async (sql, onNotice) => {
        const listener = (notice: { message?: string }) => onNotice(notice.message ?? '');
        client.on('notice', listener);
        try {
            return (await client.query(sql)).rows;
        } finally {
            client.off('notice', listener);
        }
    };
}

/**
 * One real PostgreSQL server for a test file. Every call of `bookshop` gives a new database:
 * a copy of a prepared one that holds the bookshop of release 1.0.0.
 */
export function useServer() {
    let server: TemporaryServer;
    let count = 0;
    const clients: pg.Client[] = [];

    beforeAll(async () => {
        server = await startTemporaryServer();
        await server.createDatabase('bookshop_1_0_0');
        const client = new pg.Client(server.connection('bookshop_1_0_0'));
        await client.connect();
        for (const sql of [...RELEASE_1_0_0, DATA]) {
            await client.query(sql);
        }
        await client.end();
    });

    afterAll(async () => {
        await Promise.all(clients.map(client => client.end().catch(() => undefined)));
        await server?.stop();
    });

    const connect = async (database: string, user?: string): Promise<pg.Client> => {
        const client = new pg.Client({ ...server.connection(database), ...(user ? { user } : {}) });
        // A session that the server ends reports an error on the connection. The tests that end sessions expect it.
        client.on('error', () => undefined);
        await client.connect();
        clients.push(client);
        return client;
    };

    return {
        server: () => server,
        /** A new database with the bookshop of release 1.0.0. Returns its name. */
        bookshop: async (): Promise<string> => {
            const name = `bookshop_${++count}`;
            await server.createDatabase(name, 'bookshop_1_0_0');
            return name;
        },
        connect,
        /** Runs a script with the reference runner on a connection of its own. Returns the notices. */
        run: async (database: string, script: string, parameters: Record<string, string> = {}): Promise<string[]> => {
            const client = await connect(database);
            const notices: string[] = [];
            try {
                await runScript(script, executeOn(client), { parameters: { schema: 'public', ...parameters }, onNotice: notice => notices.push(notice) });
            } finally {
                await client.end();
            }
            return notices;
        },
        rows: async (database: string, sql: string): Promise<Row[]> => {
            const client = await connect(database);
            try {
                return (await client.query(sql)).rows;
            } finally {
                await client.end();
            }
        },
        model: async (database: string): Promise<SchemaModel> => {
            const client = await connect(database);
            try {
                return await new PostgresqlSchemaReader(async (sql, parameters) => (await client.query(sql, parameters)).rows, { schema: 'public' }).read();
            } finally {
                await client.end();
            }
        },
    };
}

/** What the ledger says about the parts, without times and numbers of runs. */
export const LEDGER = 'select snippet_name, part, step, steps, state, sql, checksum, error_message from mig_part_run order by id';
