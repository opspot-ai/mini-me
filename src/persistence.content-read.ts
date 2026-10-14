import type { MiniMeSnapshot } from "./schema/mini-me.js";

/** Return a detached point-in-time view; the SQLite adapter never caches this value. */
export function readContentSnapshot(snapshot: MiniMeSnapshot): MiniMeSnapshot {
  return structuredClone(snapshot);
}
