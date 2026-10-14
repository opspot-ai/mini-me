import type { MiniMeBelief, MiniMeChoice, MiniMeDocument, MiniMeDocumentName, MiniMeExport, MiniMeOutcome, MiniMePreference, MiniMePrediction, MiniMeSelectedSource, MiniMeSnapshot } from "./schema/mini-me.js";
import { type PortableDecisionBatch, type PortableDecisionOutcome } from "./prediction.js";
export type MiniMeDecisionProvider = (batch: PortableDecisionBatch) => Promise<PortableDecisionOutcome>;
export type MiniMeOwnerApi = ReturnType<typeof createMiniMeOwnerApi>;
export type MiniMeAgentApi = ReturnType<typeof createMiniMeAgentApi>;
/**
 * Owner API for a trusted local principal. Do not expose it directly to an untrusted transport.
 * The same-user process boundary is a local trust boundary, not a malicious-code sandbox.
 */
export declare function createMiniMeOwnerApi(input: {
    databasePath: string;
    decisionProvider?: MiniMeDecisionProvider;
}): {
    init(name: string, now?: number): MiniMeSnapshot;
    inspect(): MiniMeSnapshot;
    predict(choice: MiniMeChoice, now?: number): Promise<MiniMePrediction>;
    setDocument(input: {
        name: MiniMeDocumentName;
        content: string;
        expectedRevision: number;
        now?: number;
    }): MiniMeDocument;
    selectSource(input: {
        id: string;
        label: string;
        text: string;
        now?: number;
    }): MiniMeSelectedSource;
    reviseSource(input: {
        sourceId: string;
        expectedRevision: string;
        text: string;
        now?: number;
    }): MiniMeSelectedSource;
    removeSource(sourceId: string): number;
    learnDirect(preference: MiniMePreference, now?: number): MiniMeBelief | null;
    correct(preference: MiniMePreference, now?: number): MiniMeBelief | null;
    undo(beliefId: string): MiniMeBelief;
    recordOutcome(input: {
        predictionId: string;
        optionId: string;
        correction?: MiniMePreference;
        now?: number;
    }): MiniMeOutcome;
    renderDocument(name: MiniMeDocumentName): string;
    renderAllDocuments(): Record<MiniMeDocumentName, string>;
    inspectProjection(name: MiniMeDocumentName, text: string): {
        authored: string;
        revision: number;
        authoredChanged: boolean;
    };
    exportState(now?: number): MiniMeExport;
    importState(value: unknown, options?: {
        expectedRevision?: number;
        now?: number;
    }): MiniMeSnapshot;
};
/** Default agent-facing API. It has no owner methods, import/export, or filesystem effects. */
export declare function createMiniMeAgentApi(input: {
    databasePath: string;
}): {
    view(): Pick<MiniMeSnapshot, "profile" | "contentRevision" | "beliefs">;
    selectedSources(): Array<{
        id: string;
        label: string;
        revision: string;
        text: string;
    }>;
    infer(sourceId: string, response: string, now?: number): MiniMeBelief[];
    consult(choice: MiniMeChoice, now?: number): Promise<MiniMePrediction>;
    consultBaseline(choice: MiniMeChoice, now?: number): Promise<MiniMePrediction>;
};
