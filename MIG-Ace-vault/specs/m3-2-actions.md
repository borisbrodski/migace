---
type: spec
status: ready
milestone: M3.2
---

# M3.2 Actions

## Goal

`do` runs the statement that was written. Every operation for which MIG-Ace chooses the statements is an action with a key of its own and parameters in YAML. The editor and a YAML schema present the actions as a catalogue with full descriptions.

After this spec, a `do` part has one step in PostgreSQL, and the five actions of the first catalogue exist.

## Non-goals

- The form of `column-rename` for `start` and `finish`. Here it is a plain rename; the two phases come with their milestone.
- Further actions. The candidates are listed in [Actions](../migql/actions.md).
- The zero-downtime check as a command. This spec builds the warning in the editor and in `loadProject`.
- Publishing the YAML schema to a public catalogue of schemas.
- Completion of table and column names from the schema of the project.

## Builds on

- [`do` runs what was written; smart actions have their own keys](../decisions/do-is-literal-actions-have-names.md)
- [Actions](../migql/actions.md): names, parameters, the warning, the descriptions
- [YAML profile](../migql/yaml-profile.md)
- [Generation](../migql/generation.md): the catalogue of constructs
- [langium-tools](../migql/langium-tools.md)
- M3 and M3.1
- [Coding rules](../engineering/coding-rules.md)

## Order of work

1. `do` becomes literal.
2. The actions in the grammar, one at a time, each with its folder in the catalogue first.
3. The generator for each action.
4. The warning under `do`.
5. Descriptions, hover and completion.
6. The YAML schema.

## Acceptance criteria

### `do` is literal

- **M3.2-AC-01** `do: alter table customer alter column loyalty_level set not null` is generated as this one statement. The same holds for `add constraint … foreign key` and `add constraint … check`.
- **M3.2-AC-02** `do: alter table customer rename column mail to email` is accepted and generated as this one statement.
- **M3.2-AC-03** The statements `ensure column` and `rename column <table>.<old> to <new>` are no longer accepted under `do`. The error names the action that takes their place.
- **M3.2-AC-04** A test goes through every valid example of the catalogue that uses `do` and shows that its expected SQL has one step.
- **M3.2-AC-05** The expected files that change are regenerated and the diff is reviewed. The examples that lose their steps keep their place in the catalogue; a note in each `construct.md` points to the action.

### The actions in the language

- **M3.2-AC-06** A part takes one of the five actions in the place of `do`: `column-set-not-null`, `column-rename`, `column-ensure`, `constraint-add-foreign-key`, `constraint-add-check`. A part with an action and a `do`, or with two actions, is an error.
- **M3.2-AC-07** Every action is accepted as one line with `{ … }` and as a block with one parameter per line. Both forms give the same generated SQL.
- **M3.2-AC-08** The parameters are the ones of the table in [Actions](../migql/actions.md). A missing mandatory parameter, an unknown parameter and a parameter that is given twice are errors that name the action and the parameter, with the list of the parameters that are allowed.
- **M3.2-AC-09** A parameter for columns takes one name or a list. A list of several names, an expression and a type with a comma are accepted in the block form; in the form with `{ … }` they are errors that propose the block form.
- **M3.2-AC-10** A reference YAML parser reads every valid example and gives the same keys and values as the MigQL parser. This extends the comparison of M1.
- **M3.2-AC-11** The other keys of a part work with an action as with `do`: `when`, `verify-before`, `verify-after`, `phase`, `doc`.
- **M3.2-AC-12** Names in the parameters follow M3.1: they are exact, and a name with other characters is written in quotes.

### The catalogue and the generator

- **M3.2-AC-13** Every action has a folder in `migql/constructs/` with the name of the action, with valid examples, invalid examples and expected SQL. The folders `ensure-column` and `rename-column` become `column-ensure` and `column-rename`.
- **M3.2-AC-14** `column-set-not-null` gives the four steps and `constraint-add-foreign-key` the two steps that the generator of M3 gave for the statements. `constraint-add-check` gives two steps: the constraint as not valid, then its validation.
- **M3.2-AC-15** `column-rename` gives a plain rename. `column-ensure` gives the code that `ensure column` gave, with the widening of M3.1-AC-25.
- **M3.2-AC-16** `name` is mandatory in the two actions for constraints: the second step has to name the constraint. The helper constraint of `column-set-not-null` gets a name from MIG-Ace, and a test shows that it cannot be taken for a constraint of the application: if a constraint with this name exists, the action fails before it changes anything.
- **M3.2-AC-17** The expected SQL of every action passes the three proofs of M3: the committed file, PostgreSQL's parser, and a run on PGlite on the bookshop schema.
- **M3.2-AC-18** For every action a test on PGlite shows that the action and the plain statement under `do` lead to the same model.
- **M3.2-AC-19** The bookshop snippets and the examples of the website use actions where they used the removed statements or relied on several steps. The examples of the website are changed in the same commit as the grammar, so that the test of the website stays green; the text around them is left to the review.

### The warning under `do`

- **M3.2-AC-20** A `do` with `set not null`, `add constraint … foreign key`, `add constraint … check` or `rename column` gets a warning that names the action. `loadProject` returns it; it is no error.
- **M3.2-AC-21** A quick fix replaces the `do` by the action with its parameters, in the form with `{ … }` where that form allows it. The result parses and generates the steps of the action.
- **M3.2-AC-22** There is no warning when the table is created in the same snippet, and none in a snippet with `requires-downtime`.

### Descriptions, hover and completion

- **M3.2-AC-23** The description of an action is written once, in `construct.md` of its folder, in a fixed structure: a summary of one line, the result, every parameter, the statements for PostgreSQL, the locks, what happens after a failure. A test fails when an action or a parameter has no description.
- **M3.2-AC-24** Hover on the key of an action shows its description. Hover on a parameter shows the description of the parameter.
- **M3.2-AC-25** Completion at the place of the operation of a part lists `do`, `insert`, `upsert`, `native` and every action, each with its summary. Typing `col` leaves the actions for columns.
- **M3.2-AC-26** Completion inside an action lists the parameters that are still missing, the mandatory ones first.
- **M3.2-AC-27** Choosing an action from the list inserts it with its mandatory parameters as places to fill in.

### The YAML schema

- **M3.2-AC-28** A JSON Schema for `*.migql.yaml` is generated from the same definitions that the parser uses for the keys. It is a committed file, and a test fails when it is not up to date.
- **M3.2-AC-29** The schema describes the keys of a snippet and of a part, every action with its parameters, which of them are mandatory, the allowed values of keys that take a fixed word, and it carries the descriptions of M3.2-AC-23. A statement under `do` is a text for the schema.
- **M3.2-AC-30** Every valid example of the catalogue, read with a reference YAML parser, is accepted by a standard validator with this schema. Every invalid example whose mistake is a wrong, missing or doubled key is rejected.
- **M3.2-AC-31** A README says how an editor finds the schema for `*.migql.yaml` without the MigQL extension.

## Open points

- Whether an action may have a different number of steps in a newer MIG-Ace for a part that is half done in the ledger. It is answered with the ledger in M4.1.
- The names of further parameters of foreign keys, such as the rule for a deleted row. They are added when an example needs them.
- A literal block `|` for a long `check`. If the grammar needs a rule for it, the rule of `do` is used.
