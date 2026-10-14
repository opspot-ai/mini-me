import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createMiniMeAgentApi } from "./store.js";

const choiceSchema = z
  .object({
    scope: z.string().min(1).max(128),
    question: z.string().min(1).max(4096),
    options: z
      .array(
        z.object({
          id: z.string().min(1).max(128),
          label: z.string().min(1).max(512),
          value: z.string().min(1).max(512),
        }).strict(),
      )
      .min(2)
      .max(8),
  })
  .strict();

const emptySchema = z.object({}).strict();

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export function createMiniMeMcpServer(databasePath: string): McpServer {
  const agent = createMiniMeAgentApi({ databasePath });
  const server = new McpServer(
    { name: "mini-me", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    "mini_me_view",
    {
      title: "View Mini Me beliefs",
      description: "Read the named profile and active scoped beliefs. This tool provides advice context only.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => textResult(agent.view()),
  );

  server.registerTool(
    "mini_me_selected_sources",
    {
      title: "Read owner selected sources",
      description: "Read only source text the owner explicitly selected for Mini Me learning.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => textResult(agent.selectedSources()),
  );

  server.registerTool(
    "mini_me_submit_inference",
    {
      title: "Submit inferred learning",
      description: "Submit bounded extraction JSON for an owner selected source. The result is always inferred, never owner truth.",
      inputSchema: z
        .object({
          sourceId: z.string().min(1).max(128),
          response: z.string().max(32_768),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ sourceId, response }) => textResult(agent.infer(sourceId, response)),
  );

  server.registerTool(
    "mini_me_consult",
    {
      title: "Consult Mini Me",
      description: "Compare a bounded choice with scoped personal evidence and return an advisory prediction or abstention.",
      inputSchema: z.object({ choice: choiceSchema }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ choice }) => textResult(await agent.consult(choice)),
  );

  return server;
}

export async function runMiniMeMcpServer(databasePath: string): Promise<void> {
  const server = createMiniMeMcpServer(databasePath);
  await server.connect(new StdioServerTransport());
}

async function main(): Promise<void> {
  const databasePath = process.env.MINI_ME_DB_PATH;
  if (!databasePath) {
    throw new Error("Set MINI_ME_DB_PATH to an absolute SQLite path outside the installed package");
  }
  await runMiniMeMcpServer(databasePath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error("Mini Me MCP server stopped:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
