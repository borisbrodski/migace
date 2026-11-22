---
type: engineering
status: direction
---

# Stable state and release

Two lists. The first is run before a state of `candidate` is called stable: at the end of a milestone, and before a review is asked for. The second is run before `main` is moved, which publishes the website and later the packages.

Both lists are a first version. **[direction]** A step that turns out to be missing is added here, not remembered.

## Why two lists

`npm test` is what a developer runs many times a day. It is fast, needs no network, no database server and no Java. **[decided]** Everything that is slower or needs more is a command of its own, and these lists say when it is run.

## Stable state

Run on a clean working copy of `candidate` that is up to date.

### 1. Build and fast tests

| Step | Command | Passes when |
|---|---|---|
| Install from the lock file | `npm ci` | no error, the lock file is unchanged |
| Build | `npm run build` | no error |
| Lint | `npm run lint` | no finding |
| Fast tests | `npm test` | all pass |
| Generated files | `npm run test:generate` | `git status` shows no change |

### 2. Slow tests

| Step | Command | Passes when |
|---|---|---|
| Coverage | `npm run test:coverage` | no limit is missed |
| Real PostgreSQL, newest version | `npm run test:server` | all pass |
| Real PostgreSQL, oldest supported version | the same with the setting for the other installation | all pass |
| Java | `npm run test:java` | tests and coverage limits pass |

### 3. Do the tests notice mistakes?

| Step | Command | Passes when |
|---|---|---|
| Mutation testing, TypeScript | `npm run test:mutation`, for the packages that changed | every new survivor is removed by a test, or listed with its reason |
| Mutation testing, Java | `./gradlew pitest` in `clients/java/` | as above |
| Breaking the script | by hand, when the SQL of the script changed: every rule in the list of the [session note](../journal/2026-11-22-proof-of-the-tests-and-coverage.md) is broken once | a test of behaviour fails for each. A failure of a stored expected file does not count |

A test that was added after the code it tests is proven once: the code is broken, and the test is seen to fail.

### 4. Other systems

| Step | How | Passes when |
|---|---|---|
| Linux, Windows, macOS | push, then `gh run list` | the run for the last commit is green on all three |

### 5. The website

| Step | Command | Passes when |
|---|---|---|
| Build | `npm ci` and `npm run build` in `website/` | no error |
| Examples | part of `npm test` | every example of the website is accepted by the parser |

### 6. What is updated

- `specs/README.md` and `roadmap.md`: the state of every milestone.
- A note in `journal/`: what was found, what was measured, what deviates from a spec and why.
- `questions/open-questions.md`: every question that was not answered.
- The numbers on the website page `docs/quality.md` and in the README, when one of them changed.
- The status line of `CLAUDE.md`.
- No word of the local file `.private-words` is in any commit. The hook in `tools/git-hooks/` checks it; it must be installed.

### 7. Checked by the review

- Every acceptance criterion is named by a test, or the journal says how else it was checked.
- For a spec that changed an earlier rule: a test that uses the old rule and the new rule together.

## Release

Everything of "Stable state", and:

### 1. Tests

| Step | How |
|---|---|
| Oldest PostgreSQL on Linux | start the job by hand in the workflow; it must be green |
| Mutation testing, all packages, a full run | not the short run that reuses earlier results. The scores go to `docs/quality.md` |

### 2. What MIG-Ace depends on

| Step | How |
|---|---|
| Known weaknesses | `npm audit`, and the same for the Java build. Every finding is corrected or written down with its reason |
| Signatures of the registry | `npm audit signatures` |
| New dependencies since the last release | each is looked at: who publishes it, whether it runs a script at installation, its licence. Binaries come only from official sources, see [the decision](../decisions/answers-after-m4-3.md) |
| Licences | every dependency that is shipped fits the Apache License 2.0; `NOTICE` is up to date |

### 3. Promises that a release must keep

| Promise | Check |
|---|---|
| A snippet keeps its meaning | the expected SQL of the catalogue changed only where a decision says so |
| A checksum never changes | the committed list of checksums has new lines only |
| An older ledger still works | the format number of the ledger changed only together with the code that upgrades it |
| An older runner still works, or refuses clearly | the version of the client contract changed only with a new case that shows the refusal |

### 4. The website

- Its text describes what the tool does. Names that are still provisional are marked or removed.
- The banner about early development is right for this release.

### 5. Publishing

1. The project owner says that the release is published.
2. `main` is moved forward to `candidate` without a merge commit, and pushed.
3. The workflow of the website ends without error. The site is opened and looked at.
4. The job that runs at night is listed in the workflow page; it starts only from the file on `main`.
5. A note in `journal/` says what was released.

Version numbers, tags, a list of changes and the publishing of packages are added to this list when the first package is published.
