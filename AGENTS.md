# Mini Me Portable

This package stores one personal profile in an explicitly selected SQLite file and exposes the same domain through an owner CLI/library and a restricted stdio MCP server.

- Install with npm ci, build with npm run build, and run focused acceptance with npm test.
- Source and tests live in src and test. dist is generated runtime output.
- Keep all profile data outside this package. Never scan transcripts or home directories.
- The MCP adapter is agent-facing; do not expose owner methods through client arguments.
- Keep prediction advisory and make owner outcomes explicit.
- Do not add host actions, native hooks, or implicit provider calls.
- Preserve the OpenClaw MIT attribution in LICENSE and NOTICE.md when changing reused code.
