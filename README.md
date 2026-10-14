# Mini Me

Mini Me is a local personal adviser. An owner keeps six authored documents, selects evidence to learn from, reviews inferred beliefs, records corrections and undo, asks bounded choices, and records real outcomes. The same profile is available through a command line, a TypeScript library, and a standard stdio MCP server.

The package does not need OpenClaw, an account, a remote provider, or an automatic transcript reader. It was built and checked on macOS with Node.js 26.7.0 and npm 11.19.0. Its package engine range is Node.js 26.7.0 through 26.x; only Node.js 26.7.0 was exercised for this release. Other operating systems and the four named agent hosts have not been tested here.

## Install and build

From this package directory:

~~~sh
npm ci
npm run build
~~~

The npm package is private and is not uploaded by these commands. npm ci installs the exact lockfile versions. The runtime uses Node's built-in SQLite API.

## Create and use a profile

Choose one absolute data path outside the package. Initialization creates only the selected SQLite database; commands never scan your home directory or conversation history.

~~~sh
DATA="$HOME/.local/state/mini-me/mini-me.sqlite"
node dist/cli.js init --db "$DATA" --name "My Mini Me"
node dist/cli.js inspect --db "$DATA"
~~~

The authored documents are SOUL.md, OPINIONS.md, PREFERENCES.md, MORALS.md, TASTE.md, and DECISIONS.md. Read the current document revision before editing and pass that revision when setting content:

~~~sh
node dist/cli.js doc set --db "$DATA" --name PREFERENCES.md --expected-revision 0 --file ./preferences.md
node dist/cli.js doc render --db "$DATA" --name PREFERENCES.md
~~~

Rendering returns authored content plus a clearly separated generated section with learned evidence. Generated material is never written over the authored section. The owner edits the canonical document with doc set. A stale expected revision is rejected.

Select only a file or text the owner has chosen. This reads the exact path named on the command line; it does not enumerate nearby files:

~~~sh
node dist/cli.js source select --db "$DATA" --id style-notes --label "Selected style notes" --file ./selected-style.txt
node dist/cli.js source list --db "$DATA"
~~~

An MCP client can read these selected sources and submit extraction JSON. The extraction contract requires exact supporting UTF-16 spans. The server stores the result as inferred evidence, never as a direct owner preference.

An owner can add a direct preference, an explicit correction, or undo a belief using a JSON file matching this shape:

~~~json
{
  "document": "PREFERENCES.md",
  "scope": "editor theme",
  "statement": "Prefers dark editor themes.",
  "preferred": ["dark"],
  "avoided": ["light"]
}
~~~

~~~sh
node dist/cli.js learn direct --db "$DATA" --file ./preference.json
node dist/cli.js learn correct --db "$DATA" --file ./correction.json
node dist/cli.js undo --db "$DATA" --belief BELIEF_ID
~~~

Documents can also contain an explicit typed correction block. Its opening line is three backticks followed by mini-me-correction; place a preference JSON object inside and close it with three backticks:

~~~json
{"document":"PREFERENCES.md","scope":"editor theme","statement":"Use light themes for this project.","preferred":["light"],"avoided":[]}
~~~

Ordinary prose edits do not rewrite beliefs or frozen decisions. Only new valid mini-me-correction blocks append correction records.

Ask for a grounded choice and record an actual outcome only after the owner has chosen an option:

~~~json
{
  "scope": "editor theme",
  "question": "Which theme should I use?",
  "options": [
    {"id": "light", "label": "Light", "value": "light"},
    {"id": "dark", "label": "Dark", "value": "dark"}
  ]
}
~~~

~~~sh
node dist/cli.js predict --db "$DATA" --file ./choice.json
node dist/cli.js outcome --db "$DATA" --prediction PREDICTION_ID --option dark
~~~

Predictions always carry advisory authority. Abstention is normal when evidence is missing or conflicts. Outcomes do not establish accuracy beyond the explicitly recorded owner choice.

Source withdrawal removes that source's text and derived beliefs, predictions, linked outcomes, and suppression records in one SQLite transaction:

~~~sh
node dist/cli.js source remove --db "$DATA" --id style-notes
~~~

Export includes the selected source revisions, authored documents, beliefs, suppressions, frozen predictions, and owner outcomes. The owner imports to a new data path without a merge. Replacing an existing profile requires its current profile revision:

~~~sh
node dist/cli.js export --db "$DATA" --out ./private-export.json
node dist/cli.js import --db /absolute/path/to/new.sqlite --in ./private-export.json
node dist/cli.js import --db "$DATA" --in ./private-export.json --replace-revision CURRENT_REVISION
~~~

The export checksum detects accidental corruption; it is not a signature or proof of who created the file. Import is an owner operation and is not an MCP tool.

## Connect an agent

Install dependencies and build this package once. Set MINI_ME_DB_PATH to the chosen absolute database path in the MCP server's environment. Every client must use the same package entrypoint and data path.

### Claude Code

Claude Code's stdio command form supports environment variables. Replace both paths with the actual package and data paths:

