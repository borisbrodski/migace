import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import type { SchemaModel } from '@migace/core';
import { PostgresqlSchemaReader, type Query, type ReadOptions } from '../src/index.js';

/**
 * A PostgreSQL in the test process: PGlite, without a server and without Docker.
 * Every schema of a test gets a name of its own, so one database serves a whole test file.
 */
export function createDatabase() {
    const database = new PGlite({ extensions: { pg_trgm } });
    // The extension lives in the schema public, so that every schema of a test finds its operator classes.
    const ready = database.exec('create extension if not exists pg_trgm with schema public');
    let count = 0;
    const query: Query = async (sql, parameters) => (await database.query<Record<string, unknown>>(sql, parameters)).rows;
    return {
        database,
        query,
        /** Runs the statements in a new schema and returns its name. */
        schemaWith: async (...sql: string[]): Promise<string> => {
            await ready;
            const schema = `test_${++count}`;
            await database.exec(`create schema ${schema}; set search_path to ${schema}, public;`);
            for (const statement of sql) {
                await database.exec(statement);
            }
            return schema;
        },
        read: (schema: string, options: Partial<ReadOptions> = {}): Promise<SchemaModel> =>
            new PostgresqlSchemaReader(query, { schema, ...options }).read(),
    };
}
