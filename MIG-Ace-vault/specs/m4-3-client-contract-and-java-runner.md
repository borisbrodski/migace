---
type: spec
status: ready
milestone: M4.3
---

# M4.3 Client contract and Java runner

## Goal

The adapter contract exists as test cases in data files, so that a runner in any language can be checked against it. The reference runner passes them, and so does the first real client: a small Java library that runs the migration script from the application's JAR or from the command line.

## Non-goals

- The Gradle plugin and a Maven plugin.
- Runners in other languages.
- The options `--phase` and `--adopt`. They come with their features.
- Any logic in the runner. A runner that needs to know what a snippet is has gone wrong.

## Builds on

- [Execution and ledger](../architecture/execution-and-ledger.md): the adapter contract and the marker lines fixed in M4.1
- [Repository layout](../architecture/repository-layout.md): `clients/contract/`, `clients/java/`
- [Test concept](../testing/test-concept.md)
- M4.1, and M4.2 for the test on a real server

## Order of work

1. The format of a contract case, and the first cases.
2. The reference runner against the cases.
3. The Java library against the cases.
4. The command line.
5. One run on a real server.

## Acceptance criteria

### The contract as data

- **M4.3-AC-01** `clients/contract/` holds the cases as data files. A case has: the text of a script; the parameters of the run; the answer of a scripted database for every statement (success, the row of a guard query, an error with code and message, notices); and what is expected: the statements that are sent, in order, the outcome, the reported error, the notices that are passed on.
- **M4.3-AC-02** A README in the folder describes the format and the contract in full, so that a runner can be written from it without reading other code. A schema for the case files exists, and a test checks every case against it.
- **M4.3-AC-03** The script names the version of the contract in its first lines. A case shows that a runner refuses a script with a higher version than it knows, before it sends anything.
- **M4.3-AC-04** The cases cover at least:
  - statements that are sent in order, and the parameters that are sent before them;
  - a guard that is true, and one that is false;
  - an error: nothing is sent after it, and it is reported with its code and message;
  - a guard query that returns no row, an empty value or more than one row: an error;
  - notices before, between and after statements;
  - a statement with semicolons inside, with a block in dollar quotes, with empty lines, with characters outside ASCII, and one that is very long;
  - a script file with Windows line endings;
  - a line that is no statement and no known marker: an error that names the line.
- **M4.3-AC-05** The reference runner of M4.1 passes every case.

### The Java library

- **M4.3-AC-06** `clients/java/` builds with the Gradle wrapper that is committed with it. The library has no dependency besides the JDK. The Java level it is compiled for is written into the build file and into the note; question 42 asks which level it must be.
- **M4.3-AC-07** The library passes every contract case. The test reads the same data files and uses a scripted connection, no database. Tests are written with JUnit 5.
- **M4.3-AC-08** One call reads the script from a resource of the JAR and runs it, on a `DataSource` or on a `Connection`. The name of the call is provisional: `MigAce.execFromJar(SomeClass.class, "/migace/migration-script-pg.sql", dataSource)`.
- **M4.3-AC-09** The library uses one connection and switches autocommit on. A connection it got from the caller is given back with its earlier setting and is not closed. A connection it took from a `DataSource` is closed.
- **M4.3-AC-10** Notices of the database reach a listener that the caller can set. Without one they go to the logging of the JDK.
- **M4.3-AC-11** A failure is one exception. Its message is the one of the script, with snippet and part; it carries the code of the database, and the original exception as its cause.

### The command line

- **M4.3-AC-12** The same JAR runs as a program: it takes the address of the database, the user and the script file, and ends with the code 0 after success and another code after a failure. The names of the options are provisional and are written into the README.
- **M4.3-AC-13** The password comes from an environment variable or is asked for. It is never an argument.
- **M4.3-AC-14** No secret appears in any output. A test with a password inside the address of the database shows that neither messages nor errors print it.
- **M4.3-AC-15** The JDBC driver is not part of the JAR. The README shows the call with the driver on the class path.

### On a real server

- **M4.3-AC-16** A test of the server stage starts the temporary server of M4.2, runs the bookshop script with the Java program, and compares model and ledger with the run of the reference runner. They are the same.
- **M4.3-AC-17** When no JDK is installed, the Java tests are left out with a message that says so, and `npm test` still passes. The workflow installs a JDK and runs them on Linux and on Windows.

## Open points

- Question 42: the lowest Java level of the runner.
- Whether the program should also print the notices as lines of JSON for build servers.
