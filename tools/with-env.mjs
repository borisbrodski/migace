#!/usr/bin/env node
// Runs a command with environment variables set, on every operating system.
// Usage: node tools/with-env.mjs NAME=value [NAME=value …] command [arguments …]
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const env = { ...process.env };
while (args.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(args[0])) {
    const assignment = args.shift();
    const separator = assignment.indexOf('=');
    env[assignment.slice(0, separator)] = assignment.slice(separator + 1);
}
if (args.length === 0) {
    console.error('Usage: node tools/with-env.mjs NAME=value command [arguments …]');
    process.exit(2);
}
const result = spawnSync(args[0], args.slice(1), { env, stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
