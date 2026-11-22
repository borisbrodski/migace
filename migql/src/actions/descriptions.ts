// Generated from constructs/<action>/construct.md by "npm run test:generate". Do not edit.

export interface ActionDescription {
    /** One line that says what the action does. */
    summary: string;
    /** The whole description, as Markdown. */
    description: string;
    parameters: Record<string, string>;
}

export const ACTION_DESCRIPTIONS: Record<string, ActionDescription> = {
    "column-ensure": {
        summary: "Makes sure that a column exists with at least the given type.",
        description: "Makes sure that a column exists with at least the given type.\n\n## Result\n\nThe column exists and has exactly the given type after the action, whether it was missing, narrower or already right.\n\n## Parameters\n\n| Parameter | Meaning |\n|---|---|\n| `table` | The table that gets the column. |\n| `column` | The name of the column. |\n| `type` | The type the column must have, for example `varchar(500)`. |\n| `default` | Optional. The default value of the column, used when the column is added. |\n| `not-null` | Optional. `true` makes the column mandatory when it is added. |\n\n## PostgreSQL\n\nOne block of code that decides in the database:\n\n- The column is missing: it is added.\n- The column has the type: nothing happens.\n- The column is narrower: it is widened. This holds for a longer `varchar` or `char`, and for a `numeric` with a larger precision and the same scale.\n- Anything else: the part fails with a message that shows the type the column has.\n\n## Locks\n\nAdding a column without a default and widening a `varchar` change only the catalog; the strong lock on the table is held for a moment. Widening a `numeric` can rewrite the table and holds the lock meanwhile.\n\n## After a failure\n\nThe action is one step and one transaction. After a failure nothing is changed, and the next run decides again.\n\n## Notes\n\n- No condition is needed around this action. It says what is wanted.\n- `default` and `not-null` are used only when the column is added. An existing column keeps its own.",
        parameters: {
            "table": "The table that gets the column.",
            "column": "The name of the column.",
            "type": "The type the column must have, for example `varchar(500)`.",
            "default": "Optional. The default value of the column, used when the column is added.",
            "not-null": "Optional. `true` makes the column mandatory when it is added.",
        },
    },
    "column-rename": {
        summary: "Gives a column another name.",
        description: "Gives a column another name.\n\n## Result\n\nThe column has the new name. Its values, its type and its constraints stay.\n\n## Parameters\n\n| Parameter | Meaning |\n|---|---|\n| `table` | The table of the column. |\n| `from` | The name the column has now. |\n| `to` | The new name. |\n\n## PostgreSQL\n\nIn a run without a phase: one statement, `alter table … rename column … to …`.\n\nWith the phases `start` and `finish`, a second column and a trigger keep older application versions working. That form comes with the upgrade phases.\n\n## Locks\n\nThe rename changes only the catalog. The strong lock on the table is held for a moment.\n\n## After a failure\n\nThe action is one step. After a failure nothing is changed, and the next run tries again.\n\n## Notes\n\n- A change of case only, such as `key` to `Key`, is an ordinary rename.\n- An older application version that uses the old name stops working after a plain rename.",
        parameters: {
            "table": "The table of the column.",
            "from": "The name the column has now.",
            "to": "The new name.",
        },
    },
    "column-set-not-null": {
        summary: "Makes a column mandatory without blocking the table while its rows are read.",
        description: "Makes a column mandatory without blocking the table while its rows are read.\n\n## Result\n\nThe column is `not null`. Every row must have a value before; fill the rows in an earlier part.\n\n## Parameters\n\n| Parameter | Meaning |\n|---|---|\n| `table` | The table of the column. |\n| `column` | The column that becomes mandatory. |\n\n## PostgreSQL\n\nFour steps:\n\n1. A check constraint `<table>_<column>_not_null` that says the column is not null, added as not valid.\n2. The validation of that constraint.\n3. `alter table … alter column … set not null`. PostgreSQL sees the valid constraint and does not read the table again.\n4. The removal of the constraint.\n\n## Locks\n\nSteps 1, 3 and 4 take the strong lock on the table for a moment. Step 2 reads all rows under a lock that lets everybody read and write.\n\n## After a failure\n\n- Step 1 fails if a constraint with the helper name exists already. Nothing is changed then.\n- Step 2 fails if a row has no value. The helper constraint stays, not valid. Fill the rows and run again; the run continues with step 2.\n- After a failure in step 3 or 4 the next run continues there.\n\n## Notes\n\n- The plain statement `alter table … alter column … set not null` under `do` is one step. It reads the whole table under the strong lock.",
        parameters: {
            "table": "The table of the column.",
            "column": "The column that becomes mandatory.",
        },
    },
    "constraint-add-check": {
        summary: "Adds a check constraint without blocking the table while its rows are checked.",
        description: "Adds a check constraint without blocking the table while its rows are checked.\n\n## Result\n\nThe check constraint exists and is valid. Every row must fulfil the condition.\n\n## Parameters\n\n| Parameter | Meaning |\n|---|---|\n| `name` | The name of the constraint. The second step needs it. |\n| `table` | The table that gets the constraint. |\n| `check` | The condition that every row must fulfil, for example `price_cents >= 0`. An expression is written in the block form. |\n\n## PostgreSQL\n\nTwo steps:\n\n1. The constraint is added as not valid. New and changed rows are checked from now on.\n2. The validation of the constraint checks the rows that exist.\n\n## Locks\n\nStep 1 takes the strong lock on the table for a moment. Step 2 reads the rows under a lock that lets everybody read and write.\n\n## After a failure\n\n- Step 2 fails if a row does not fulfil the condition. The constraint stays, not valid. Correct the rows and run again; the run continues with step 2.\n\n## Notes\n\n- The plain statement `alter table … add constraint … check (…)` under `do` is one step. It checks all rows under the strong lock.\n- State what you assume with `verify-before`, so that the message names the rows that are wrong.",
        parameters: {
            "name": "The name of the constraint. The second step needs it.",
            "table": "The table that gets the constraint.",
            "check": "The condition that every row must fulfil, for example `price_cents >= 0`. An expression is written in the block form.",
        },
    },
    "constraint-add-foreign-key": {
        summary: "Adds a foreign key without blocking the table while its rows are checked.",
        description: "Adds a foreign key without blocking the table while its rows are checked.\n\n## Result\n\nThe foreign key exists and is valid. Every row must point to an existing row of the other table.\n\n## Parameters\n\n| Parameter | Meaning |\n|---|---|\n| `name` | The name of the constraint. The second step needs it. |\n| `table` | The table that gets the foreign key. |\n| `columns` | The column that points to the other table, or a list of columns: `[book_id, currency]`. |\n| `references` | The table that is pointed to. |\n| `referenced-columns` | Optional. The columns of the other table. Without it, its primary key. |\n\n## PostgreSQL\n\nTwo steps:\n\n1. The constraint is added as not valid. New and changed rows are checked from now on.\n2. The validation of the constraint checks the rows that exist.\n\n## Locks\n\nStep 1 takes a strong lock on both tables for a moment. Step 2 reads the rows under a lock that lets everybody read and write.\n\n## After a failure\n\n- Step 2 fails if a row points to nothing. The constraint stays, not valid. Correct the rows and run again; the run continues with step 2.\n\n## Notes\n\n- The plain statement `alter table … add constraint … foreign key …` under `do` is one step. It checks all rows under its lock.\n- A rule for a deleted row, such as `on delete cascade`, has no parameter yet. Use the plain statement in a `native` part until it has.",
        parameters: {
            "name": "The name of the constraint. The second step needs it.",
            "table": "The table that gets the foreign key.",
            "columns": "The column that points to the other table, or a list of columns: `[book_id, currency]`.",
            "references": "The table that is pointed to.",
            "referenced-columns": "Optional. The columns of the other table. Without it, its primary key.",
        },
    },
};
