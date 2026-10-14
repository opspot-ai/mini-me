import type { Static } from "typebox";
import { Type } from "typebox";
export declare const MINI_ME_DOCUMENT_NAMES: readonly ["SOUL.md", "OPINIONS.md", "PREFERENCES.md", "MORALS.md", "TASTE.md", "DECISIONS.md"];
export declare const MiniMeDocumentNameSchema: Type.TUnion<[Type.TLiteral<"SOUL.md">, Type.TLiteral<"OPINIONS.md">, Type.TLiteral<"PREFERENCES.md">, Type.TLiteral<"MORALS.md">, Type.TLiteral<"TASTE.md">, Type.TLiteral<"DECISIONS.md">]>;
export declare const MiniMeProfileSchema: Type.TObject<{
    id: Type.TString;
    name: Type.TString;
    generation: Type.TInteger;
    revision: Type.TInteger;
    createdAt: Type.TInteger;
    updatedAt: Type.TInteger;
}>;
export declare const MiniMeSelectedSourceSchema: Type.TObject<{
    id: Type.TString;
    label: Type.TString;
    currentRevision: Type.TString;
    revisions: Type.TArray<Type.TObject<{
        revision: Type.TString;
        text: Type.TString;
        createdAt: Type.TInteger;
    }>>;
    createdAt: Type.TInteger;
}>;
export declare const MiniMeEvidenceSchema: Type.TObject<{
    sourceId: Type.TString;
    sourceRevision: Type.TString;
    excerpt: Type.TString;
}>;
export declare const MiniMePreferenceSchema: Type.TObject<{
    document: Type.TUnion<[Type.TLiteral<"SOUL.md">, Type.TLiteral<"OPINIONS.md">, Type.TLiteral<"PREFERENCES.md">, Type.TLiteral<"MORALS.md">, Type.TLiteral<"TASTE.md">, Type.TLiteral<"DECISIONS.md">]>;
    scope: Type.TString;
    statement: Type.TString;
    preferred: Type.TArray<Type.TString>;
    avoided: Type.TArray<Type.TString>;
}>;
export declare const MiniMeBeliefSchema: Type.TObject<{
    id: Type.TString;
    preference: Type.TObject<{
        document: Type.TUnion<[Type.TLiteral<"SOUL.md">, Type.TLiteral<"OPINIONS.md">, Type.TLiteral<"PREFERENCES.md">, Type.TLiteral<"MORALS.md">, Type.TLiteral<"TASTE.md">, Type.TLiteral<"DECISIONS.md">]>;
        scope: Type.TString;
        statement: Type.TString;
        preferred: Type.TArray<Type.TString>;
        avoided: Type.TArray<Type.TString>;
    }>;
    origin: Type.TUnion<[Type.TLiteral<"direct">, Type.TLiteral<"correction">, Type.TLiteral<"inferred">]>;
    evidence: Type.TArray<Type.TObject<{
        sourceId: Type.TString;
        sourceRevision: Type.TString;
        excerpt: Type.TString;
    }>>;
    status: Type.TUnion<[Type.TLiteral<"active">, Type.TLiteral<"superseded">, Type.TLiteral<"undone">]>;
    supersedes: Type.TUnion<[Type.TString, Type.TNull]>;
    createdAt: Type.TInteger;
}>;
export declare const MiniMeDocumentSchema: Type.TObject<{
    name: Type.TUnion<[Type.TLiteral<"SOUL.md">, Type.TLiteral<"OPINIONS.md">, Type.TLiteral<"PREFERENCES.md">, Type.TLiteral<"MORALS.md">, Type.TLiteral<"TASTE.md">, Type.TLiteral<"DECISIONS.md">]>;
    content: Type.TString;
    revision: Type.TInteger;
    updatedAt: Type.TInteger;
}>;
export declare const MiniMeChoiceSchema: Type.TObject<{
    scope: Type.TString;
    question: Type.TString;
    options: Type.TArray<Type.TObject<{
        id: Type.TString;
        label: Type.TString;
        value: Type.TString;
    }>>;
}>;
export declare const MiniMePredictionSchema: Type.TObject<{
    id: Type.TString;
    agentId: Type.TUnion<[Type.TString, Type.TNull]>;
    choice: Type.TObject<{
        scope: Type.TString;
        question: Type.TString;
        options: Type.TArray<Type.TObject<{
            id: Type.TString;
            label: Type.TString;
            value: Type.TString;
        }>>;
    }>;
    optionId: Type.TUnion<[Type.TString, Type.TNull]>;
    explanation: Type.TString;
    uncertainty: Type.TUnion<[Type.TLiteral<"low">, Type.TLiteral<"medium">, Type.TLiteral<"high">]>;
    evidence: Type.TArray<Type.TObject<{
        sourceId: Type.TString;
        sourceRevision: Type.TString;
        excerpt: Type.TString;
    }>>;
    beliefIds: Type.TArray<Type.TString>;
    correctionApplied: Type.TBoolean;
    provider: Type.TString;
    rubricVersion: Type.TString;
    providerRuntimeGeneration: Type.TUnion<[Type.TString, Type.TNull]>;
    createdAt: Type.TInteger;
    profileGeneration: Type.TInteger;
    contentRevision: Type.TInteger;
    authority: Type.TLiteral<"advisory">;
}>;
export declare const MiniMeOutcomeSchema: Type.TObject<{
    id: Type.TString;
    predictionId: Type.TString;
    optionId: Type.TString;
    origin: Type.TLiteral<"owner">;
    matched: Type.TBoolean;
    correctionId: Type.TUnion<[Type.TString, Type.TNull]>;
    createdAt: Type.TInteger;
}>;
export declare const MiniMeSuppressionSchema: Type.TObject<{
    sourceId: Type.TString;
    evidenceKey: Type.TString;
}>;
export declare const MiniMeSnapshotSchema: Type.TObject<{
    profile: Type.TUnion<[Type.TObject<{
        id: Type.TString;
        name: Type.TString;
        generation: Type.TInteger;
        revision: Type.TInteger;
        createdAt: Type.TInteger;
        updatedAt: Type.TInteger;
    }>, Type.TNull]>;
    contentRevision: Type.TInteger;
    documents: Type.TArray<Type.TObject<{
        name: Type.TUnion<[Type.TLiteral<"SOUL.md">, Type.TLiteral<"OPINIONS.md">, Type.TLiteral<"PREFERENCES.md">, Type.TLiteral<"MORALS.md">, Type.TLiteral<"TASTE.md">, Type.TLiteral<"DECISIONS.md">]>;
        content: Type.TString;
        revision: Type.TInteger;
        updatedAt: Type.TInteger;
    }>>;
    sources: Type.TArray<Type.TObject<{
        id: Type.TString;
        label: Type.TString;
        currentRevision: Type.TString;
        revisions: Type.TArray<Type.TObject<{
            revision: Type.TString;
            text: Type.TString;
            createdAt: Type.TInteger;
        }>>;
        createdAt: Type.TInteger;
    }>>;
    beliefs: Type.TArray<Type.TObject<{
        id: Type.TString;
        preference: Type.TObject<{
            document: Type.TUnion<[Type.TLiteral<"SOUL.md">, Type.TLiteral<"OPINIONS.md">, Type.TLiteral<"PREFERENCES.md">, Type.TLiteral<"MORALS.md">, Type.TLiteral<"TASTE.md">, Type.TLiteral<"DECISIONS.md">]>;
            scope: Type.TString;
            statement: Type.TString;
            preferred: Type.TArray<Type.TString>;
            avoided: Type.TArray<Type.TString>;
        }>;
        origin: Type.TUnion<[Type.TLiteral<"direct">, Type.TLiteral<"correction">, Type.TLiteral<"inferred">]>;
        evidence: Type.TArray<Type.TObject<{
            sourceId: Type.TString;
            sourceRevision: Type.TString;
            excerpt: Type.TString;
        }>>;
        status: Type.TUnion<[Type.TLiteral<"active">, Type.TLiteral<"superseded">, Type.TLiteral<"undone">]>;
        supersedes: Type.TUnion<[Type.TString, Type.TNull]>;
        createdAt: Type.TInteger;
    }>>;
    predictions: Type.TArray<Type.TObject<{
        id: Type.TString;
        agentId: Type.TUnion<[Type.TString, Type.TNull]>;
        choice: Type.TObject<{
            scope: Type.TString;
            question: Type.TString;
            options: Type.TArray<Type.TObject<{
                id: Type.TString;
                label: Type.TString;
                value: Type.TString;
            }>>;
        }>;
        optionId: Type.TUnion<[Type.TString, Type.TNull]>;
        explanation: Type.TString;
        uncertainty: Type.TUnion<[Type.TLiteral<"low">, Type.TLiteral<"medium">, Type.TLiteral<"high">]>;
        evidence: Type.TArray<Type.TObject<{
            sourceId: Type.TString;
            sourceRevision: Type.TString;
            excerpt: Type.TString;
        }>>;
        beliefIds: Type.TArray<Type.TString>;
        correctionApplied: Type.TBoolean;
        provider: Type.TString;
        rubricVersion: Type.TString;
        providerRuntimeGeneration: Type.TUnion<[Type.TString, Type.TNull]>;
        createdAt: Type.TInteger;
        profileGeneration: Type.TInteger;
        contentRevision: Type.TInteger;
        authority: Type.TLiteral<"advisory">;
    }>>;
    outcomes: Type.TArray<Type.TObject<{
        id: Type.TString;
        predictionId: Type.TString;
        optionId: Type.TString;
        origin: Type.TLiteral<"owner">;
        matched: Type.TBoolean;
        correctionId: Type.TUnion<[Type.TString, Type.TNull]>;
        createdAt: Type.TInteger;
    }>>;
    suppressions: Type.TArray<Type.TObject<{
        sourceId: Type.TString;
        evidenceKey: Type.TString;
    }>>;
}>;
export declare const MiniMeExportSchema: Type.TObject<{
    format: Type.TLiteral<"mini-me-portable-v1">;
    exportedAt: Type.TInteger;
    snapshot: Type.TObject<{
        profile: Type.TUnion<[Type.TObject<{
            id: Type.TString;
            name: Type.TString;
            generation: Type.TInteger;
            revision: Type.TInteger;
            createdAt: Type.TInteger;
            updatedAt: Type.TInteger;
        }>, Type.TNull]>;
        contentRevision: Type.TInteger;
        documents: Type.TArray<Type.TObject<{
            name: Type.TUnion<[Type.TLiteral<"SOUL.md">, Type.TLiteral<"OPINIONS.md">, Type.TLiteral<"PREFERENCES.md">, Type.TLiteral<"MORALS.md">, Type.TLiteral<"TASTE.md">, Type.TLiteral<"DECISIONS.md">]>;
            content: Type.TString;
            revision: Type.TInteger;
            updatedAt: Type.TInteger;
        }>>;
        sources: Type.TArray<Type.TObject<{
            id: Type.TString;
            label: Type.TString;
            currentRevision: Type.TString;
            revisions: Type.TArray<Type.TObject<{
                revision: Type.TString;
                text: Type.TString;
                createdAt: Type.TInteger;
            }>>;
            createdAt: Type.TInteger;
        }>>;
        beliefs: Type.TArray<Type.TObject<{
            id: Type.TString;
            preference: Type.TObject<{
                document: Type.TUnion<[Type.TLiteral<"SOUL.md">, Type.TLiteral<"OPINIONS.md">, Type.TLiteral<"PREFERENCES.md">, Type.TLiteral<"MORALS.md">, Type.TLiteral<"TASTE.md">, Type.TLiteral<"DECISIONS.md">]>;
                scope: Type.TString;
                statement: Type.TString;
                preferred: Type.TArray<Type.TString>;
                avoided: Type.TArray<Type.TString>;
            }>;
            origin: Type.TUnion<[Type.TLiteral<"direct">, Type.TLiteral<"correction">, Type.TLiteral<"inferred">]>;
            evidence: Type.TArray<Type.TObject<{
                sourceId: Type.TString;
                sourceRevision: Type.TString;
                excerpt: Type.TString;
            }>>;
            status: Type.TUnion<[Type.TLiteral<"active">, Type.TLiteral<"superseded">, Type.TLiteral<"undone">]>;
            supersedes: Type.TUnion<[Type.TString, Type.TNull]>;
            createdAt: Type.TInteger;
        }>>;
        predictions: Type.TArray<Type.TObject<{
            id: Type.TString;
            agentId: Type.TUnion<[Type.TString, Type.TNull]>;
            choice: Type.TObject<{
                scope: Type.TString;
                question: Type.TString;
                options: Type.TArray<Type.TObject<{
                    id: Type.TString;
                    label: Type.TString;
                    value: Type.TString;
                }>>;
            }>;
            optionId: Type.TUnion<[Type.TString, Type.TNull]>;
            explanation: Type.TString;
            uncertainty: Type.TUnion<[Type.TLiteral<"low">, Type.TLiteral<"medium">, Type.TLiteral<"high">]>;
            evidence: Type.TArray<Type.TObject<{
                sourceId: Type.TString;
                sourceRevision: Type.TString;
                excerpt: Type.TString;
            }>>;
            beliefIds: Type.TArray<Type.TString>;
            correctionApplied: Type.TBoolean;
            provider: Type.TString;
            rubricVersion: Type.TString;
            providerRuntimeGeneration: Type.TUnion<[Type.TString, Type.TNull]>;
            createdAt: Type.TInteger;
            profileGeneration: Type.TInteger;
            contentRevision: Type.TInteger;
            authority: Type.TLiteral<"advisory">;
        }>>;
        outcomes: Type.TArray<Type.TObject<{
            id: Type.TString;
            predictionId: Type.TString;
            optionId: Type.TString;
            origin: Type.TLiteral<"owner">;
            matched: Type.TBoolean;
            correctionId: Type.TUnion<[Type.TString, Type.TNull]>;
            createdAt: Type.TInteger;
        }>>;
        suppressions: Type.TArray<Type.TObject<{
            sourceId: Type.TString;
            evidenceKey: Type.TString;
        }>>;
    }>;
    sha256: Type.TString;
}>;
export type MiniMeDocumentName = (typeof MINI_ME_DOCUMENT_NAMES)[number];
export type MiniMeProfile = Static<typeof MiniMeProfileSchema>;
export type MiniMeSelectedSource = Static<typeof MiniMeSelectedSourceSchema>;
export type MiniMeEvidence = Static<typeof MiniMeEvidenceSchema>;
export type MiniMePreference = Static<typeof MiniMePreferenceSchema>;
export type MiniMeBelief = Static<typeof MiniMeBeliefSchema>;
export type MiniMeDocument = Static<typeof MiniMeDocumentSchema>;
export type MiniMeChoice = Static<typeof MiniMeChoiceSchema>;
export type MiniMePrediction = Static<typeof MiniMePredictionSchema>;
export type MiniMeOutcome = Static<typeof MiniMeOutcomeSchema>;
export type MiniMeSuppression = Static<typeof MiniMeSuppressionSchema>;
export type MiniMeSnapshot = Static<typeof MiniMeSnapshotSchema>;
export type MiniMeExport = Static<typeof MiniMeExportSchema>;
