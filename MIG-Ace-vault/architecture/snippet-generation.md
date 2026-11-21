---
type: architecture
status: mixed
---

# Snippet generation

MIG-Ace generates snippets for most simple schema changes. This is a main feature, not a convenience. **[decided]**

- `mig make` runs the same comparison as the proof loop and writes snippets for the differences. **[decided]**
- The snippet name is optional. With an LLM configured, the LLM chooses names and decides the number of snippets. **[decided]**
- Without an LLM, one snippet is written per table. The option `--single-snippet` writes one snippet, and the tool mentions this option whenever it writes several. **[decided]**
- For decisions it cannot make, such as the value of a new mandatory column for existing rows, the tool asks interactively. **[decided]**
- The tool never checks whether a table has rows. Production data is not visible at build time, so every table is assumed to have rows. **[decided]**
- In `--batch` mode, or when no console is attached, it does not ask. It writes a `todo` into the snippet and reports it clearly. **[decided]**
- While a `todo` is present, building the migration script fails. **[decided]**
- A possible rename (one column removed, a similar one added) is asked about, not guessed. **[direction]**
