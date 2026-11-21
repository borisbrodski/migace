# migql

The language of snippets, as one Langium project: grammar, checks, language server, the catalogue of constructs and the generators per database.

See `MIG-Ace-vault/migql/overview.md`.

| Folder | Content |
|---|---|
| `grammar/` | the Langium grammar: envelope, statements, expressions |
| `src/lexer/` | the lexer of the YAML envelope; it decides by the key how a value is read |
| `src/` | parser services, linking, checks, hover, completion, quick fixes |
| `test/` | tests by kind: `lexer`, `parser`, `linking`, `validation`, `generator`, `lsp`, `constructs`, `examples`, `performance` |
| `constructs/` | one folder per construct: meaning, valid and invalid examples, expected SQL |
| `generators/<database>/` | statements to the SQL of one database |
