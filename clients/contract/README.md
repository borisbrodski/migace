# clients/contract

The contract between a migration script and the program that sends it to the database. A program that follows it is a **runner**. A runner can be written from this file alone.

All logic of a migration is in the script: what runs, what is skipped, what is written into the ledger. A runner has none of it. It knows nothing about snippets, parts or the ledger.

## What a runner does

1. It opens **one connection** and switches **autocommit on**. Every statement is a transaction of its own.
2. It reads the script. If it cannot read it, it **refuses** it and sends nothing.
3. It sends the **parameters** of the run, in the order in which it got them. Each one is one statement:

   ```sql
   select set_config('migace.<name>', '<value>', false)
   ```

   A single quote in the value is doubled. The name is made of letters, digits and underscores.
4. It sends the **statements** of the script, one at a time and in order.
5. Before a statement with a **guard** it sends the guard query. The query returns one row with one value. `true`: the statement is sent. `false`: the statement is not sent, and the runner goes on with the next one. No row, more than one row, or a value that is neither: an error, as if a statement had failed.
6. At the **first error** it stops. Nothing is sent after it. It reports the error with the message and the code of the database. If the statement has a label, the label and `: ` stand in front of the message.
7. It passes the **notices** of the database to its caller, in the order in which they arrive.

## The script

A script is a text file. Its line endings are LF or CRLF; a runner reads both. Lines that start with `-- @migace ` are marker lines.

| Line | Meaning |
|---|---|
| `-- @migace script format=1` | The first line of every script. The number is the version of this contract. A runner refuses a number it does not know. |
| `-- @migace statement` | The lines up to the next marker line are one statement. |
| `-- @migace guard` | The lines up to the next marker line are a guard query. It belongs to the statement that follows. A guard is always followed by a statement. |
| `outside-transaction` | An attribute of a statement: the database refuses it inside a transaction. A runner with autocommit sends it like any other. |
| `label="<text>"` | An attribute of a statement: what it belongs to. The text has no double quote. |

- A statement is everything between its marker line and the next one: semicolons, blocks in dollar quotes, empty lines and comment lines are part of it. Empty lines before the first and after the last line of the statement are not sent. Line breaks inside a statement are sent as LF.
- The first line must be the line with the format. After it, a line that is no marker line and stands before the first marker is an error, unless it is empty. An unknown marker is an error. Both name the line, and nothing is sent.
- The script contains nothing that only one client understands.

## The cases

`cases/` holds one JSON file per case. `case.schema.json` is the schema of a case; a test checks every case against it. Every runner runs every case against a scripted database, without a real one.

| Key | Meaning |
|---|---|
| `description` | What the case shows. |
| `script` | The text of the script file, with its line endings. |
| `parameters` | The parameters of the run, in the order in which they are sent. |
| `answers` | What the scripted database answers. The first entry answers the first statement that is sent, parameters included. A statement without an entry succeeds. |
| `answers[].rows` | The rows of the result. Each row is a list of values. Only a guard query has rows. |
| `answers[].notices` | Notices that the database sends while the statement runs. |
| `answers[].error` | The statement fails with this `code` and `message`, after its notices. |
| `expected.outcome` | `success`, `failure` (a statement or a guard failed) or `refused` (the runner did not accept the script). |
| `expected.sent` | The statements that reach the database, in order. |
| `expected.notices` | The notices that reach the caller, in order. Missing means none. |
| `expected.error.message` | The exact message of the reported error. |
| `expected.error.code` | The code of the database that the reported error carries. |
| `expected.error.mentions` | Texts that the message must contain, where its wording is left to the runner: for example the number of a line. |

## Runners

| Runner | Where | Its test of the cases |
|---|---|---|
| Reference runner, TypeScript | `databases/postgresql/src/runner.ts` | `databases/postgresql/test/contract.test.ts` |
| Java library and command line | `clients/java/` | `clients/java/src/test/java/…/ContractTest.java` |

To add a runner, add a folder under `clients/` and a test that plays every file of `cases/`.
