import { type ChildProcess, execFile, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';

/** The setting that names a folder with PostgreSQL binaries. Its name is provisional. */
export const BINARIES_VARIABLE = 'MIGACE_POSTGRESQL_BINARIES';

const WATCHDOG = fileURLToPath(new URL('../watchdog/server-watchdog.mjs', import.meta.url));
const USER = 'postgres';

export interface TemporaryServerOptions {
    /** A folder with `initdb`, `pg_ctl` and `postgres`, directly or in `bin`. Default: the environment variable, then the package of binaries. */
    binaries?: string;
    /** The port. Default: a free one. */
    port?: number;
    /** The user id of this process. Only tests give it. */
    userId?: number;
}

export interface Connection {
    host: string;
    port: number;
    user: string;
    database: string;
}

/** A PostgreSQL server that runs as a child process, in a folder of its own, for as long as this process wants it. */
export interface TemporaryServer {
    readonly host: string;
    readonly port: number;
    /** The process number of the server. */
    readonly pid: number;
    readonly dataFolder: string;
    /** What is needed to connect to a database of the server. The user is a superuser and needs no password. */
    connection(database?: string): Connection;
    /** Creates a database, empty or as a copy of another one. Nobody may be connected to the other one meanwhile. */
    createDatabase(name: string, copyOf?: string): Promise<void>;
    /** Ends the server and removes its folder. */
    stop(): Promise<void>;
}

/**
 * Starts a PostgreSQL server from binaries, without Docker. It accepts connections from this computer only.
 * The server ends when `stop` is called, and also when this process ends without calling it.
 */
export async function startTemporaryServer(options: TemporaryServerOptions = {}): Promise<TemporaryServer> {
    if ((options.userId ?? process.getuid?.()) === 0) {
        throw new Error('PostgreSQL refuses to run as the user root. Start the build as another user.');
    }
    const binaries = await findBinaries(options.binaries ?? process.env[BINARIES_VARIABLE]);
    const dataFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'migace-postgresql-'));
    const port = options.port ?? await freePort();
    let watchdog: ChildProcess | undefined;
    try {
        await promisify(execFile)(binaries.initdb, ['-D', dataFolder, '-U', USER, '-A', 'trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
        watchdog = spawn(process.execPath, [WATCHDOG, binaries.pg_ctl, dataFolder, String(port)], { stdio: ['pipe', 'pipe', 'inherit'] });
        const pid = await untilReady(watchdog, port);
        return temporaryServer(watchdog, pid, port, dataFolder);
    } catch (error) {
        watchdog?.stdin?.end();
        fs.rmSync(dataFolder, { recursive: true, force: true });
        throw error;
    }
}

function temporaryServer(watchdog: ChildProcess, pid: number, port: number, dataFolder: string): TemporaryServer {
    const host = '127.0.0.1';
    const connection = (database = 'postgres'): Connection => ({ host, port, user: USER, database });
    const ended = new Promise<void>(resolve => watchdog.once('exit', () => resolve()));
    return {
        host, port, pid, dataFolder, connection,
        async createDatabase(name, copyOf) {
            const client = new pg.Client(connection());
            await client.connect();
            try {
                await client.query(`create database ${quoted(name)}${copyOf ? ` template ${quoted(copyOf)}` : ''}`);
            } finally {
                await client.end();
            }
        },
        async stop() {
            // The watchdog stops the server when its input ends.
            watchdog.stdin?.end();
            await ended;
        },
    };
}

function quoted(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
}

interface Binaries {
    initdb: string;
    pg_ctl: string;
}

/** A folder that the caller names, or the package of binaries for this platform. */
async function findBinaries(folder: string | undefined): Promise<Binaries> {
    if (folder) {
        const executable = (name: string) => [folder, path.join(folder, 'bin')]
            .map(candidate => path.join(candidate, process.platform === 'win32' ? `${name}.exe` : name))
            .find(candidate => fs.existsSync(candidate));
        const [initdb, pgCtl, postgres] = ['initdb', 'pg_ctl', 'postgres'].map(executable);
        if (!initdb || !pgCtl || !postgres) {
            throw new Error(`No PostgreSQL binaries in "${folder}". The folder must hold initdb, pg_ctl and postgres, directly or in "bin".`);
        }
        return { initdb, pg_ctl: pgCtl };
    }
    const platform = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform as string] ?? process.platform;
    const packageName = `@embedded-postgres/${platform}-${process.arch}`;
    try {
        return await import(packageName) as Binaries;
    } catch {
        throw new Error(`No PostgreSQL binaries for this platform: the package ${packageName} is not installed. ` +
            `Install it, or set ${BINARIES_VARIABLE} to the folder of a PostgreSQL that is installed.`);
    }
}

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const { port } = probe.address() as net.AddressInfo;
            probe.close(() => resolve(port));
        });
    });
}

/** Waits until the server accepts connections. Returns its process number. */
async function untilReady(watchdog: ChildProcess, port: number): Promise<number> {
    let log = '';
    let exited = false;
    watchdog.stdout?.on('data', data => { log += String(data); });
    watchdog.once('exit', () => { exited = true; });
    for (;;) {
        if (exited) {
            throw new Error(/could not bind|Address already in use|could not create any TCP\/IP sockets/.test(log)
                ? `PostgreSQL could not start on port ${port}: the port is taken.`
                : `PostgreSQL could not start:\n${log.split('\n').slice(1).join('\n').trim()}`);
        }
        // The time limit matters when something else owns the port: it accepts the connection and never answers.
        const client = new pg.Client({ host: '127.0.0.1', port, user: USER, database: 'postgres', connectionTimeoutMillis: 500 });
        try {
            await client.connect();
            await client.end();
            return (JSON.parse(log.split('\n')[0]) as { pid: number }).pid;
        } catch {
            await client.end().catch(() => undefined);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}
