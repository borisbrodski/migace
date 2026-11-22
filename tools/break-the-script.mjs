#!/usr/bin/env node
// Proof that the tests notice a broken migration script: breaks one rule of the SQL in the script at a time
// and runs the tests. A mutation tool sees this SQL only as text, so the breaks are listed here by hand.
// Stored expected texts are rewritten during the series and restored afterwards, so that only tests of behaviour count.
// Usage: node tools/break-the-script.mjs       (needs a clean working tree in migql/test and takes some minutes)
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = `${root}databases/postgresql/src/script.ts`;

const BREAKS = [
    ['a part counts as run when any step is done', "r.state = 'done' and r.step = r.steps);", "r.state = 'done');"],
    ['the run lock is never taken', "while not pg_try_advisory_lock(hashtext('migace ' || current_schema())) loop", 'while false loop'],
    ['the waiting run keeps its transaction open', '        commit;\n        perform pg_sleep(0.2);\n        commit;', '        perform pg_sleep(0.2);'],
    ['a started step is not marked abandoned', "set state = 'abandoned', ended_at = clock_timestamp()", "set state = 'started', ended_at = clock_timestamp()"],
    ['a step outside a transaction is not marked done', "update ${t('part_run')} r set state = 'done', ended_at = clock_timestamp()", "update ${t('part_run')} r set state = 'started', ended_at = clock_timestamp()"],
    ['a failed snippet is stored as done', "and r.state = 'failed') then 'failed'", "and r.state = 'failed') then 'done'"],
    ['a run without steps is stored as done', "when v_executed = 0 then 'nothing to do' else 'done' end", "when v_executed = 0 then 'done' else 'done' end"],
    ['the lock time limit is not set', "perform set_config('lock_timeout', pg_temp.migace_setting('lock_timeout', '${LOCK_TIMEOUT}'), true);", 'perform 1;'],
    ['the default of lock attempts is 1', 'const LOCK_ATTEMPTS = 3;', 'const LOCK_ATTEMPTS = 1;'],
    ['the done row of a step is not written', "perform pg_temp.migace_record(p_uid, p_snippet, p_part, p_checksum, p_step, p_steps, 'done', p_sql, v_started, null, null, null, null);", 'perform 1;'],
    ['a done step is looked up without its number', "and r.step = p_step and r.state = 'done' order by r.id desc limit 1;", "and r.state = 'done' order by r.id desc limit 1;"],
];

const run = (command, cwd) => spawnSync(command, { cwd, shell: true, stdio: 'ignore' }).status;
const source = fs.readFileSync(file, 'utf8');
let unnoticed = 0;
try {
    for (const [name, from, to] of BREAKS) {
        if (!source.includes(from)) {
            console.log(`${'TEXT NOT FOUND'.padEnd(26)} ${name}`);
            unnoticed++;
            continue;
        }
        fs.writeFileSync(file, source.replace(from, to));
        let stage = 'PGlite tests';
        let status = run('npx vitest run -u test/script test/plan', `${root}migql`);
        run('git checkout -- migql/test', root);
        if (status === 0) {
            stage = 'server tests';
            status = run('npx vitest run --config vitest.server.config.ts', `${root}migql`);
        }
        console.log(`${(status === 0 ? 'NOT NOTICED' : `NOTICED by ${stage}`).padEnd(26)} ${name}`);
        unnoticed += status === 0 ? 1 : 0;
    }
} finally {
    fs.writeFileSync(file, source);
}
process.exit(unnoticed === 0 ? 0 : 1);
