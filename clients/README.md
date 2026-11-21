# clients

A client runs the migration script from one ecosystem and integrates MIG-Ace into its build. A client contains no migration logic.

| Folder | Content |
|---|---|
| `contract/` | the adapter contract and its test suite, independent of any programming language |
| `java/` | runner library and command line |
| `gradle/` | Gradle plugin |

To add a client, add a folder and pass the suite in `contract/`.
