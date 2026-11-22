#!/usr/bin/env node
// Runs Gradle tasks of the Java runner in clients/java with its wrapper.
// Without a JDK the tasks are left out with a message, and the command succeeds: the rest of the build needs no Java.
// Usage: node tools/java.mjs <task> [<task> …]
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tasks = process.argv.slice(2);
const windows = process.platform === 'win32';
const hasJdk = spawnSync('java', ['-version'], { shell: windows }).status === 0;
if (!hasJdk) {
    console.log(`No JDK found: the Java tasks "${tasks.join(' ')}" in clients/java are left out.`);
    process.exit(0);
}
const folder = fileURLToPath(new URL('../clients/java', import.meta.url));
const result = spawnSync(windows ? 'gradlew.bat' : './gradlew', ['--console=plain', '-q', ...tasks], { cwd: folder, stdio: 'inherit', shell: windows });
process.exit(result.status ?? 1);
