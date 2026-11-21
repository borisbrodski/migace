import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import type { SchemaModel } from '@migace/core';
import { PostgresqlSchemaReader } from '@migace/postgresql';
import { generateSteps } from '../../generators/postgresql/index.js';
import type { Snippet } from '../../src/generated/ast.js';
import { partsOf } from '../../src/model/snippet.js';

const BOOKSHOP_SCHEMA = fileURLToPath(new URL('../../../examples/bookshop/schema', import.meta.url));

/**
 * A PostgreSQL in the test process with the schema of the bookshop.
 * Every call of `bookshop` gives a new schema, so one database serves a whole test file.
 */
export function createBookshopDatabase() {
    const database = new PGlite({ extensions: { pg_trgm } });
    const ready = database.exec('create extension if not exists pg_trgm with schema public');
    const schemaFiles = fs.readdirSync(BOOKSHOP_SCHEMA).filter(file => file.endsWith('.sql')).sort()
        .map(file => fs.readFileSync(path.join(BOOKSHOP_SCHEMA, file), 'utf8'));
    let count = 0;
    let current = '';
    return {
        /** A new schema with the bookshop of release 1.0.0. More statements can prepare what a test needs. */
        bookshop: async (...more: string[]): Promise<void> => {
            await ready;
            current = `bookshop_${++count}`;
            await database.exec(`create schema ${current}; set search_path to ${current}, public;`);
            for (const sql of [...schemaFiles, ...more]) {
                await database.exec(sql);
            }
        },
        exec: (sql: string) => database.exec(sql),
        rows: async (sql: string) => (await database.query<Record<string, unknown>>(sql)).rows,
        /** Runs the generated statements of every part of the snippet, one after the other. */
        run: async (snippet: Snippet): Promise<void> => {
            for (const part of partsOf(snippet)) {
                for (const step of generateSteps(part)) {
                    await database.exec(step.sql);
                }
            }
        },
        model: (): Promise<SchemaModel> =>
            new PostgresqlSchemaReader(async (sql, parameters) => (await database.query<Record<string, unknown>>(sql, parameters)).rows, { schema: current }).read(),
    };
}
