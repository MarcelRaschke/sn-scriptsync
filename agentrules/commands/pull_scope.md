### `pull_scope`

Pull every scriptable artifact of one application scope into canonical local workspace files (`<instance>/<scope>/<table>/<name>.<field>.<ext>`, or `<table>/<name>/<field>.<ext>` for folder-record tables) with `_map.json` registration, so an agent can work from local files instead of fetching artifacts one by one. This is the Agent API counterpart of the VS Code **Load Scope** button.

The command first lists which artifact tables the application actually uses, then walks each table that sn-scriptsync knows how to write to disk, paging past the Table API limits. Tables without code fields (properties, roles, ACL rows without scripts, ...) are reported under `skippedTables` and not written.

**Request:**
```json
{
  "id": "pull_scope_1",
  "command": "pull_scope",
  "params": { "scope": "x_acme_app" }
}
```

**Parameters:**
- `scope` (required, string): Application scope name (`x_acme_app`) or the `sys_scope` sys_id. `global` is refused: pull global artifacts with `pull_records` and a query instead.
- `tables` (optional, string[]): Restrict the pull to these tables. Tables that hold no records in the scope are reported in `warnings`.
- `limit` (optional, integer): Maximum records per table, `1` to `10000` (default `2000`). A table that hits the limit is marked `truncated`.
- `includeRecords` (optional, boolean): Return the per-record file list inside each table entry (default `false`, keeps the response small for large applications).

**Response:**
```json
{
  "result": {
    "scope": { "name": "x_acme_app", "sys_id": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" },
    "folder": "dev221527/x_acme_app",
    "tables": [
      { "table": "sys_script", "matchedRecords": 12, "pulledRecords": 12, "filesWritten": 12, "skippedEmpty": 0, "truncated": false },
      { "table": "sys_script_include", "matchedRecords": 140, "pulledRecords": 140, "filesWritten": 140, "skippedEmpty": 0, "truncated": false }
    ],
    "totals": { "tables": 2, "records": 152, "filesWritten": 152, "skippedEmpty": 0 },
    "skippedTables": [ { "table": "sys_properties", "records": 4 } ],
    "warnings": []
  }
}
```

Existing local files for the same records are refreshed in place and keep their file names through `_map.json`; a remote field that is now empty clears the local file. Run it again at any time to re-sync the whole application.
