import { randomUUID } from "node:crypto";
import type {
  MiniMeDocument,
  MiniMeDocumentName,
  MiniMeOutcome,
  MiniMePrediction,
  MiniMeSnapshot,
} from "./schema/mini-me.js";
import { MINI_ME_DOCUMENT_NAMES } from "./schema/mini-me.js";
import { MINI_ME_LIMITS } from "./learning.js";
import { isValidMiniMeChoice } from "./choice.js";
import { miniMeOperationFingerprint } from "./fingerprint.js";
import { MiniMePersistenceError } from "./persistence.types.js";

export function reviseDocument(
  state: MiniMeSnapshot,
  input: { name: MiniMeDocumentName; expectedRevision: number; content: string; now: number },
): MiniMeDocument {
  if (!MINI_ME_DOCUMENT_NAMES.includes(input.name)) {
    throw new MiniMePersistenceError("invalid", "Unknown Mini Me document");
  }
  if (Buffer.byteLength(input.content, "utf8") > MINI_ME_LIMITS.documentBytes) {
    throw new MiniMePersistenceError("limit-reached", "Mini Me document byte limit is reached");
  }
  const prior = state.documents.find((document) => document.name === input.name);
  if (!prior || prior.revision !== input.expectedRevision) {
    throw new MiniMePersistenceError("conflict", "Document changed; inspect its current revision");
  }
  const document: MiniMeDocument = {
    name: input.name,
    content: input.content,
    revision: prior.revision + 1,
    updatedAt: input.now,
  };
  state.documents = state.documents.map((item) => (item.name === input.name ? document : item));
  state.contentRevision += 1;
  return structuredClone(document);
}

function evidenceExists(state: MiniMeSnapshot, prediction: MiniMePrediction): boolean {
  return prediction.evidence.every((evidence) => {
    const source = state.sources.find((item) => item.id === evidence.sourceId);
    if (source) {
      return source.revisions.some(
        (revision) =>
          revision.revision === evidence.sourceRevision && revision.text.includes(evidence.excerpt),
      );
    }
    return evidence.sourceId.startsWith("owner:") && /^[a-f0-9]{64}$/.test(evidence.sourceRevision);
  });
}

/** Freeze only a current, schema-valid, advisory prediction grounded in active evidence. */
export function freezePrediction(state: MiniMeSnapshot, prediction: MiniMePrediction): null {
  if (
    prediction.authority !== "advisory" ||
    prediction.profileGeneration !== state.profile?.generation ||
    prediction.contentRevision !== state.contentRevision ||
    !isValidMiniMeChoice(prediction.choice) ||
    (prediction.optionId !== null && !prediction.choice.options.some((option) => option.id === prediction.optionId)) ||
    !evidenceExists(state, prediction) ||
    prediction.beliefIds.some(
      (beliefId) => !state.beliefs.some((belief) => belief.id === beliefId && belief.status === "active"),
    )
  ) {
    throw new MiniMePersistenceError("invalid", "Prediction is not grounded in the current advisory snapshot");
  }
  const prior = state.predictions.find((item) => item.id === prediction.id);
  if (prior) {
    if (miniMeOperationFingerprint(prior) !== miniMeOperationFingerprint(prediction)) {
      throw new MiniMePersistenceError("conflict", "Frozen prediction cannot be changed");
    }
    return null;
  }
  state.predictions.push(structuredClone(prediction));
  state.contentRevision += 1;
  return null;
}

/** Append a genuine owner outcome after validating it against the frozen choice. */
export function appendOutcome(state: MiniMeSnapshot, outcome: MiniMeOutcome): MiniMeOutcome {
  const prediction = state.predictions.find((item) => item.id === outcome.predictionId);
  if (!prediction) {
    throw new MiniMePersistenceError("not-found", "Frozen prediction is unavailable");
  }
  if (
    outcome.origin !== "owner" ||
    outcome.createdAt <= prediction.createdAt ||
    !prediction.choice.options.some((option) => option.id === outcome.optionId) ||
    outcome.matched !== (prediction.optionId === outcome.optionId)
  ) {
    throw new MiniMePersistenceError("invalid", "Outcome does not match the frozen choice");
  }
  const prior = state.outcomes.find((item) => item.predictionId === outcome.predictionId);
  if (prior) {
    if (miniMeOperationFingerprint(prior) !== miniMeOperationFingerprint(outcome)) {
      throw new MiniMePersistenceError("conflict", "Decision outcome is already recorded");
    }
    return structuredClone(prior);
  }
  state.outcomes.push(structuredClone(outcome));
  return structuredClone(outcome);
}

export function newPredictionId(): string {
  return randomUUID();
}
