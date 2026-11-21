---
type: language
status: mixed
---

# YAML profile

The grammar supports only the YAML constructs that snippets need. **[decided]**

- **Supported:** block mappings with plain keys, block sequences, single-line plain values, literal `|` blocks, `#` comments, single-line flow maps.
- **Not supported:** anchors, aliases, tags, multiple documents, folded `>` scalars, multi-line plain scalars, quoted keys, tabs.

Rules that keep MigQL and YAML in agreement. **[decided]**

- A flow map holds only literals, names and `table.column`. Other values are written in the block form.
- Free text is never put in quotes. A text value that starts with a quote is an error with advice.
- A list is indented below its key. A list at the indentation of its key is an error that says so.
- A comment may follow a one-line value, also a one-line statement.

Three places need care in the grammar. **[decided]**

1. A literal block ends by indentation, while the statement inside may be indented freely.
2. How a value is lexed depends on its key: after `do:` it is the statement language, after `doc:` it is free text.
3. A one-line statement that a YAML parser would read differently (it contains ` #` or `: `, or starts with a character such as `@`, `*`, `{` or a quote) is rejected with the advice to use a `|` block.

A conformance test parses every example with the MIG-Ace grammar and with a reference YAML parser and requires the same structure. The same files are validated against `schema.json`. **[direction]**
