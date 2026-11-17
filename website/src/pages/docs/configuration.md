---
layout: ../../layouts/Doc.astro
title: Configuration
description: The project file migace.yaml, the user file in ~/.config/migace, environment variables, and which setting wins.
lead: MIG-Ace reads a project file that your team shares, and an optional user file with the settings of your own computer.
---

## Two kinds of settings

| Kind | It decides | Where it lives |
|---|---|---|
| Project setting | **What** is proven. It must be the same for every developer and for CI. | `migace.yaml` in the project, committed to git |
| Machine setting | **How** MIG-Ace works on one computer. It never changes a result. | The user file, an environment variable or the command line |

The split keeps builds reproducible. Nothing on your laptop can make your proof differ from the one in CI.

## The project file

```yaml
# migace.yaml
dialects:
  - postgresql

postgresql:
  version: 17

schema: schema/
migrations: migrations/
releases: releases/

upgrade-from: 1.1.0
compatible-with: 1.2.0

reference-tables:
  - order_status
```

| Setting | Meaning | Default |
|---|---|---|
| `dialects` | The databases the project supports. See [Native SQL](/docs/native-sql/). | `postgresql` |
| `postgresql.version` | The major PostgreSQL version of the temporary database. Use the version you run in production. | required |
| `schema` | The folder with the [desired schema](/docs/desired-schema/). | `schema/` |
| `migrations` | The folder with the snippets. | `migrations/` |
| `releases` | The folder with the [release files](/docs/releases-and-branches/). | `releases/` |
| `baselines` | A folder with database dumps you add yourself, for the [proof loop](/docs/proof-loop/). | none |
| `upgrade-from` | The oldest release a database may still be on. Every release from here on is tested as a starting point. | the first release |
| `compatible-with` | The oldest application version that may run during an upgrade. See [Zero-downtime changes](/docs/zero-downtime/). | the current release |
| `reference-tables` | Tables whose rows are compared too. See [New and existing databases](/docs/first-run/). | none |
| `ledger.prefix` | The name prefix of the ledger tables. | `mig_` |

## The user file

```yaml
# ~/.config/migace/config.yaml
postgresql:
  binaries: /opt/postgresql/17    # use this PostgreSQL, download nothing

llm:
  api-key: your-key

proxy: http://proxy.example.internal:8080
```

| System | Location |
|---|---|
| Linux and macOS | `~/.config/migace/config.yaml`, or `$XDG_CONFIG_HOME/migace/config.yaml` if that variable is set |
| Windows | `%APPDATA%\migace\config.yaml` |

The file is optional. Without it, MIG-Ace uses the defaults.

| Setting | Meaning | Default |
|---|---|---|
| `postgresql.binaries` | The folder of a PostgreSQL that is already installed. | MIG-Ace downloads the right version once |
| `postgresql.download-from` | A mirror inside your company for that download. | the public download |
| `postgresql.server` | The address of a PostgreSQL server to use when the machine may not start programs. | none |
| `llm.endpoint`, `llm.model` | The LLM that names and groups [generated snippets](/docs/generated-snippets/). | no LLM |
| `llm.api-key` | The key for that endpoint. | none |
| `proxy` | The proxy for downloads and for the LLM. | none |
| `batch` | `true` means: never ask a question. | `false` |
| `color` | `auto`, `always` or `never`. | `auto` |

## Team defaults for machine settings

Most teams use the same LLM. The project file may therefore set a default for a machine setting:

```yaml
# migace.yaml
llm:
  endpoint: https://llm.example.internal/v1
  model: your-model
```

Each developer then only adds a key, in the user file or in an environment variable.

## Settings for one project on one computer

Put them into `migace.local.yaml`, next to `migace.yaml`, and add that file to `.gitignore`. It accepts the same settings as the user file.

```yaml
# migace.local.yaml
postgresql:
  binaries: D:\tools\postgresql-16
```

## Environment variables

Every machine setting has an environment variable. Take the name of the setting in upper case, replace dots and dashes with underscores, and put `MIGACE_` in front.

| Setting | Variable |
|---|---|
| `llm.api-key` | `MIGACE_LLM_API_KEY` |
| `postgresql.binaries` | `MIGACE_POSTGRESQL_BINARIES` |
| `batch` | `MIGACE_BATCH` |

This is the usual way to configure CI.

## Which one wins

When a machine setting is given in several places, the first of these wins:

1. An option on the command line, such as `--batch`
2. An environment variable
3. `migace.local.yaml`
4. `migace.yaml`
5. The user file
6. The built-in default

`mig config` shows what MIG-Ace will use, and where each value comes from:

```text
$ mig config
postgresql.version     17                                  migace.yaml
upgrade-from           1.1.0                               migace.yaml
compatible-with        1.2.0                               migace.yaml
postgresql.binaries    /opt/postgresql/17                  ~/.config/migace/config.yaml
llm.endpoint           https://llm.example.internal/v1     migace.yaml
llm.api-key            (set)                               MIGACE_LLM_API_KEY
batch                  false                               default
```

## What may go where

Two rules protect you from surprises:

- **A project setting is accepted in `migace.yaml` only.**

  ```text
  ~/.config/migace/config.yaml: "upgrade-from" is a project setting.
  Set it in migace.yaml.
  ```

- **A key or password is not accepted in `migace.yaml`.** That file is in git.

  ```text
  migace.yaml: "llm.api-key" must not be stored in the project file.
  Use the user file or the variable MIGACE_LLM_API_KEY.
  ```

## The cache folder

MIG-Ace keeps downloads and prepared baselines in a cache folder. You can delete it at any time. It is filled again when needed.

| System | Location |
|---|---|
| Linux and macOS | `~/.cache/migace`, or `$XDG_CACHE_HOME/migace` |
| Windows | `%LOCALAPPDATA%\migace\cache` |

## In production

There is no settings file in production. The `mig` tool is not installed there, only the small runner. What the runner needs, you pass directly: as options on the command line or as calls in Java. See [Running migrations](/docs/running-migrations/) and [Commands](/docs/commands/).
