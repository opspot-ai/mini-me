import type { MiniMeSelectedSource, MiniMeSnapshot } from "./schema/mini-me.js";
export declare function addContentSource(state: MiniMeSnapshot, input: {
    id: string;
    label: string;
    text: string;
    now: number;
}): MiniMeSelectedSource;
export declare function appendContentSourceRevision(state: MiniMeSnapshot, input: {
    sourceId: string;
    expectedRevision: string;
    text: string;
    now: number;
}): MiniMeSelectedSource;
/** Withdrawal atomically removes source text, derived beliefs, predictions, outcomes and suppressions. */
export declare function removeContentSource(state: MiniMeSnapshot, sourceId: string): number;
export declare function newSourceId(): string;
