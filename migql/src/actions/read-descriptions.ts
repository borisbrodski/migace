import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Action } from './catalogue.js';

/**
 * The description of an action is written once, in `construct.md` of its folder in the catalogue.
 * This file turns those notes into the source of `descriptions.ts`, which the editor and the YAML schema read.
 * `npm run test:generate` writes the file; a test fails when it is not up to date.
 */
export function descriptionsSource(catalogue: string, actions: Action[]): string {
    const entries = actions.map(action => {
        const note = fs.readFileSync(path.join(catalogue, action.name, 'construct.md'), 'utf8').replace(/\r\n/g, '\n');
        const body = note.replace(/^# .*\n+/, '').trimEnd();
        const summary = body.split('\n')[0];
        const rows = [...sectionOf(body, 'Parameters').matchAll(/^\| `([\w-]+)` \| (.*) \|$/gm)];
        return `    ${JSON.stringify(action.name)}: {\n` +
            `        summary: ${JSON.stringify(summary)},\n` +
            `        description: ${JSON.stringify(body)},\n` +
            '        parameters: {\n' +
            rows.map(row => `            ${JSON.stringify(row[1])}: ${JSON.stringify(row[2])},\n`).join('') +
            '        },\n' +
            '    },\n';
    });
    return '// Generated from constructs/<action>/construct.md by "npm run test:generate". Do not edit.\n\n' +
        'export interface ActionDescription {\n' +
        '    /** One line that says what the action does. */\n' +
        '    summary: string;\n' +
        '    /** The whole description, as Markdown. */\n' +
        '    description: string;\n' +
        '    parameters: Record<string, string>;\n' +
        '}\n\n' +
        'export const ACTION_DESCRIPTIONS: Record<string, ActionDescription> = {\n' + entries.join('') + '};\n';
}

function sectionOf(body: string, title: string): string {
    const start = body.indexOf(`## ${title}`);
    const end = body.indexOf('\n## ', start + 1);
    return start < 0 ? '' : body.substring(start, end < 0 ? undefined : end);
}
