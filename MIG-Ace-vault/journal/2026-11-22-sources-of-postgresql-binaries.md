---
type: journal
date: 2026-11-22
milestones: [M4.2, M4.4]
---

# Where the PostgreSQL binaries of the tests come from

Research by the review for question 53. The rule of the project owner: only official sources, or sources close to them.

## What is used today

`@embedded-postgres/linux-x64`, `darwin-arm64` and `windows-x64` in version `18.7.0-beta.19`, and the Linux package again in version 15, as optional dependencies of `databases/postgresql/`.

## The chain behind the package

| Step | Who | What is known |
|---|---|---|
| 1 | PostgreSQL project | The source code. |
| 2 | `zonkyio/embedded-postgres-binaries` | Builds "lightweight bundles of PostgreSQL binaries with reduced size", described as "intended for testing purposes", and publishes them to Maven Central. Asked about the security of the binaries, the maintainer answered that the artifacts on Maven Central are signed, that the build scripts can be read, and that one can build the binaries oneself. Where and how the published binaries are built is not said. |
| 3 | `leinelissen/embedded-postgres` | Takes the binaries of step 2 and publishes them to the npm registry, one package per platform. |
| 4 | The npm registry | The lock file of MIG-Ace fixes the content of the package by its hash. |

Looked at directly, in the registry and in the installed package:

- The package has one maintainer and is published from a personal account.
- The registry holds no statement of origin for the version (no `attestations` entry). It cannot be shown from which commit and by which build the package was made.
- The version in use was published on 2026-11-19, three days before it was taken.
- Every version is labelled `beta`.
- The package runs a script at installation (`postinstall`). Today it only creates links between files of the package.
- The range in `package.json` is `^18.7.0-beta.19`. A newer beta would be taken as soon as the lock file is written again.

Nothing was found that is wrong with the binaries. The point is that nobody can check it: two steps of repackaging, each by a small group or one person, stand between the PostgreSQL project and what the tests run. This does not meet the rule.

## Sources that meet the rule

The download page of the PostgreSQL project names, for each system, where binaries come from.

| System | Source | Notes |
|---|---|---|
| Linux, Debian and Ubuntu | The APT repository of the PostgreSQL project | Every supported version. Signed packages. Needs the right to install packages. |
| Linux, Red Hat family | The Yum repository of the PostgreSQL project | As above. |
| Windows | The installer by EDB, and a zip archive of the same binaries | The page says the archive is "intended for users who wish to include Postgres as part of another application installer". It needs no installation. |
| macOS | The installer by EDB, Postgres.app, Homebrew | All three are named on the page. EDB also offers an archive of the binaries. |
| Any | The source code | A build takes minutes and a compiler. |

## Proposal

1. **MIG-Ace never brings its own PostgreSQL.** The temporary server uses a PostgreSQL that is installed on the computer. It is found by the machine setting, then by `pg_config`, then in the usual places of each system. The message for a computer without PostgreSQL names the official source for that system.
2. **The workflow installs from the sources above**, or uses the PostgreSQL that the image of the runner already has when its version fits. Which images have which version was not checked in this research.
3. **The npm packages are removed** from `package.json` and from the lock file.
4. **An archive that is downloaded**, such as the one for Windows, is checked against a hash that is committed in the repository.

A side effect that helps: a project then proves its migrations on the same build of PostgreSQL that its developers and its servers use.

## Sources

- Download page of the PostgreSQL project: https://www.postgresql.org/download/
- Windows: https://www.postgresql.org/download/windows/
- macOS: https://www.postgresql.org/download/macosx/
- Archives of binaries by EDB: https://www.enterprisedb.com/download-postgresql-binaries
- The npm package: https://www.npmjs.com/package/embedded-postgres
- The binaries behind it: https://github.com/zonkyio/embedded-postgres-binaries and its issue 81 on security
