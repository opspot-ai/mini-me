import { type MiniMeChoice } from "./schema/mini-me.js";
/** One semantic choice contract for the MCP, CLI, library, and prediction core. */
export declare function isValidMiniMeChoice(choice: unknown): choice is MiniMeChoice;
