import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { ACTIONS } from '../../src/actions/catalogue.js';
import { ACTION_DESCRIPTIONS } from '../../src/actions/descriptions.js';
import { descriptionsSource } from '../../src/actions/read-descriptions.js';

const CATALOGUE = fileURLToPath(new URL('../../constructs', import.meta.url));
const GENERATED = fileURLToPath(new URL('../../src/actions/descriptions.ts', import.meta.url));

// M3.2-AC-23
describe('Descriptions of the actions', () => {
    test('are written once, in construct.md: the file in the code is generated from there and is up to date', () => {
        const source = descriptionsSource(CATALOGUE, ACTIONS);
        if (process.env.GENERATOR_TEST === 'generate') {
            fs.writeFileSync(GENERATED, source);
        }

        expect(fs.readFileSync(GENERATED, 'utf8')).toBe(source);
    });

    test.each(ACTIONS)('$name has a summary of one line and a description with the fixed sections', action => {
        const description = ACTION_DESCRIPTIONS[action.name];

        expect(description.summary).toMatch(/^[A-Z][^\n]+\.$/);
        for (const section of ['## Result', '## Parameters', '## PostgreSQL', '## Locks', '## After a failure']) {
            expect(description.description).toContain(section);
        }
    });

    test.each(ACTIONS.flatMap(action => action.parameters.map(parameter => ({ action: action.name, parameter: parameter.name, mandatory: parameter.mandatory }))))(
        'the parameter $parameter of $action has a description', ({ action, parameter, mandatory }) => {
            const description = ACTION_DESCRIPTIONS[action].parameters[parameter];

            expect(description.length).toBeGreaterThan(10);
            expect(description.startsWith('Optional.')).toBe(!mandatory);
        });

    test('construct.md describes no parameter that the action does not have', () => {
        for (const action of ACTIONS) {
            expect(Object.keys(ACTION_DESCRIPTIONS[action.name].parameters)).toEqual(action.parameters.map(parameter => parameter.name));
        }
    });
});
