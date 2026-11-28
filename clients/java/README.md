# clients/java

The Java runner of MIG-Ace: a small library that sends a migration script to the database, and the same JAR as a program.

It follows the [client contract](../contract/README.md). All logic of a migration is in the script; the runner has none.

- Java 11 or newer.
- No dependency besides the JDK. The JDBC driver comes from the application.
- The names of the calls and of the options are provisional.

## In an application

Put the migration script into the JAR of the application as a resource. Run it at the start, before anything else uses the database:

```java
MigAce.execFromJar(BookshopApp.class, "/migace/migration-script-pg.sql", dataSource);
```

With parameters and with a listener for the notices:

```java
MigAce.fromJar(BookshopApp.class, "/migace/migration-script-pg.sql")
    .parameter("schema", "shop")
    .onNotice(line -> log.info(line))
    .exec(dataSource);
```

- `exec(DataSource)` takes one connection and closes it. A pool gets the connection back as it was before the run: the script ends with statements that set the search path and the limits back, release its lock and drop its functions, also after a failure.
- `exec(Connection)` uses the given connection. It switches autocommit on, gives the earlier setting back and does not close the connection.
- Without a listener the notices go to the logging of the JDK (`java.util.logging`, logger `org.openbrod.migace.MigAce`, level INFO).
- A failure is a `MigrationFailedException`. Its message names the snippet and the part. `getSqlState()` is the code of the database. The cause is the exception of the driver.

## As a program

```sh
export MIGACE_PASSWORD=…
java -cp migace-runner.jar:postgresql-42.7.5.jar org.openbrod.migace.Main \
    --url jdbc:postgresql://localhost:5432/bookshop --user bookshop_owner --schema shop \
    migration-script-pg.sql
```

On Windows the separator of the class path is `;`. The JDBC driver is not part of the JAR.

| Option | Meaning |
|---|---|
| `--url <jdbc url>` | The address of the database. |
| `--user <user>` | The user that runs the migration: the owner of the schema. |
| `--schema <schema>` | The schema of the migration. Default: the schema of the session. |
| `--param <name>=<value>` | Another parameter of the run, for example `lock_timeout=10s`. May be given several times. A name that the script does not know stops the run before it changes anything. |

- **Password.** It is read from the environment variable `MIGACE_PASSWORD`. Without the variable the program asks for it. There is no option for it.
- **Output.** The notices go to the standard output, one per line. An error goes to the standard error. A password is never printed, also not one that stands inside the address.
- **Exit code.** 0 after success, 1 after a failure of the migration, 2 if the call is wrong.

### A heavy migration by hand

The defaults suit a migration at the start of the application: one wait for a lock takes at most 5 seconds, a step is tried 90 times with a pause of 5 seconds, which gives fifteen minutes, and a statement has no time limit. A migration that rebuilds a large table is better run by hand, at a quiet time, with limits of its own:

```sh
export MIGACE_PASSWORD=…
java -cp migace-runner.jar:postgresql-42.7.5.jar org.openbrod.migace.Main \
    --url jdbc:postgresql://localhost:5432/bookshop --user bookshop_owner --schema shop \
    --param other_schemas=extensions \
    --param lock_timeout=2s --param lock_attempts=0 --param lock_wait=30s \
    --param statement_timeout=2h \
    migration-script-pg.sql
```

| Parameter | Meaning | Default |
|---|---|---|
| `schema` | The schema of the migration. | the schema of the session |
| `other_schemas` | Further schemas that the run sees, separated by commas, for example the schema of an extension. | none |
| `lock_timeout` | How long one wait for a lock may take. | `5s` |
| `lock_attempts` | How often a step is tried when it got no lock. | `90` |
| `lock_wait` | The pause between two attempts. | `5s` |
| `statement_timeout` | How long one statement of the script may take, its waits for locks included. | `0` |

`0` means no limit. In the example, a step waits at most 2 seconds for a lock, so the application is held up for 2 seconds at most, and tries again every 30 seconds until it gets the lock; a single statement may take two hours. A statement outside a transaction, such as `create index concurrently`, has the same limits and is not tried again in the same run.

## Build and test

```sh
./gradlew build          # compiles, runs the tests, writes build/libs/migace-runner.jar
./gradlew copyDriver     # puts the PostgreSQL driver into build/driver, for the test on a real server
```

- The tests are JUnit 5. `ContractTest` plays every case of `../contract/cases` against a scripted connection. No test needs a database.
- `./gradlew check` also checks the coverage with JaCoCo: at least 94 % of the lines and 93 % of the branches. These are the levels of today; raise them when the coverage rises.
- `./gradlew pitest` runs mutation testing with PIT. It is no part of `check`. Of 105 changes, 101 are noticed by a test. The four that are not:

  | Where | Change | Why no test notices it |
  |---|---|---|
  | `Main.main` | `System.exit` removed | The three lines of `main` only run in a real process. The test on a real server checks the exit codes. |
  | `Main.main` | the check for a console replaced | As above. |
  | `Main.main` | the password prompt returns an empty text | As above. |
  | `MigAce.send` | `values.size() < 2` becomes `<= 2` | The behaviour is the same: two or three values both mean "more than one row". |

- From the repository root, `npm test` runs these tests too. Without a JDK they are left out with a message.
- The run on a real PostgreSQL is `migql/test/server/java-runner.test.ts`, part of `npm run test:server`.
