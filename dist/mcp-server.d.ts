import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function createMiniMeMcpServer(databasePath: string): McpServer;
export declare function runMiniMeMcpServer(databasePath: string): Promise<void>;
