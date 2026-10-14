import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidMiniMeChoice } from "../dist/choice.js";
import {
  applyMiniMeDecisionOutcome,
  buildMiniMeDecisionBatch,
  predictMiniMeBaseline,
} from "../dist/prediction.js";

const choice = {
  scope: "editor theme",
  question: "Which theme?",
  options: [
    { id: "a", label: "Light", value: "light" },
    { id: "b", label: "Dark", value: "dark" },
  ],
};

function belief(id, value, origin = "direct") {
  return {
    id,
    origin,
    status: "active",
    supersedes: null,
    createdAt: 1,
    preference: {
      document: "PREFERENCES.md",
      scope: "editor theme",
      statement: "Prefer " + value + ".",
      preferred: [value],
      avoided: [],
    },
    evidence: [{ sourceId: "owner:test", sourceRevision: "a".repeat(64), excerpt: "Prefer " + value + "." }],
  };
}

const input = (beliefs) => ({
  id: "prediction",
  agentId: null,
  choice,
  beliefs,
  profileGeneration: 1,
  contentRevision: 1,
  now: 2,
});

describe("Mini Me grounded choice", () => {
  // Adapted from prediction.test.ts:50, :93, :125, and :137; no Gateway/provider service is needed.
  it("uses a scoped correction over repeated inference while preserving a prior prediction", () => {
    const direct = belief("first", "light");
    const frozen = predictMiniMeBaseline(input([direct]));
    const correction = { ...belief("correction", "dark", "correction"), createdAt: 3 };
    const next = predictMiniMeBaseline(
      input([direct, correction, belief("inferred", "light", "inferred")]),
    );
    assert.equal(frozen.optionId, "a");
    assert.deepEqual(
      {
        optionId: next.optionId,
        correctionApplied: next.correctionApplied,
        authority: next.authority,
        uncertainty: next.uncertainty,
        beliefIds: next.beliefIds,
      },
      {
        optionId: "b",
        correctionApplied: true,
        authority: "advisory",
        uncertainty: "low",
        beliefIds: ["correction"],
      },
    );
    assert.deepEqual(next.evidence, [
      { sourceId: "owner:test", sourceRevision: "a".repeat(64), excerpt: "Prefer dark." },
    ]);
    correction.preference.preferred[0] = "light";
    correction.evidence[0].excerpt = "Changed after prediction";
    assert.equal(next.evidence[0].excerpt, "Prefer dark.");
    assert.equal(frozen.optionId, "a");
    assert.equal(frozen.authority, "advisory");
  });

  for (const [name, beliefs] of [
    ["no evidence", []],
    ["conflicting direct preferences", [belief("a", "light"), belief("b", "dark")]],
    ["undone evidence", [{ ...belief("a", "light"), status: "undone" }]],
    ["superseded evidence", [{ ...belief("a", "light"), status: "superseded" }]],
  ]) {
    it("abstains for " + name, () => {
      const result = predictMiniMeBaseline(input(beliefs));
      assert.equal(result.optionId, null);
      assert.equal(result.uncertainty, "high");
      assert.equal(result.authority, "advisory");
    });
  }

  it("labels inferred choices and never treats provider confidence as correctness", () => {
    const state = input([belief("inferred", "light", "inferred")]);
    assert.equal(predictMiniMeBaseline(state).uncertainty, "medium");
    const batch = buildMiniMeDecisionBatch(state);
    assert.ok(batch);
    const result = applyMiniMeDecisionOutcome(state, {
      status: "ok",
      result: {
        model: "example/decision",
        answers: { preference: { type: "choice", choice: "b" } },
      },
      provenance: { runtimeGeneration: "provider-generation" },
    });
    assert.equal(result.optionId, "b");
    assert.equal(result.uncertainty, "medium");
    assert.equal(result.authority, "advisory");
    assert.equal(result.providerRuntimeGeneration, "provider-generation");
    assert.deepEqual(result.evidence, state.beliefs[0].evidence);
    assert.match(result.explanation, /not measured prediction accuracy/u);
  });

  it("does not send contradictory or corrected evidence for model reinterpretation", () => {
    assert.equal(buildMiniMeDecisionBatch(input([belief("a", "light"), belief("b", "dark")])), undefined);
    const corrected = input([belief("a", "dark", "correction")]);
    assert.equal(buildMiniMeDecisionBatch(corrected), undefined);
    assert.equal(
      applyMiniMeDecisionOutcome(corrected, { status: "unavailable", reason: "not-configured" }).optionId,
      "b",
    );
  });

  it("rejects ambiguous option identities instead of scoring an unrepresentable choice", () => {
    assert.throws(() =>
      predictMiniMeBaseline({
        ...input([]),
        choice: { ...choice, options: [choice.options[0], choice.options[0]] },
      }),
      /distinct/u,
    );
  });

  it("enforces the two-to-eight distinct choice bounds", () => {
    assert.equal(isValidMiniMeChoice({ ...choice, options: [choice.options[0]] }), false);
    assert.equal(isValidMiniMeChoice({ ...choice, options: Array.from({ length: 9 }, (_, i) => ({
      id: "option-" + i,
      label: "Option " + i,
      value: "value-" + i,
    })) }), false);
    assert.equal(isValidMiniMeChoice({ ...choice, options: [choice.options[0], { ...choice.options[1], id: choice.options[0].id }] }), false);
    assert.equal(isValidMiniMeChoice({ ...choice, options: [choice.options[0], { ...choice.options[1], value: choice.options[0].value }] }), false);
  });
});
