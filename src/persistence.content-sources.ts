import { randomUUID } from "node:crypto";
import type { MiniMeSelectedSource, MiniMeSnapshot } from "./schema/mini-me.js";
import { MINI_ME_LIMITS, miniMeEvidenceRevision } from "./learning.js";
import { MiniMePersistenceError } from "./persistence.types.js";

export function addContentSource(
  state: MiniMeSnapshot,
  input: { id: string; label: string; text: string; now: number },
): MiniMeSelectedSource {
  if (state.sources.some((source) => source.id === input.id)) {
    throw new MiniMePersistenceError("conflict", "Source ID is already selected");
  }
  if (state.sources.length >= MINI_ME_LIMITS.sources) {
    throw new MiniMePersistenceError("limit-reached", "Mini Me selected source limit is reached");
  }
  if (Buffer.byteLength(input.text, "utf8") > MINI_ME_LIMITS.inferenceBytes || !input.text.trim()) {
    throw new MiniMePersistenceError("limit-reached", "Selected source is empty or exceeds the 32 KiB limit");
  }
  const revision = miniMeEvidenceRevision(input.text);
  const source: MiniMeSelectedSource = {
    id: input.id,
    label: input.label,
    currentRevision: revision,
    revisions: [{ revision, text: input.text, createdAt: input.now }],
    createdAt: input.now,
  };
  state.sources.push(source);
  state.contentRevision += 1;
  return structuredClone(source);
}

export function appendContentSourceRevision(
  state: MiniMeSnapshot,
  input: { sourceId: string; expectedRevision: string; text: string; now: number },
): MiniMeSelectedSource {
  const source = state.sources.find((item) => item.id === input.sourceId);
  if (!source) {
    throw new MiniMePersistenceError("not-found", "Selected source is unavailable");
  }
  if (source.currentRevision !== input.expectedRevision) {
    throw new MiniMePersistenceError("conflict", "Selected source changed; inspect it before revising");
  }
  if (Buffer.byteLength(input.text, "utf8") > MINI_ME_LIMITS.inferenceBytes || !input.text.trim()) {
    throw new MiniMePersistenceError("limit-reached", "Selected source is empty or exceeds the 32 KiB limit");
  }
  const revision = miniMeEvidenceRevision(input.text);
  if (revision === source.currentRevision) {
    return structuredClone(source);
  }
  if (source.revisions.length >= 64) {
    throw new MiniMePersistenceError("limit-reached", "Selected source revision history is full");
  }
  source.revisions.push({ revision, text: input.text, createdAt: input.now });
  source.currentRevision = revision;
  state.contentRevision += 1;
  return structuredClone(source);
}

/** Withdrawal atomically removes source text, derived beliefs, predictions, outcomes and suppressions. */
export function removeContentSource(state: MiniMeSnapshot, sourceId: string): number {
  const source = state.sources.find((item) => item.id === sourceId);
  if (!source) {
    throw new MiniMePersistenceError("not-found", "Selected source is unavailable");
  }
  const removedBeliefIds = new Set(
    state.beliefs
      .filter((belief) => belief.evidence.some((entry) => entry.sourceId === sourceId))
      .map((belief) => belief.id),
  );
  state.beliefs = state.beliefs
    .filter((belief) => !removedBeliefIds.has(belief.id))
    .map((belief) =>
      belief.supersedes && removedBeliefIds.has(belief.supersedes)
        ? { ...belief, supersedes: null }
        : belief,
    );
  const removedPredictionIds = new Set(
    state.predictions
      .filter((prediction) => prediction.evidence.some((entry) => entry.sourceId === sourceId))
      .map((prediction) => prediction.id),
  );
  state.predictions = state.predictions.filter((prediction) => !removedPredictionIds.has(prediction.id));
  state.outcomes = state.outcomes
    .filter((outcome) => !removedPredictionIds.has(outcome.predictionId))
    .map((outcome) =>
      outcome.correctionId && removedBeliefIds.has(outcome.correctionId)
        ? { ...outcome, correctionId: null }
        : outcome,
    );
  state.suppressions = state.suppressions.filter((item) => item.sourceId !== sourceId);
  state.sources = state.sources.filter((item) => item.id !== sourceId);
  state.contentRevision += 1;
  return (
    state.sources.length + state.beliefs.length + state.predictions.length +
    state.outcomes.length + state.suppressions.length
  );
}

export function newSourceId(): string {
  return randomUUID();
}
