---
type: language
status: mixed
---

# YAML profile

The grammar supports only the YAML constructs that snippets need. **[decided]**

- **Supported:** block mappings with plain keys, block sequences, single-line plain values, literal `|` blocks, `#` comments, single-line flow maps.
- **Not supported:** anchors, aliases, tags, multiple documents, folded `>` scalars, multi-line plain scalars, quoted keys, tabs.

Three places need care in the grammar. **[decided]**

1. A literal block ends by indentation, while the statement inside may be indented freely.
2. How a value is lexed depends on its key: after `do:` it is the statement language, after `doc:` it is free text.
3. A one-line statement that a YAML parser would read differently (it contains ` #` or `: `, or starts with a character such as `@`, `*`, `{` or a quote) is rejected with the advice to use a `|` block.

A conformance test parses every example with the MIG-Ace grammar and with a reference YAML parser and requires the same structure. The same files are validated against `schema.json`. **[direction]**
