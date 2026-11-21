import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { createMigql } from '../support.js';
import { migqlStructure, yamlStructure } from './structure.js';
import { websiteExamples } from './website-examples.js';

const { services } = createMigql();

const CATALOGUE = fileURLToPath(new URL('../../constructs', import.meta.url));

function catalogueExamples(): Array<{ title: string, text: string }> {
    return fs.readdirSync(CATALOGUE, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(construct => {
        const folder = path.join(CATALOGUE, construct.name, 'dsls');
        return fs.readdirSync(folder).filter(file => file.endsWith('.migql.yaml'))
            .map(file => ({ title: `${construct.name}/${file}`, text: fs.readFileSync(path.join(folder, file), 'utf8') }));
    });
}

const examples = [
    ...catalogueExamples(),
    ...websiteExamples().filter(example => example.kind !== 'settings'),
];

// M1-AC-30
describe('A reference YAML parser sees the same file', () => {
    test.each(examples)('$title', ({ text }) => {
        const result = services.migql.parser.Lexer.tokenize(text);
        expect(result.errors).toEqual([]);

        expect(migqlStructure(result.tokens)).toEqual(yamlStructure(text));
    });
});
