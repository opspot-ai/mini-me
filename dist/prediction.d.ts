import type { MiniMeBelief, MiniMeChoice, MiniMePrediction } from "./schema/mini-me.js";
export declare const MINI_ME_RUBRIC_VERSION = "mini-me.preference-choice.v1";
export type MiniMePredictionInput = {
    id: string;
    agentId: string | null;
    choice: MiniMeChoice;
    beliefs: readonly MiniMeBelief[];
    profileGeneration: number;
    contentRevision: number;
    now: number;
};
export type PortableDecisionBatch = {
    state: {
        question: string;
        scope: string;
        evidence: Array<{
            statement: string;
            origin: MiniMeBelief["origin"];
            preferred: string[];
            avoided: string[];
            quotes: string[];
        }>;
    };
    questions: {
        preference: {
            type: "choice";
            instructions: string;
            criteria: Record<string, unknown>;
        };
    };
};
export type PortableDecisionOutcome = {
    status: "ok";
    result: {
        model: string;
        answers: {
            preference?: {
                type: string;
                choice: string;
            };
        };
    };
    provenance: {
        runtimeGeneration: string | null;
    };
} | {
    status: "unavailable";
    reason: string;
};
export declare function predictMiniMeBaseline(input: MiniMePredictionInput): MiniMePrediction;
/** The injected-provider contract carries selected evidence, never grants or credentials. */
export declare function buildMiniMeDecisionBatch(input: MiniMePredictionInput): PortableDecisionBatch | undefined;
export declare function applyMiniMeDecisionOutcome(input: MiniMePredictionInput, outcome: PortableDecisionOutcome): MiniMePrediction;
