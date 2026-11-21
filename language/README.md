# language

The language of snippets, as one Langium project: grammar, checks, language server, the catalogue of constructs and the generators per database.

See `MIG-Ace-vault/language/overview.md`.

| Folder | Content |
|---|---|
| `grammar/` | grammar files: YAML profile, statements, expressions |
| `src/` | parser services, checks, language server |
| `constructs/` | one folder per construct: meaning, valid and invalid examples, expected SQL |
| `generators/<database>/` | statements to the SQL of one database |
