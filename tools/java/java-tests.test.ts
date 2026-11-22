import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const TOOL = fileURLToPath(new URL('../java.mjs', import.meta.url));

// M4.3-AC-17
test('without a JDK the Java tasks are left out with a message, and the command succeeds', () => {
    const result = spawnSync(process.execPath, [TOOL, 'test'], { env: { PATH: '', JAVA_HOME: '' }, encoding: 'utf8' });

    expect(result.stdout).toContain('No JDK found: the Java tasks "test" in clients/java are left out.');
    expect(result.status).toBe(0);
});
