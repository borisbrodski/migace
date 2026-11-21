---
type: architecture
status: mixed
---

# Configuration

Settings are of two kinds. **[direction]**

| Kind | Answers | Examples |
|---|---|---|
| Project setting | *What* is proven. The same for every developer and for CI. | dialects, PostgreSQL version, folders, `upgrade-from`, `compatible-with`, ledger prefix |
| Machine setting | *How* the tool works on this computer. It never changes a result. | where PostgreSQL binaries are, proxy, LLM endpoint and key, colours |

Sources, strongest first: **[direction]**

1. Command-line option.
2. Environment variable `MIGACE_…`.
3. `migace.local.yaml` next to the project file, not committed.
4. `migace.yaml` in the project root, committed.
5. The user file `~/.config/migace/config.yaml`. It follows `XDG_CONFIG_HOME`. On Windows it is `%APPDATA%\migace\config.yaml`.
6. Built-in defaults.

Rules: **[direction]**

- A project setting is read from `migace.yaml` only. Finding one in any other source is an error. Two developers and CI must prove the same thing.
- A machine setting may come from any source. `migace.yaml` may set team defaults for machine settings, for example the LLM endpoint and model.
- Secrets are rejected in `migace.yaml`. A key comes from an environment variable or from the user file.
- `mig config` prints every effective setting and where it came from.
- Downloaded PostgreSQL binaries and other caches are in `~/.cache/migace` (`XDG_CACHE_HOME`; `%LOCALAPPDATA%\migace\cache` on Windows).
- There is no settings file at run time. The production machine has no MIG-Ace tool. Run-time options (ignore patterns, `adopt`, maintenance mode) are arguments of the runner.
