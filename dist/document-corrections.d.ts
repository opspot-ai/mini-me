import { type MiniMePreference } from "./schema/mini-me.js";
/** Typed correction blocks are explicit; ordinary prose never rewrites frozen history. */
export declare function miniMeDocumentCorrections(content: string): MiniMePreference[];
export declare function newMiniMeDocumentCorrections(previous: string, next: string): MiniMePreference[];
