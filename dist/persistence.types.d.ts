import type { MiniMeBelief, MiniMeSnapshot } from "./schema/mini-me.js";
export type MiniMeContentSnapshot = Pick<MiniMeSnapshot, "contentRevision" | "documents" | "sources" | "beliefs" | "predictions" | "outcomes" | "suppressions">;
export type MiniMeLearningResult = {
    applied: MiniMeBelief[];
    contentRevision: number;
};
export declare class MiniMePersistenceError extends Error {
    readonly reason: "conflict" | "invalid" | "not-found" | "limit-reached";
    readonly code: string;
    constructor(reason: "conflict" | "invalid" | "not-found" | "limit-reached", message: string);
}
