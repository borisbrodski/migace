import { describe, expect, test } from 'vitest';
import { nameEntry, partsOf } from '../../src/model/snippet.js';
import { createMigql, lines } from '../support.js';

const { parse } = createMigql();

describe('Parser: envelope', () => {
    // M1-AC-01
    test('a snippet with migration, uid and one part with one do parses without problems', async () => {
        const document = await parse(lines(
            'migration: 20260302-0900-customer-loyalty',
            'uid: 01JF2A6QW3ZK8M4T7R9B5X0C1D',
            '',
            'parts:',
            '  - add-column:',
            '      do: update customer set loyalty_level = 1',
        ));

        expect(document).toHaveNoErrors();
        const snippet = document.parseResult.value;
        expect(nameEntry(snippet)?.name).toBe('20260302-0900-customer-loyalty');
        expect(partsOf(snippet).map(part => part.name)).toEqual(['add-column']);
    });
});
