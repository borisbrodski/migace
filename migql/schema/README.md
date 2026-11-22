# schema

`migql.schema.json` is a JSON Schema for snippet files (`*.migql.yaml`). It is generated from the definitions that the MigQL parser uses for the keys; `npm run test:generate` rewrites it, and a test fails when it is not up to date.

With the schema, a YAML editor completes the keys of a snippet and the parameters of the actions, shows their descriptions and reports a wrong, a missing or an unknown key. The statement under `do` is plain text for it. The MigQL language server is not needed for this; with it, the editor also checks the statements.

## How an editor finds the schema

Any of these works for editors that use the YAML language server (VS Code with the YAML extension, Neovim, and others).

**In the file.** Put this line at the top of a snippet. The path is relative to the snippet:

```yaml
# yaml-language-server: $schema=../.migace/migql.schema.json
migration: 20260309-1400-review-table
```

**For all snippets of a project**, in the settings of VS Code (`.vscode/settings.json`):

```json
{
  "yaml.schemas": {
    "./.migace/migql.schema.json": "*.migql.yaml"
  }
}
```

**IntelliJ IDEA:** Settings, Languages & Frameworks, Schemas and DTDs, JSON Schema Mappings: add the schema file with the file pattern `*.migql.yaml`.

The paths above assume that the schema was copied to `.migace/` in the project. Where the tool puts it is decided with the commands.
