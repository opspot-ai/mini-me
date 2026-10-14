import { Type } from "typebox";
import { closedObject } from "./closed-object.js";
const Id = Type.String({ minLength: 1, maxLength: 128 });
const Revision = Type.Integer({ minimum: 0 });
const Timestamp = Type.Integer({ minimum: 0 });
const ShortText = Type.String({ minLength: 1, maxLength: 512 });
const Scope = Type.String({ minLength: 1, maxLength: 128 });
export const MINI_ME_DOCUMENT_NAMES = [
    "SOUL.md",
    "OPINIONS.md",
    "PREFERENCES.md",
    "MORALS.md",
    "TASTE.md",
    "DECISIONS.md",
];
export const MiniMeDocumentNameSchema = Type.Union([
    Type.Literal("SOUL.md"),
    Type.Literal("OPINIONS.md"),
    Type.Literal("PREFERENCES.md"),
    Type.Literal("MORALS.md"),
    Type.Literal("TASTE.md"),
    Type.Literal("DECISIONS.md"),
]);
export const MiniMeProfileSchema = closedObject({
    id: Id,
    name: Type.String({ minLength: 1, maxLength: 80 }),
    generation: Revision,
    revision: Revision,
    createdAt: Timestamp,
    updatedAt: Timestamp,
});
export const MiniMeSelectedSourceSchema = closedObject({
    id: Id,
    label: ShortText,
    currentRevision: Id,
    revisions: Type.Array(closedObject({
        revision: Id,
        text: Type.String({ minLength: 1, maxLength: 32_768 }),
        createdAt: Timestamp,
    }), { minItems: 1, maxItems: 64 }),
    createdAt: Timestamp,
});
export const MiniMeEvidenceSchema = closedObject({
    sourceId: Id,
    sourceRevision: Id,
    excerpt: Type.String({ minLength: 1, maxLength: 4096 }),
});
export const MiniMePreferenceSchema = closedObject({
    document: MiniMeDocumentNameSchema,
    scope: Scope,
    statement: Type.String({ minLength: 1, maxLength: 4096 }),
    preferred: Type.Array(ShortText, { maxItems: 8, uniqueItems: true }),
    avoided: Type.Array(ShortText, { maxItems: 8, uniqueItems: true }),
});
export const MiniMeBeliefSchema = closedObject({
    id: Id,
    preference: MiniMePreferenceSchema,
    origin: Type.Union([Type.Literal("direct"), Type.Literal("correction"), Type.Literal("inferred")]),
    evidence: Type.Array(MiniMeEvidenceSchema, { minItems: 1, maxItems: 16 }),
    status: Type.Union([Type.Literal("active"), Type.Literal("superseded"), Type.Literal("undone")]),
    supersedes: Type.Union([Id, Type.Null()]),
    createdAt: Timestamp,
});
export const MiniMeDocumentSchema = closedObject({
    name: MiniMeDocumentNameSchema,
    content: Type.String({ maxLength: 65_536 }),
    revision: Revision,
    updatedAt: Timestamp,
});
export const MiniMeChoiceSchema = closedObject({
    scope: Scope,
    question: Type.String({ minLength: 1, maxLength: 4096 }),
    options: Type.Array(closedObject({ id: Id, label: ShortText, value: ShortText }), { minItems: 2, maxItems: 8 }),
});
export const MiniMePredictionSchema = closedObject({
    id: Id,
    agentId: Type.Union([Id, Type.Null()]),
    choice: MiniMeChoiceSchema,
    optionId: Type.Union([Id, Type.Null()]),
    explanation: Type.String({ maxLength: 8192 }),
    uncertainty: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
    evidence: Type.Array(MiniMeEvidenceSchema, { maxItems: 16 }),
    beliefIds: Type.Array(Id, { maxItems: 32 }),
    correctionApplied: Type.Boolean(),
    provider: ShortText,
    rubricVersion: ShortText,
    providerRuntimeGeneration: Type.Union([Id, Type.Null()]),
    createdAt: Timestamp,
    profileGeneration: Revision,
    contentRevision: Revision,
    authority: Type.Literal("advisory"),
});
export const MiniMeOutcomeSchema = closedObject({
    id: Id,
    predictionId: Id,
    optionId: Id,
    origin: Type.Literal("owner"),
    matched: Type.Boolean(),
    correctionId: Type.Union([Id, Type.Null()]),
    createdAt: Timestamp,
});
export const MiniMeSuppressionSchema = closedObject({
    sourceId: Id,
    evidenceKey: Type.String({ pattern: "^[a-f0-9]{64}$" }),
});
export const MiniMeSnapshotSchema = closedObject({
    profile: Type.Union([MiniMeProfileSchema, Type.Null()]),
    contentRevision: Revision,
    documents: Type.Array(MiniMeDocumentSchema, { maxItems: 6 }),
    sources: Type.Array(MiniMeSelectedSourceSchema, { maxItems: 16 }),
    beliefs: Type.Array(MiniMeBeliefSchema),
    predictions: Type.Array(MiniMePredictionSchema),
    outcomes: Type.Array(MiniMeOutcomeSchema),
    suppressions: Type.Array(MiniMeSuppressionSchema),
});
export const MiniMeExportSchema = closedObject({
    format: Type.Literal("mini-me-portable-v1"),
    exportedAt: Timestamp,
    snapshot: MiniMeSnapshotSchema,
    sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
});
