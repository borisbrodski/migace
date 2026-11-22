// Keeps a temporary PostgreSQL server no longer than the process that asked for it.
//
// Usage: node server-watchdog.mjs <postgres> <data folder> <port>
//
// The process that starts this watchdog holds its standard input open. When that input ends,
// because the process closed it or because the process itself ended, the watchdog stops the
// server and removes the data folder. A server can therefore not be left behind.
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import process from 'node:process';

const [postgres, dataFolder, port] = process.argv.slice(2);

const server = spawn(postgres, [
    '-D', dataFolder,
    '-p', port,
    '-c', 'listen_addresses=127.0.0.1',
    '-c', 'unix_socket_directories=',
    '-c', 'fsync=off',
], { stdio: ['ignore', 'pipe', 'pipe'] });

// When the process that reads the output has ended, writing fails. That is one more sign to stop, not a crash.
process.stdout.on('error', () => stop());
process.stdout.write(JSON.stringify({ pid: server.pid }) + '\n');
server.stdout.pipe(process.stdout);
server.stderr.pipe(process.stdout);

let stopping = false;
function stop() {
    if (!stopping) {
        stopping = true;
        // SIGINT asks PostgreSQL for a fast shutdown: sessions are ended, the files are closed properly.
        server.kill('SIGINT');
    }
}

process.stdin.on('end', stop);
process.stdin.on('close', stop);
process.stdin.resume();

server.on('exit', code => {
    fs.rmSync(dataFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    process.exit(stopping ? 0 : code ?? 1);
});
