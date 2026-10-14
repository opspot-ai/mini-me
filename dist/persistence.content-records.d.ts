import type { MiniMeDocument, MiniMeDocumentName, MiniMeOutcome, MiniMePrediction, MiniMeSnapshot } from "./schema/mini-me.js";
export declare function reviseDocument(state: MiniMeSnapshot, input: {
    name: MiniMeDocumentName;
    expectedRevision: number;
    content: string;
    now: number;
}): MiniMeDocument;
/** Freeze only a current, schema-valid, advisory prediction grounded in active evidence. */
export declare function freezePrediction(state: MiniMeSnapshot, prediction: MiniMePrediction): null;
/** Append a genuine owner outcome after validating it against the frozen choice. */
export declare function appendOutcome(state: MiniMeSnapshot, outcome: MiniMeOutcome): MiniMeOutcome;
export declare function newPredictionId(): string;
