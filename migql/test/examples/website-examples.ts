import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGES = fileURLToPath(new URL('../../../website/src/pages', import.meta.url));

/** Top-level keys of the settings and release files. An example with one of them is no snippet. */
const SETTINGS_KEYS = /^(dialects|postgresql|schema|migrations|releases|baselines|upgrade-from|compatible-with|reference-tables|ledger|llm|proxy|batch|color|release):/m;

export type ExampleKind = 'snippet' | 'parts' | 'keys' | 'settings';

export interface WebsiteExample {
    /** `docs/snippets.md #2` */
    title: string;
    kind: ExampleKind;
    /** The example as a complete snippet. Fragments are placed into a minimal snippet. */
    text: string;
}

const MINIMAL_NAME = 'migration: 20260101-0900-example\n';

/** Reads every YAML example of the website. */
export function websiteExamples(): WebsiteExample[] {
    return pages(PAGES).flatMap(file => {
        const source = fs.readFileSync(file, 'utf8');
        const blocks = file.endsWith('.astro')
            ? [...source.matchAll(/const \w+ = `((?:migration|doc|parts):[\s\S]*?)`;/g)]
            : [...source.matchAll(/```yaml\n([\s\S]*?)```/g)];
        return blocks.map((block, index) => ({
            title: `${path.relative(PAGES, file)} #${index + 1}`,
            ...complete(block[1].endsWith('\n') ? block[1] : block[1] + '\n'),
        }));
    });
}

function pages(folder: string): string[] {
    return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(folder, entry.name);
        return entry.isDirectory() ? pages(file) : /\.(md|astro)$/.test(entry.name) ? [file] : [];
    }).sort();
}

function complete(block: string): { kind: ExampleKind, text: string } {
    const content = block.split('\n').filter(line => line.trim().length > 0 && !line.trim().startsWith('#'));
    const indent = Math.min(...content.map(line => line.length - line.trimStart().length));
    if (indent === 0 && SETTINGS_KEYS.test(block)) {
        return { kind: 'settings', text: block };
    }
    if (/^(migration|repair):/m.test(block)) {
        return { kind: 'snippet', text: block };
    }
    if (indent === 0) {
        return { kind: /^parts:/m.test(block) ? 'parts' : 'keys', text: MINIMAL_NAME + block };
    }
    if (indent === 2) {
        return { kind: 'parts', text: MINIMAL_NAME + 'parts:\n' + block };
    }
    return { kind: 'keys', text: MINIMAL_NAME + 'parts:\n  - example:\n' + block };
}
