---
type: spec
status: ready
milestone: M4.2
---

# M4.2 Real PostgreSQL

## Goal

The tests can start a real PostgreSQL server from binaries as a child process, without Docker. On it, the script of M4.1 is proven in the situations that PGlite cannot show: a second connection, a run that is killed, a lock that is held, a statement outside a transaction.

The temporary server built here is the one the proof loop uses later.

## Non-goals

- The proof loop itself.
- A command for users that downloads or manages binaries.
- Every PostgreSQL version and every operating system in every run. See the stages in the [test concept](../testing/test-concept.md).
- Runners in other languages: [M4.3](m4-3-client-contract-and-java-runner.md).

## Builds on

- [Temporary databases without containers](../decisions/temporary-databases-without-containers.md)
- [Test concept](../testing/test-concept.md): levels, stages, fault injection
- [Configuration](../architecture/configuration.md): machine settings and the cache folder
- [Execution and ledger](../architecture/execution-and-ledger.md)
- M4.1

## Order of work

1. The temporary server.
2. The bookshop run on it, compared with PGlite.
3. Two runners.
4. Killed runs.
5. Locks.
6. Statements outside a transaction.
7. Roles.

## Acceptance criteria

### The temporary server

- **M4.2-AC-01** A function in `databases/postgresql/` starts a PostgreSQL server as a child process: a data folder of its own below a temporary folder, a free port, connections from the same computer only. It returns what is needed to connect. Stopping it ends the process and removes the folder.
- **M4.2-AC-02** The binaries are found in this order: a folder named by a machine setting or its environment variable; otherwise a package of binaries for the platform. A proposal for the package is `@embedded-postgres/<platform>`, which gives the paths of `initdb`, `pg_ctl` and `postgres`. The choice, its licence and its size are written into the journal. The name of the setting is provisional.
- **M4.2-AC-03** No server is left behind. When the process that started it ends without stopping it, the server ends within some seconds. A test kills a helper process and waits for the server to go.
- **M4.2-AC-04** When the server cannot start, the message says why: binaries not found, port taken, started as the user `root`, which PostgreSQL refuses.
- **M4.2-AC-05** A new database is created as a copy of a prepared one. Every test gets a bookshop of release 1.0.0 of its own in this way.
- **M4.2-AC-06** `npm test` needs no server and stays as fast as it is. The tests of this spec run with `npm run test:server`. The workflow runs both, on Linux and on Windows.
- **M4.2-AC-07** The reference runner of M4.1 runs unchanged on a connection to the server. Server notices reach the caller.

### The same result as on PGlite

- **M4.2-AC-08** The reader of M2 gives the same model and the same fingerprint for the bookshop on the server and on PGlite.
- **M4.2-AC-09** The bookshop script gives the same model and the same ledger content on the server and on PGlite. Times and process numbers are left out of the comparison.

### Two runners

- **M4.2-AC-10** Two runs that start at the same time on the same database do not disturb each other. The second waits for the lock and then finds nothing to do. No part has two successful ledger rows.

### Killed runs

- **M4.2-AC-11** For every statement of the bookshop script: a run whose connection is closed after this statement, followed by a normal run, ends with the same model as a run that was never interrupted, and with a ledger in which every part is done once.
- **M4.2-AC-12** The same holds when the server ends the session in the middle of a statement that takes long. A second connection ends the first one for this test.

### Locks

- **M4.2-AC-13** The script sets a time limit for waiting on a lock. The limit and the number of further attempts are parameters of a run with defaults. Their names are written into [Execution and ledger](../architecture/execution-and-ledger.md).
- **M4.2-AC-14** A step that waits for a lock held by another session gives up after the limit, waits, and tries again. When the lock is released in between, the step succeeds, and the ledger shows the attempts.
- **M4.2-AC-15** When every attempt fails, the run ends with a failure that names the snippet, the part and the table that was locked. The next run repeats the step.

### Statements outside a transaction

- **M4.2-AC-16** `create index concurrently` runs outside a transaction on the server. A test shows that the same statement inside a transaction is refused by PostgreSQL, so the script really sends it on its own.
- **M4.2-AC-17** A `create index concurrently` whose session is ended in the middle leaves an invalid index. The next run removes it and builds the index. This also covers M4.1-AC-37 if PGlite could not show it.

### Roles

- **M4.2-AC-18** The script runs with a role that owns the schema and is not a superuser.
- **M4.2-AC-19** A second role with read access to the meta table only can read the stored fingerprint. The test shows the smallest set of rights that an application needs for its check at start, and the note [Execution and ledger](../architecture/execution-and-ledger.md) names them.

### Versions and time

- **M4.2-AC-20** The tests of this spec pass on the oldest and on the newest PostgreSQL version that the binaries offer and that is still supported by the PostgreSQL project. The workflow runs one of them on every push; the other one may run at night.
- **M4.2-AC-21** The time to start a server, to copy the prepared database and to run the bookshop script is measured and written into the journal.

## Open points

- Supported are the PostgreSQL versions that the PostgreSQL project still supports. The lowest one may be raised when a feature needs it.
- macOS has no run in the workflow yet. It is added when a contributor needs it or before the first release.
