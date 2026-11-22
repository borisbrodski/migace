import { describe, expect, test } from 'vitest';
import { DocumentIssueSeverity, DocumentIssueSource } from 'langium-tools/base';
import { createMigql, lines } from '../support.js';

const { parseMarked } = createMigql();

const NAME = 'migration: 20260302-0900-x';

function warning(message: string, markerId: number) {
    return { source: DocumentIssueSource.VALIDATION, severity: DocumentIssueSeverity.WARNING, message, markerId };
}

function part(...body: string[]): string {
    return lines(NAME, 'parts:', '  - p:', ...body.map(line => '      ' + line));
}

// M3.2-AC-20
describe('Warning: a do with a statement for which an action exists', () => {
    test.each([
        ['<<{|alter table customer alter column loyalty_level set not null|}>>',
            'column-set-not-null', 'It reads all rows while nobody can use the table.'],
        ['<<{|alter table review add constraint fk_review_book foreign key (book_id) references book|}>>',
            'constraint-add-foreign-key', 'It checks all rows while nobody can change the table.'],
        ['<<{|alter table book add constraint ck_book_price check (price_cents >= 0)|}>>',
            'constraint-add-check', 'It checks all rows while nobody can use the table.'],
        ['<<{|alter table customer rename column mail to email|}>>',
            'column-rename', 'An older version of the application that still runs does not find the column any more.'],
    ])('%s', async (statement, action, reason) => {
        const parsed = await parseMarked(part(`do: ${statement}`));

        expect(parsed).toHaveDocumentIssues([
            warning(`do runs this statement as it is written. ${reason} The action "${action}" has the same result without that.`, 0),
        ]);
        expect(parsed).toHaveNoErrors();
    });

    test('other statements have no warning', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:',
            '  - a:', '      do: alter table customer add column loyalty_level varchar(10)',
            '  - b:', '      do: alter table customer alter column loyalty_level drop not null',
            '  - c:', '      do: alter table customer add constraint uq_customer_mail unique (mail)',
            '  - d:', '      do: create index ix on customer (mail)',
        ));

        expect(parsed).toHaveNoIssues();
    });

    // M3.2-AC-22
    test('there is no warning for a table that the same snippet creates', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:',
            '  - create:', '      do: create table review (id bigint not null, book_id bigint, stars integer)',
            '  - fk:', '      do: alter table review add constraint fk_review_book foreign key (book_id) references book',
            '  - mandatory:', '      do: alter table review alter column book_id set not null',
        ));

        expect(parsed).toHaveNoIssues();
    });

    test('there is no warning in a snippet that requires downtime', async () => {
        const parsed = await parseMarked(lines(NAME, 'requires-downtime: true', 'parts:',
            '  - mandatory:', '      do: alter table customer alter column loyalty_level set not null'));

        expect(parsed).toHaveNoIssues();
    });

    test('requires-downtime: false keeps the warning', async () => {
        const parsed = await parseMarked(lines(NAME, 'requires-downtime: false', 'parts:',
            '  - mandatory:', '      do: <<{|alter table customer alter column loyalty_level set not null|}>>'));

        expect(parsed).toHaveDocumentIssues([
            warning('do runs this statement as it is written. It reads all rows while nobody can use the table. The action "column-set-not-null" has the same result without that.', 0),
        ]);
    });
});
