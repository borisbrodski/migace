import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parse as parseYaml } from 'yaml';
import { describe, expect, test } from 'vitest';
import { ACTIONS } from '../../src/actions/catalogue.js';
import { ACTION_DESCRIPTIONS } from '../../src/actions/descriptions.js';
import { yamlSchema } from '../../src/schema/yaml-schema.js';
import { createMigql } from '../support.js';

const { services } = createMigql();

const SCHEMA_FILE = fileURLToPath(new URL('../../schema/migql.schema.json', import.meta.url));
const CATALOGUE = fileURLToPath(new URL('../../constructs', import.meta.url));

const schema = yamlSchema(services.migql.Grammar);
const validate = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true }).compile(schema);

function accepts(yaml: string): boolean {
    return validate(parseYaml(yaml)) === true;
}

function examples(kind: 'dsls' | 'invalid'): string[] {
    return fs.readdirSync(CATALOGUE, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(construct => {
        const folder = path.join(CATALOGUE, construct.name, kind);
        return fs.readdirSync(folder).filter(file => file.endsWith('.migql.yaml')).sort().map(file => path.join(construct.name, kind, file));
    });
}

const read = (file: string) => fs.readFileSync(path.join(CATALOGUE, file), 'utf8').replace(/<<\{\||\|\}>>/g, '');

// M3.2-AC-28
describe('YAML schema: the file', () => {
    test('is generated from the definitions of the keys and is up to date', () => {
        const text = JSON.stringify(schema, null, 2) + '\n';
        if (process.env.GENERATOR_TEST === 'generate') {
            fs.writeFileSync(SCHEMA_FILE, text);
        }

        expect(fs.readFileSync(SCHEMA_FILE, 'utf8')).toBe(text);
    });
});

// M3.2-AC-29
describe('YAML schema: what it describes', () => {
    const properties = (schema as { properties: Record<string, unknown> }).properties;
    const partBody = (schema as never as { $defs: { part: { properties: Record<string, { description?: string, required?: string[], properties?: Record<string, { description?: string }> }> } } }).$defs.part.properties;

    test('the keys of a snippet and of a part', () => {
        expect(Object.keys(properties)).toEqual([
            'migration', 'repair', 'uid', 'doc', 'let', 'parts', 'testdata', 'testdata-before', 'changed', 'retired', 'requires-downtime',
        ]);
        expect(Object.keys(partBody)).toEqual([
            'do', ...ACTIONS.map(action => action.name), 'insert', 'upsert', 'native', 'stop', 'when', 'verify-before', 'verify-after',
            'batch', 'expect-rows', 'phase', 'todo', 'retired',
        ]);
    });

    test('every action with its parameters, the mandatory ones, and the descriptions', () => {
        for (const action of ACTIONS) {
            const described = partBody[action.name];
            expect(described.description).toBe(ACTION_DESCRIPTIONS[action.name].description);
            expect(Object.keys(described.properties!)).toEqual(action.parameters.map(parameter => parameter.name));
            expect(described.required).toEqual(action.parameters.filter(parameter => parameter.mandatory).map(parameter => parameter.name));
            for (const parameter of action.parameters) {
                expect(described.properties![parameter.name].description).toBe(ACTION_DESCRIPTIONS[action.name].parameters[parameter.name]);
            }
        }
    });

    test('the keys carry the explanations of the grammar', () => {
        expect((properties.uid as { description: string }).description).toMatch(/^The identity of the snippet/);
        expect(partBody.batch.description).toMatch(/^Runs a data statement in portions/);
    });

    test('the allowed values of keys that take a fixed word', () => {
        expect(accepts('migration: 20260302-0900-x\nrequires-downtime: true\n')).toBe(true);
        expect(accepts('migration: 20260302-0900-x\nrequires-downtime: sometimes\n')).toBe(false);
        expect(accepts('migration: 20260302-0900-x\nparts:\n  - p:\n      do: delete from t\n      phase: finish\n')).toBe(true);
        expect(accepts('migration: 20260302-0900-x\nparts:\n  - p:\n      do: delete from t\n      phase: start\n')).toBe(false);
        expect(accepts('migration: 20260302-0900-x\ntestdata:\n  - table: t\n    fill: required\n')).toBe(true);
        expect(accepts('migration: 20260302-0900-x\ntestdata:\n  - table: t\n    fill: some\n')).toBe(false);
    });

    test('a statement under do is a text', () => {
        expect(accepts('migration: 20260302-0900-x\nparts:\n  - p:\n      do: this is ( not checked\n')).toBe(true);
        expect(accepts('migration: 20260302-0900-x\nparts:\n  - p:\n      do:\n        nested: map\n')).toBe(false);
    });
});

// M3.2-AC-30
describe('YAML schema: the catalogue', () => {
    test.each(examples('dsls'))('%s is accepted', file => {
        validate(parseYaml(read(file)));

        expect(validate.errors ?? []).toEqual([]);
    });

    test.each([
        'column-ensure/invalid/type-missing.migql.yaml',
        'column-rename/invalid/to-missing.migql.yaml',
        'column-rename/invalid/unknown-parameter.migql.yaml',
        'column-set-not-null/invalid/column-missing.migql.yaml',
        'constraint-add-check/invalid/check-missing.migql.yaml',
        'constraint-add-foreign-key/invalid/name-missing.migql.yaml',
        'upsert/invalid/key-missing.migql.yaml',
    ])('%s has a wrong or a missing key and is rejected', file => {
        expect(examples('invalid')).toContain(file.replace(/\//g, path.sep));
        expect(accepts(read(file))).toBe(false);
    });

    test('an unknown key and a key that is written twice are rejected', () => {
        expect(accepts('migration: 20260302-0900-x\ncolour: red\n')).toBe(false);
        expect(accepts('migration: 20260302-0900-x\nparts:\n  - p:\n      do: delete from t\n      colour: red\n')).toBe(false);
        expect(() => parseYaml('migration: 20260302-0900-x\nuid: A\nuid: B\n')).toThrow(/Map keys must be unique/);
    });

    test('a snippet needs migration or repair', () => {
        expect(accepts('uid: A\n')).toBe(false);
        expect(accepts('repair: 20260302-0900-x\n')).toBe(true);
    });
});

// M3.2-AC-31
describe('YAML schema: how an editor finds it', () => {
    test('a README beside the schema says it', () => {
        const readme = fs.readFileSync(path.join(path.dirname(SCHEMA_FILE), 'README.md'), 'utf8');

        expect(readme).toContain('yaml-language-server: $schema=');
        expect(readme).toContain('*.migql.yaml');
    });
});
