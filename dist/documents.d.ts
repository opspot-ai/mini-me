import { type MiniMeBelief, type MiniMeDocument, type MiniMeDocumentName, type MiniMeProfile, type MiniMePrediction, type MiniMeOutcome } from "./schema/mini-me.js";
/** Render owner-authored content separately from generated beliefs and decision provenance. */
export declare function renderMiniMeDocument(profile: MiniMeProfile, document: MiniMeDocument, beliefs: readonly MiniMeBelief[], decisions?: {
    predictions: readonly MiniMePrediction[];
    outcomes: readonly MiniMeOutcome[];
}): string;
export declare function inspectMiniMeDocument(text: string, profile: MiniMeProfile, name: MiniMeDocumentName): {
    authored: string;
    revision: number;
    authoredChanged: boolean;
};
export declare function renderAllMiniMeDocuments(input: {
    profile: MiniMeProfile;
    documents: readonly MiniMeDocument[];
    beliefs: readonly MiniMeBelief[];
    predictions: readonly MiniMePrediction[];
    outcomes: readonly MiniMeOutcome[];
}): Record<MiniMeDocumentName, string>;
