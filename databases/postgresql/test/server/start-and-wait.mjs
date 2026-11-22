// A process that starts a temporary server and then waits to be killed. For the test of a server that is left behind.
// It uses the compiled package: run "npm run build" before the tests of the server.
import process from 'node:process';
import { startTemporaryServer } from '../../out/index.js';

const server = await startTemporaryServer();
process.stdout.write(JSON.stringify({ pid: server.pid, dataFolder: server.dataFolder }));
setInterval(() => undefined, 1000);
