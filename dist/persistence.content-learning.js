import { normalizeMiniMeValue } from "./learning.js";
import { miniMeOperationFingerprint } from "./fingerprint.js";
import { MiniMePersistenceError } from "./persistence.types.js";
// Inferred replay is keyed by selected source identity and normalized support text,
// so a source append does not undo an owner's earlier suppression.
export function suppressionKey(origin, evidence) {
    return miniMeOperationFingerprint(origin === "inferred"
        ? ["excerpt-v1", normalizeMiniMeValue(evidence.excerpt)]
        : ["revision-v1", evidence.sourceRevision]);
}
export function learningKey(belief) {
    if (belief.origin !== "inferred") {
        return miniMeOperationFingerprint({
            preference: belief.preference,
            origin: belief.origin,
            evidence: belief.evidence,
        });
    }
    const preference = belief.preference;
    return miniMeOperationFingerprint({
        origin: belief.origin,
        preference: {
            document: preference.document,
            scope: normalizeMiniMeValue(preference.scope),
            statement: normalizeMiniMeValue(preference.statement),
            preferred: preference.preferred
                .map(normalizeMiniMeValue)
                .toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
            avoided: preference.avoided
                .map(normalizeMiniMeValue)
                .toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
        },
        evidence: belief.evidence
            .map((entry) => [entry.sourceId, suppressionKey(belief.origin, entry)])
            .toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    });
}
function supportsEvidence(state, evidence) {
    const source = state.sources.find((item) => item.id === evidence.sourceId);
    if (source) {
        const revision = source.revisions.find((item) => item.revision === evidence.sourceRevision);
        return Boolean(revision && revision.text.includes(evidence.excerpt));
    }
    return (evidence.sourceId.startsWith("owner:") &&
        evidence.excerpt.length > 0 &&
        /^[a-f0-9]{64}$/.test(evidence.sourceRevision));
}
/** Atomic batch semantics adapted from the OpenClaw SQLite learning operation. */
export function learnBeliefBatch(state, input) {
    const applied = [];
    for (const belief of input) {
        const evidenceKey = learningKey(belief);
        if (state.beliefs.some((known) => learningKey(known) === evidenceKey)) {
            continue;
        }
        const knownId = state.beliefs.find((known) => known.id === belief.id);
        if (knownId) {
            if (miniMeOperationFingerprint(knownId) !== miniMeOperationFingerprint(belief)) {
                throw new MiniMePersistenceError("conflict", "Belief ID already names different evidence");
            }
            continue;
        }
        if (!belief.evidence.length ||
            belief.evidence.some((entry) => !supportsEvidence(state, entry)) ||
            (belief.origin === "inferred" && belief.evidence.some((entry) => !state.sources.some((s) => s.id === entry.sourceId)))) {
            throw new MiniMePersistenceError("invalid", "Belief evidence must reference selected owner sources");
        }
        const suppressed = belief.evidence.some((entry) => state.suppressions.some((item) => item.sourceId === entry.sourceId &&
            item.evidenceKey === suppressionKey(belief.origin, entry)));
        if (suppressed) {
            continue;
        }
        if (belief.supersedes) {
            const prior = state.beliefs.find((item) => item.id === belief.supersedes);
            if (!prior) {
                throw new MiniMePersistenceError("not-found", "Corrected belief is unavailable");
            }
            if (belief.origin !== "correction" ||
                normalizeMiniMeValue(prior.preference.scope) !== normalizeMiniMeValue(belief.preference.scope)) {
                throw new MiniMePersistenceError("invalid", "Only an owner correction may supersede a comparable belief");
            }
            prior.status = "superseded";
        }
        state.beliefs.push(structuredClone(belief));
        applied.push(structuredClone(belief));
    }
    if (applied.length) {
        state.contentRevision += 1;
    }
    return { applied, contentRevision: state.contentRevision };
}
/** Undo writes durable evidence suppression before restoring a superseded record. */
export function undoBelief(state, beliefId) {
    const belief = state.beliefs.find((item) => item.id === beliefId);
    if (!belief) {
        throw new MiniMePersistenceError("not-found", "Learned belief is unavailable");
    }
    for (const evidence of belief.evidence) {
        if (!state.suppressions.some((item) => item.sourceId === evidence.sourceId &&
            item.evidenceKey === suppressionKey(belief.origin, evidence))) {
            state.suppressions.push({
                sourceId: evidence.sourceId,
                evidenceKey: suppressionKey(belief.origin, evidence),
            });
        }
    }
    belief.status = "undone";
    if (belief.supersedes) {
        const previous = state.beliefs.find((item) => item.id === belief.supersedes);
        if (previous?.status === "superseded") {
            previous.status = "active";
        }
    }
    state.contentRevision += 1;
    return structuredClone(belief);
}
