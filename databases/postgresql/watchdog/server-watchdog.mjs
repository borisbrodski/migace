// Keeps a temporary PostgreSQL server no longer than the process that asked for it.
//
// Usage: node server-watchdog.mjs <pg_ctl> <data folder> <port>
//
// The process that starts this watchdog holds its standard input open. When that input ends,
// because the process closed it or because the process itself ended, the watchdog stops the
// server and removes the data folder. A server can therefore not be left behind.
//
// The server is started and stopped with pg_ctl, on every operating system. On Windows there is no other way:
// PostgreSQL refuses to run with the rights of an administrator, and pg_ctl starts it with fewer rights.
// A build server for Windows runs as an administrator.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

const [pgCtl, dataFolder, port] = process.argv.slice(2);
const logFile = `${dataFolder}.log`;
const options = `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories= -c fsync=off`;

const remove = () => {
    fs.rmSync(dataFolder, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    fs.rmSync(logFile, { force: true, maxRetries: 10, retryDelay: 200 });
};
const serverLog = () => fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';

// When the process that reads the output has ended, writing fails. That is one more sign to stop, not a crash.
process.stdout.on('error', () => stop());

const started = spawnSync(pgCtl, ['start', '-w', '-t', '60', '-D', dataFolder, '-l', logFile, '-o', options], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (started.status !== 0) {
    // The first line is for the process number. Without a server it stays empty.
    process.stdout.write(`\n${serverLog()}\n${started.stdout ?? ''}${started.stderr ?? ''}${started.error?.message ?? ''}`, () => {
        remove();
        process.exit(1);
    });
} else {
    // The first line of this file is the process number of the server.
    const pid = Number(fs.readFileSync(path.join(dataFolder, 'postmaster.pid'), 'utf8').split('\n')[0]);
    process.stdout.write(JSON.stringify({ pid }) + '\n');
    process.stdin.on('end', stop);
    process.stdin.on('close', stop);
    process.stdin.resume();
}

let stopping = false;
function stop() {
    if (stopping) {
        return;
    }
    stopping = true;
    // A fast shutdown: sessions are ended, the files are closed properly.
    spawnSync(pgCtl, ['stop', '-w', '-t', '60', '-m', 'fast', '-D', dataFolder], { stdio: 'ignore' });
    remove();
    process.exit(0);
}
