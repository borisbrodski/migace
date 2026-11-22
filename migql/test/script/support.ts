import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import type { Plan, SchemaModel } from '@migace/core';
import { PostgresqlSchemaReader, runScript, writeScript } from '@migace/postgresql';
import { type CompileOptions, compilePlan } from '../../generators/postgresql/plan.js';
import { loadProject } from '../../src/project.js';
import { projectWith } from '../plan/project-folder.js';

const BOOKSHOP_SCHEMA = fileURLToPath(new URL('../../../examples/bookshop/schema', import.meta.url));
export const BOOKSHOP_MIGRATIONS = fileURLToPath(new URL('../../../examples/bookshop/migrations', import.meta.url));

/** The bookshop of release 1.0.0 as a database has it before any snippet ran: without what the snippets add. */
const RELEASE_1_0_0 = ['101-generated.sql', '110-views.sql', '120-functions.sql'];

type Row = Record<string, unknown>;

/**
 * A PostgreSQL in the test process on which migration scripts run. Every call of `bookshop` or `empty`
 * gives a new schema, so one database serves a whole test file.
 */
export function createScriptDatabase() {
    const database = new PGlite({ extensions: { pg_trgm } });
    const ready = database.exec('create extension if not exists pg_trgm with schema public');
    let count = 0;
    let schema = '';
    const query = async (sql: string, parameters?: unknown[]) => (await database.query<Row>(sql, parameters)).rows;
    const newSchema = async (...sql: string[]) => {
        await ready;
        schema = `shop_${++count}`;
        await database.exec(`create schema ${schema}; set search_path to ${schema}, public;`);
        for (const statement of sql) {
            await database.exec(statement);
        }
        await database.exec('set search_path to public');
    };
    const run = async (script: string, parameters: Record<string, string> = { schema }): Promise<string[]> => {
        const notices: string[] = [];
        try {
            await runScript(script, async (sql, onNotice) => (await database.query<Row>(sql, [], { onNotice: notice => onNotice(notice.message ?? '') })).rows,
                { parameters, onNotice: notice => notices.push(notice) });
        } finally {
            // A run that failed outside a transaction keeps its lock until the session ends. The tests share one session.
            await database.exec('select pg_advisory_unlock_all(); set search_path to public');
        }
        return notices;
    };
    return {
        /** A new schema with the bookshop of release 1.0.0, and what the test adds. */
        bookshop: (...more: string[]) => newSchema(...RELEASE_1_0_0.map(file => fs.readFileSync(path.join(BOOKSHOP_SCHEMA, file), 'utf8')), ...more),
        /** A new schema with what the test gives. */
        empty: (...sql: string[]) => newSchema(...sql),
        schema: () => schema,
        /** Runs a statement in the schema of the test. */
        exec: async (sql: string) => {
            await database.exec(`set search_path to ${schema}, public; ${sql}; set search_path to public`);
        },
        /** The rows of a query in the schema of the test. */
        rows: async (sql: string): Promise<Row[]> => {
            await database.exec(`set search_path to ${schema}, public`);
            try {
                return await query(sql);
            } finally {
                await database.exec('set search_path to public');
            }
        },
        /** Sends a script through the reference runner and returns the notices of the server. */
        run,
        /** Runs a script that must fail. Returns the message of the error and the notices before it. */
        runFailing: async (script: string): Promise<{ error: string, notices: string[] }> => {
            const notices: string[] = [];
            try {
                await runScript(script, async (sql, onNotice) => (await database.query<Row>(sql, [], { onNotice: notice => onNotice(notice.message ?? '') })).rows,
                    { parameters: { schema }, onNotice: notice => notices.push(notice) });
            } catch (error) {
                return { error: (error as Error).message, notices };
            } finally {
                await database.exec('select pg_advisory_unlock_all(); set search_path to public');
            }
            throw new Error(`The script did not fail. Notices:\n${notices.join('\n')}`);
        },
        model: (options: { ledgerPrefix?: string } = {}): Promise<SchemaModel> => new PostgresqlSchemaReader(query, { schema, ...options }).read(),
    };
}

/** The script of a project folder. */
export async function scriptOf(folder: string, options: CompileOptions = {}): Promise<string> {
    return writeScript(await planOf(folder, options));
}

export async function planOf(folder: string, options: CompileOptions = {}): Promise<Plan> {
    return compilePlan(await loadProject(folder), options);
}

/** The script of snippets that are given as `name: [lines after the name and the uid]`. */
export async function scriptWith(snippets: Record<string, string[]>, options: CompileOptions = {}): Promise<string> {
    return scriptOf(projectWith(snippets), options);
}
