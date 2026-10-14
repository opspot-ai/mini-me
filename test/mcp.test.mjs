import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createMiniMeOwnerApi, createMiniMeAgentApi } from "../dist/index.js";

const temporaryDirectories = [];
const activeClients = [];
const temp = () => {
  const directory = mkdtempSync(join(tmpdir(), "mini-me-mcp-"));
  temporaryDirectories.push(directory);
  return directory;
};

async function connect(databasePath, name) {
  const root = resolve(new URL("..", import.meta.url).pathname);
  const env = Object.fromEntries(Object.entries(process.env).filter((entry) => typeof entry[1] === "string"));
  env.MINI_ME_DB_PATH = databasePath;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, "dist", "mcp-server.js")],
    cwd: root,
    env,
    stderr: "pipe",
  });
  const client = new Client({ name, version: "1.0.0" });
  activeClients.push(client);
  await client.connect(transport);
  return client;
}

function toolText(result) {
  assert.equal(result.isError, undefined);
  const content = result.content.find((item) => item.type === "text");
  assert.ok(content);
  return JSON.parse(content.text);
}

afterEach(async () => {
  for (const client of activeClients.splice(0)) {
    await client.close().catch(() => {});
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("official MCP stdio transport", () => {
  // Replaces settled conversation admission and transcript provenance with an explicit owner-selected
  // source list and rejects caller fields that attempt to claim owner authority.
  it("initializes, discovers bounded tools, rejects owner spoofing, shares concurrent state, and survives process restart", async () => {
    const databasePath = join(temp(), "shared.sqlite");
    const owner = createMiniMeOwnerApi({ databasePath });
    owner.init("MCP synthetic profile", 1);
    owner.correct({
      document: "PREFERENCES.md",
      scope: "editor theme",
      statement: "Use the dark editor theme.",
      preferred: ["dark"],
      avoided: ["light"],
    }, 2);
    owner.selectSource({
      id: "selected-notes",
      label: "Selected notes",
      text: "Dark editor themes feel calm. I also prefer a quiet workspace.",
      now: 3,
    });

    const first = await connect(databasePath, "acceptance-client-a");
    const second = await connect(databasePath, "acceptance-client-b");
    const [firstTools, secondTools] = await Promise.all([first.listTools(), second.listTools()]);
    const toolNames = ["mini_me_view", "mini_me_selected_sources", "mini_me_submit_inference", "mini_me_consult"];
    assert.deepEqual(firstTools.tools.map((tool) => tool.name).sort(), [...toolNames].sort());
    assert.deepEqual(secondTools.tools.map((tool) => tool.name).sort(), [...toolNames].sort());

    const view = toolText(await first.callTool({ name: "mini_me_view", arguments: {} }));
    assert.equal(view.profile.name, "MCP synthetic profile");
    assert.equal(view.beliefs[0].origin, "correction");
    assert.equal(view.beliefs[0].preference.preferred[0], "dark");
    const sources = toolText(await second.callTool({ name: "mini_me_selected_sources", arguments: {} }));
    assert.equal(sources[0].text, "Dark editor themes feel calm. I also prefer a quiet workspace.");

    const sourceText = sources[0].text;
    const darkExcerpt = "Dark editor themes feel calm.";
    const quietExcerpt = "I also prefer a quiet workspace.";
    const extraction = (excerpt, scope, statement, preferred) => JSON.stringify({
      preferences: [{
        preference: { document: "TASTE.md", scope, statement, preferred, avoided: [] },
        start: sourceText.indexOf(excerpt),
        end: sourceText.indexOf(excerpt) + excerpt.length,
      }],
    });
    const [darkResult, quietResult] = await Promise.all([
      first.callTool({ name: "mini_me_submit_inference", arguments: {
        sourceId: "selected-notes",
        response: extraction(darkExcerpt, "editor atmosphere", "Dark themes feel calm.", ["dark"]),
      } }),
      second.callTool({ name: "mini_me_submit_inference", arguments: {
        sourceId: "selected-notes",
        response: extraction(quietExcerpt, "workspace sound", "Prefers a quiet workspace.", ["quiet"]),
      } }),
    ]);
    assert.equal(toolText(darkResult).length, 1);
    assert.equal(toolText(quietResult).length, 1);

    const spoofAttempts = [
      { sourceId: "selected-notes", response: JSON.stringify({ preferences: [], origin: "direct" }) },
      { sourceId: "selected-notes", response: JSON.stringify({ preferences: [], humanRequest: true }) },
      { sourceId: "selected-notes", response: JSON.stringify({ preferences: [], ownerId: "owner" }) },
      { sourceId: "selected-notes", response: "{\"preferences\":[{\"preference\":{},\"start\":0,\"end\":999999}]}" },
    ];
    for (const args of spoofAttempts) {
      const result = await first.callTool({ name: "mini_me_submit_inference", arguments: args });
      assert.equal(result.isError, true);
    }
    assert.equal((await first.callTool({
      name: "mini_me_submit_inference",
      arguments: { sourceId: "missing-source", response: JSON.stringify({ preferences: [] }) },
    })).isError, true);
    assert.equal((await first.callTool({
      name: "mini_me_submit_inference",
      arguments: { sourceId: "selected-notes", response: JSON.stringify({ preferences: [] }), origin: "owner" },
    })).isError, true);
    assert.equal((await first.callTool({ name: "mini_me_record_outcome", arguments: { predictionId: "x", optionId: "x" } })).isError, true);

    const agent = createMiniMeAgentApi({ databasePath });
    const afterWrites = agent.view();
    assert.equal(afterWrites.beliefs.length, 3);
    assert.ok(afterWrites.beliefs.some((belief) => belief.preference.scope === "editor atmosphere"));
    assert.ok(afterWrites.beliefs.some((belief) => belief.preference.scope === "workspace sound"));

    await first.close();
    activeClients.splice(activeClients.indexOf(first), 1);
    await second.close();
    activeClients.splice(activeClients.indexOf(second), 1);
    const restarted = await connect(databasePath, "acceptance-client-restarted");
    const persisted = toolText(await restarted.callTool({ name: "mini_me_view", arguments: {} }));
    assert.equal(persisted.profile.name, "MCP synthetic profile");
    assert.equal(persisted.beliefs.length, 3);
    assert.ok(persisted.beliefs.some((belief) => belief.origin === "correction"));

    const choice = {
      scope: "editor theme",
      question: "Which editor theme?",
      options: [
        { id: "dark", label: "Dark", value: "dark" },
        { id: "light", label: "Light", value: "light" },
      ],
    };
    const prediction = toolText(await restarted.callTool({
      name: "mini_me_consult",
      arguments: { choice },
    }));
    assert.equal(prediction.authority, "advisory");
    assert.equal(prediction.optionId, "dark");
  });
});
