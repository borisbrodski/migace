import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import type { Plan, SchemaModel } from '@migace/core';
import { PostgresqlSchemaReader, RUN_SETTINGS, runScript, writeScript } from '@migace/postgresql';
import { type CompileOptions, compilePlan } from '../../generators/postgresql/plan.js';
import { loadProject } from '../../src/project.js';
import { projectWith } from '../plan/project-folder.js';

const BOOKSHOP_SCHEMA = fileURLToPath(new URL('../../../examples/bookshop/schema', import.meta.url));
export const BOOKSHOP_MIGRATIONS = fileURLToPath(new URL('../../../examples/bookshop/migrations', import.meta.url));

/** The bookshop of release 1.0.0 as a database has it before any snippet ran: without what the snippets add. */
const RELEASE_1_0_0 = ['101-generated.sql', '110-views.sql', '120-functions.sql'];

/** The schema of the extension pg_trgm, which the bookshop needs. A run names it with the parameter other_schemas. */
export const EXTENSIONS = 'extensions';

type Row = Record<string, unknown>;

/** The state of a session that a run must not change. */
export const SESSION_STATE = `select current_setting('search_path') as search_path, current_setting('lock_timeout') as lock_timeout,
    current_setting('statement_timeout') as statement_timeout,
    (select coalesce(string_agg(name || '=' || value, ', ' order by name), '') from (select name, current_setting('migace.' || name, true) as value
        from unnest(array[${RUN_SETTINGS.map(name => `'${name}'`).join(', ')}]) as name) settings where value <> '') as settings,
    (select count(*)::integer from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()) as locks,
    (select count(*)::integer from pg_proc where pronamespace = pg_my_temp_schema() and proname like 'migace%') as functions`;

/**
 * A PostgreSQL in the test process on which migration scripts run. Every call of `bookshop` or `empty`
 * gives a new schema, so one database serves a whole test file.
 */
export function createScriptDatabase() {
    const database = new PGlite({ extensions: { pg_trgm } });
    const ready = database.exec(`create schema ${EXTENSIONS}; create extension pg_trgm with schema ${EXTENSIONS}`);
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
    const send = async (sql: string, onNotice: (message: string) => void) =>
        (await database.query<Row>(sql, [], { onNotice: notice => onNotice(notice.message ?? '') })).rows;
    /**
     * Runs a script and checks that the session is as it was before: the tests share one session, as the connections of a pool do.
     * A run that leaves something behind fails, and the session is cleaned for the next test.
     */
    const runChecked = async (script: string, parameters: Record<string, string>, notices: string[]): Promise<void> => {
        const before = await sessionState();
        let failure: unknown;
        try {
            await runScript(script, send, { parameters, onNotice: notice => notices.push(notice) });
        } catch (error) {
            failure = error;
        }
        const after = await sessionState();
        if (JSON.stringify(after) !== JSON.stringify(before)) {
            await database.exec(`select pg_advisory_unlock_all(); set search_path to public; reset lock_timeout; reset statement_timeout;
                select set_config('migace.' || name, '', false) from unnest(array[${RUN_SETTINGS.map(name => `'${name}'`).join(', ')}]) as name`);
            throw new Error(`The run left the session changed.\nBefore: ${JSON.stringify(before)}\nAfter:  ${JSON.stringify(after)}\nError of the run: ${String(failure)}`);
        }
        if (failure !== undefined) {
            throw failure;
        }
    };
    const sessionState = async () => (await query(SESSION_STATE))[0];
    const run = async (script: string, parameters: Record<string, string> = { schema, other_schemas: EXTENSIONS }): Promise<string[]> => {
        const notices: string[] = [];
        await runChecked(script, parameters, notices);
        return notices;
    };
    return {
        /** A new schema with the bookshop of release 1.0.0, and what the test adds. */
        bookshop: (...more: string[]) => newSchema(...RELEASE_1_0_0.map(file => fs.readFileSync(path.join(BOOKSHOP_SCHEMA, file), 'utf8')), ...more),
        /** A new schema with what the test gives. */
        empty: (...sql: string[]) => newSchema(...sql),
        schema: () => schema,
        /** Runs statements in the session as it is, without changing its search path. */
        session: async (sql: string) => (await database.query<Row>(sql)).rows,
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
        runFailing: async (script: string, parameters: Record<string, string> = { schema, other_schemas: EXTENSIONS }): Promise<{ error: string, notices: string[] }> => {
            const notices: string[] = [];
            try {
                await runChecked(script, parameters, notices);
            } catch (error) {
                return { error: (error as Error).message, notices };
            }
            throw new Error(`The script did not fail. Notices:\n${notices.join('\n')}`);
        },
        /** What a run must leave as it found it: the search path, the limits, the settings of MIG-Ace, its locks and its functions. */
        sessionState,
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
