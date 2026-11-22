---
type: journal
date: 2026-11-22
milestones: [M0, M1.1, M4.2, M4.3]
---

# Windows and macOS

The workflow `.github/workflows/build.yml` now runs on Linux, Windows and macOS. All three are green for the commit `Detach the watchdog` (run 45026293062). Before this session nobody had looked at the runs.

## What the runs showed

- **Up to M3 Windows was green all along.** Every run from M1.1 to the specs of M3.2 had passed on Windows. That closes M0-AC-04, M0-AC-06 and M1.1-AC-01 to 03.
- **The first run with M4 failed on Windows.** Three failures, found one after the other. Linux never showed any of them.

| Problem on Windows | Cause | Fix |
|---|---|---|
| Three tests of the catalogue on a database timed out | The first start of PGlite took more than the 5 seconds a test has. The two failures after it were its consequence. | Tests have 30 seconds in `migql/` and `databases/postgresql/`. |
| No temporary server could start; every server test waited until its time limit | Not seen directly. Two things were changed at once: the server was started as `postgres`, and PostgreSQL refuses to run with the rights of an administrator, which a build server for Windows has; and then the call of `pg_ctl` waited for a pipe that the server inherits. | The watchdog starts and stops the server with `pg_ctl`, on every system, without a pipe. The log of the server goes to a file. |
| A server was left behind when the process that started it was killed | Windows ends the children of a killed Node process together with it. The watchdog was gone before it could stop the server. | The watchdog is started detached. It also checks every half second that the process that started it is alive. |

- **macOS was green at its first run.** It runs on Apple silicon; the binaries are the package `@embedded-postgres/darwin-arm64`. Nothing had to be changed.
- The Java tests, the coverage limits and the generate check pass on all three. Coverage is the same on all three, 99.48 % of the lines.

## The nightly job

The job with PostgreSQL 15.20 on Linux was started by hand (run 45026790262). It is green: 22 server tests pass. The three platforms were green a second time in the same run.

## Time on the build servers

From the test of M4.2-AC-21, PostgreSQL 18.7:

| | Linux | macOS | Windows |
|---|---|---|---|
| Start a server, with `initdb` | 0.7 s | 1.4 s | 2.3 s |
| Copy the prepared bookshop database | 30 ms | 1.6 s | 250 ms |
| First run of the bookshop script | 48 ms | 99 ms | 154 ms |
| Second run | 24 ms | 41 ms | 60 ms |
| The whole job | 2 min | 2 min | 5 min |

Copying a database is slow on macOS. A test that copies a database for every case will feel it there.

## Changes

- The workflow has `macos-latest` in its list. The test steps run although an earlier one failed, so one run shows every problem of a platform.
- `startTemporaryServer` gives up after 50 seconds with the log of the server, instead of waiting for the time limit of the test.
- The binaries package exports `pg_ctl`; a folder named by `MIGACE_POSTGRESQL_BINARIES` must hold it too, as before.

## Not shown

- The fix for the second problem is two changes that were pushed one after the other without a run that separates them. Which of the two causes was the real one is a conclusion, not an observation.
- macOS on Intel, and Linux on ARM, have no package of binaries installed and no job.