~~~sh
claude mcp add --scope user --env MINI_ME_DB_PATH=/absolute/path/mini-me.sqlite --transport stdio mini-me -- node /absolute/path/mini-me-portable/dist/mcp-server.js
claude mcp list
~~~

### Codex CLI

Codex CLI supports a stdio process with environment values. This syntax was checked against the installed Codex CLI 0.162.1 help and the linked official MCP page:

~~~sh
codex mcp add mini-me --env MINI_ME_DB_PATH=/absolute/path/mini-me.sqlite -- node /absolute/path/mini-me-portable/dist/mcp-server.js
codex mcp list
~~~

Local Codex CLI configuration is not read by ChatGPT web.

### Hermes

Add the following under mcp_servers in the Hermes config.yaml. Hermes supports command, args, cwd, and env for a local stdio server:

~~~yaml
mcp_servers:
  mini-me:
    command: node
    args:
      - /absolute/path/mini-me-portable/dist/mcp-server.js
    cwd: /absolute/path/mini-me-portable
    env:
      MINI_ME_DB_PATH: /absolute/path/mini-me.sqlite
~~~

### OpenClaw

OpenClaw's built-in MCP client can launch a local stdio server. The registry command saves its definition; the doctor probe then starts it and lists the tools:

Before running `openclaw mcp add` or `openclaw mcp doctor ... --probe`, stop the local OpenClaw Gateway. For supported live MCP settings while the Gateway is running, use the OpenClaw Control UI.

~~~sh
openclaw mcp add mini-me \
  --command node \
  --arg /absolute/path/mini-me-portable/dist/mcp-server.js \
  --cwd /absolute/path/mini-me-portable \
  --env MINI_ME_DB_PATH=/absolute/path/mini-me.sqlite
openclaw mcp doctor mini-me --probe
~~~

This package uses the standard MCP client route and does not add an OpenClaw plugin, hook, session grant, or automatic source reader. OpenClaw tool plugins are a separate integration mechanism.

### Other MCP clients

Use the host's local stdio MCP configuration with command node, argument /absolute/path/mini-me-portable/dist/mcp-server.js, and environment variable MINI_ME_DB_PATH=/absolute/path/mini-me.sqlite. The server uses the official MCP TypeScript SDK. Its standard output is reserved for MCP frames; diagnostics go to standard error.

The MCP server exposes four agent operations: view active beliefs, read owner-selected source text, submit inferred extraction for a selected source, and consult a bounded choice. It has no document edit, source selection or withdrawal, direct learning, correction, undo, actual outcome, import/export, or approval operation.

## TypeScript library

The package exports the same owner and agent operations used by the adapters:

~~~ts
import { createMiniMeOwnerApi, createMiniMeAgentApi } from "mini-me-portable";

const owner = createMiniMeOwnerApi({ databasePath: "/absolute/path/mini-me.sqlite" });
const agent = createMiniMeAgentApi({ databasePath: "/absolute/path/mini-me.sqlite" });
const profile = owner.inspect();
const selectedSources = agent.selectedSources();
~~~

The owner API is for a trusted local process. An embedding host must decide which callers receive that API; caller JSON does not establish owner identity. The agent API cannot select sources, edit documents, correct or undo beliefs, record outcomes, or import state.

An optional decision provider can be injected into the owner library factory. No provider is configured by default, and the MCP server always uses the deterministic evidence baseline. A provider receives a bounded evidence batch and cannot grant permissions or change the prediction's advisory authority.

## Data, privacy, and limits

- Pass an absolute SQLite data path explicitly with --db or MINI_ME_DB_PATH. It must be outside the installed package.
- Each operation opens the same SQLite file and reads current state inside a transaction. Writes use SQLite BEGIN IMMEDIATE, WAL, and FULL synchronous mode; independent processes do not keep profile caches.
- Only the owner CLI/library can select or revise sources, edit authored documents, add direct beliefs, correct, undo, record actual outcomes, or import/export.
- MCP clients only see source material the owner has explicitly selected. No transcript, home-directory, or workspace scanning occurs.
- The trust boundary is the local user account. A malicious process running as that same user can read or change the selected database; this package is not a sandbox against same-user code.
- No shell, messaging, spending, arbitrary file edits, attachment grants, session controls, or approval actions are included.
- The SQLite journal and exported file may contain personal text. Keep the data directory and exports private.
- Host connection recipes above were checked against current primary documentation on 2026-10-14. No Claude Code, Codex, Hermes, or OpenClaw host connection was installed or exercised for this release.

## Host documentation

- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Codex and ChatGPT MCP](https://learn.chatgpt.com/docs/extend/mcp)
- [Hermes MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp/)
- [OpenClaw MCP client](https://docs.openclaw.ai/tools/mcp)
- [OpenClaw MCP registry CLI](https://docs.openclaw.ai/cli/mcp/registry)
- [OpenClaw tool plugins](https://docs.openclaw.ai/plugins/tool-plugins)
