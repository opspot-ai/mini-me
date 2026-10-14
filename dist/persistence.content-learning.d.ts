import type { MiniMeBelief, MiniMeEvidence, MiniMeSnapshot } from "./schema/mini-me.js";
import { type MiniMeLearningResult } from "./persistence.types.js";
export declare function suppressionKey(origin: MiniMeBelief["origin"], evidence: MiniMeEvidence): string;
export declare function learningKey(belief: MiniMeBelief): string;
/** Atomic batch semantics adapted from the OpenClaw SQLite learning operation. */
export declare function learnBeliefBatch(state: MiniMeSnapshot, input: readonly MiniMeBelief[]): MiniMeLearningResult;
/** Undo writes durable evidence suppression before restoring a superseded record. */
export declare function undoBelief(state: MiniMeSnapshot, beliefId: string): MiniMeBelief;
