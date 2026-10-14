import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { createMiniMeAgentApi, createMiniMeOwnerApi, MINI_ME_DOCUMENT_NAMES } from "../dist/index.js";

const temporaryDirectories = [];
const temp = () => {
  const directory = mkdtempSync(join(tmpdir(), "mini-me-persistence-"));
  temporaryDirectories.push(directory);
  return directory;
};
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const themeChoice = {
  scope: "editor theme",
  question: "Which theme?",
  options: [
    { id: "light", label: "Light", value: "light" },
    { id: "dark", label: "Dark", value: "dark" },
  ],
};

const preference = (document, scope, statement, preferred, avoided = []) => ({
  document,
  scope,
  statement,
  preferred,
  avoided,
});

function extraction(text, pref, excerpt) {
  const start = text.indexOf(excerpt);
  assert.notEqual(start, -1);
  return JSON.stringify({
    preferences: [{ preference: pref, start, end: start + excerpt.length }],
  });
}

describe("Mini Me persistence contracts adapted from OpenClaw", () => {
  // Portable assertions adapted from service.test.ts:432, persistence.test.ts:285, :313, :363,
  // settled-source.test.ts:174, and sources.test.ts:381. Host receipt/session state was replaced
  // with explicit owner source selection, the canonical SQLite ledger, and ordinary local callers.
  it("keeps six authored documents, expected revisions, and typed-only corrections", async () => {
    const databasePath = join(temp(), "owner.sqlite");
    const owner = createMiniMeOwnerApi({ databasePath });
    owner.init("Ada", 1);
    assert.deepEqual(owner.inspect().documents.map((document) => document.name), MINI_ME_DOCUMENT_NAMES);

    const correction = preference("PREFERENCES.md", "editor theme", "Use dark editor themes.", ["dark"]);
    const correctionBlock = "```";
    const authored = "Owner-authored prose.\n\n" + correctionBlock + "mini-me-correction\n" +
      JSON.stringify(correction) + "\n" + correctionBlock + "\n";
    const saved = owner.setDocument({
      name: "PREFERENCES.md",
      content: authored,
      expectedRevision: 0,
      now: 2,
    });
    assert.equal(saved.revision, 1);
    const correctionBelief = owner.inspect().beliefs[0];
    assert.equal(correctionBelief.origin, "correction");
    assert.equal(correctionBelief.status, "active");

    const prediction = await owner.predict(themeChoice, 3);
    assert.equal(prediction.optionId, "dark");
    const frozenBeforeEdit = structuredClone(owner.inspect().predictions[0]);
    const edited = owner.setDocument({
      name: "PREFERENCES.md",
      content: "Owner-authored prose changed.\n\n" + correctionBlock + "mini-me-correction\n" +
        JSON.stringify(correction) + "\n" + correctionBlock + "\n",
      expectedRevision: 1,
      now: 4,
    });
    assert.equal(edited.revision, 2);
    assert.equal(owner.inspect().beliefs.length, 1);
    assert.equal(owner.inspect().beliefs[0].id, correctionBelief.id);
    assert.deepEqual(owner.inspect().predictions[0], frozenBeforeEdit);
    assert.throws(
      () => owner.setDocument({ name: "PREFERENCES.md", content: "stale", expectedRevision: 1 }),
      /changed/u,
    );

    const rendered = owner.renderDocument("PREFERENCES.md");
    const projection = owner.inspectProjection("PREFERENCES.md", rendered);
    assert.equal(projection.authored, "Owner-authored prose changed.\n\n" +
      correctionBlock + "mini-me-correction\n" + JSON.stringify(correction) + "\n" +
      correctionBlock + "\n");
    assert.equal(projection.authoredChanged, false);
    assert.match(rendered, /mini-me-generated/u);
    assert.match(rendered, /Use dark editor themes\./u);
  });

  it("preserves direct and latest correction precedence, immutable predictions, and explicit owner outcomes", async () => {
    const databasePath = join(temp(), "precedence.sqlite");
    const owner = createMiniMeOwnerApi({ databasePath });
    const agent = createMiniMeAgentApi({ databasePath });
    owner.init("Ada", 1);
    owner.learnDirect(preference("PREFERENCES.md", "editor theme", "Use light.", ["light"]), 2);
    const selected = "I prefer dark themes.";
    owner.selectSource({ id: "theme", label: "Theme notes", text: selected, now: 3 });
    agent.infer(
      "theme",
      extraction(selected, preference("PREFERENCES.md", "editor theme", "Prefers dark.", ["dark"]), selected),
      4,
    );
    assert.equal((await owner.predict(themeChoice, 5)).optionId, "light");

    const firstCorrection = owner.correct(
      preference("PREFERENCES.md", "editor theme", "Correction: use dark.", ["dark"]),
      6,
    );
    const frozen = await owner.predict(themeChoice, 7);
    assert.equal(frozen.optionId, "dark");
    assert.equal(frozen.authority, "advisory");

    const latestCorrection = owner.correct(
      preference("PREFERENCES.md", "editor theme", "Correction: use light.", ["light"]),
      8,
    );
    assert.equal(latestCorrection.supersedes, firstCorrection.id);
    assert.equal((await owner.predict(themeChoice, 9)).optionId, "light");
    assert.deepEqual(
      owner.inspect().predictions.find((prediction) => prediction.id === frozen.id),
      frozen,
    );

    const outcome = owner.recordOutcome({
      predictionId: frozen.id,
      optionId: "light",
      now: 10,
    });
    assert.equal(outcome.matched, false);
    assert.equal(outcome.origin, "owner");
    assert.equal(owner.recordOutcome({ predictionId: frozen.id, optionId: "light", now: 11 }).id, outcome.id);
    assert.throws(
      () => owner.recordOutcome({ predictionId: frozen.id, optionId: "dark", now: 12 }),
      /conflicting actual outcome/u,
    );
    assert.deepEqual(
      owner.inspect().predictions.find((prediction) => prediction.id === frozen.id),
      frozen,
    );
    const decisions = owner.renderDocument("DECISIONS.md");
    assert.match(decisions, /Genuine owner decision/u);
    assert.match(decisions, /differs from the frozen prediction/u);
    assert.doesNotMatch(decisions, /accuracy: 100%/u);
  });

  it("keeps inferred undo suppressed through normalized source revision append and unrelated source selection", () => {
    const databasePath = join(temp(), "suppression.sqlite");
    const owner = createMiniMeOwnerApi({ databasePath });
    const agent = createMiniMeAgentApi({ databasePath });
    owner.init("Ada", 1);
    const original = "I like blue themes.";
    const source = owner.selectSource({ id: "theme-source", label: "Theme source", text: original, now: 2 });
    const originalBelief = agent.infer(
      source.id,
      extraction(original, preference("TASTE.md", "editor theme", "Prefers blue themes.", ["blue"]), original),
      3,
    )[0];
    assert.ok(originalBelief);
    owner.undo(originalBelief.id);

    const revisedText = "I like BLUE themes. Also, a new unrelated note.";
    const revised = owner.reviseSource({
      sourceId: source.id,
      expectedRevision: source.currentRevision,
      text: revisedText,
      now: 4,
    });
    assert.notEqual(revised.currentRevision, source.currentRevision);
    const changedInterpretation = preference(
      "TASTE.md",
      "editor theme",
      "Leans toward blue as the visual theme.",
      ["blue"],
    );
    assert.deepEqual(
      agent.infer(
        source.id,
        extraction(revisedText, changedInterpretation, "I like BLUE themes."),
        5,
      ),
      [],
    );
    owner.selectSource({ id: "neighbor-source", label: "Neighbor", text: "I like quiet rooms.", now: 6 });
    assert.deepEqual(
      agent.infer(
        source.id,
        extraction(revisedText, changedInterpretation, "I like BLUE themes."),
        7,
      ),
      [],
    );
    const current = owner.inspect();
    assert.equal(current.beliefs.find((belief) => belief.id === originalBelief.id)?.status, "undone");
    assert.equal(current.suppressions.some((item) => item.sourceId === source.id), true);
    assert.equal(current.sources.length, 2);
  });

  it("withdraws one source and all derived excerpts, predictions, and outcomes across reopen", async () => {
    const databasePath = join(temp(), "withdrawal.sqlite");
    const owner = createMiniMeOwnerApi({ databasePath });
    const agent = createMiniMeAgentApi({ databasePath });
    owner.init("Ada", 1);
    const redText = "I prefer red editor themes.";
    const neighborText = "I prefer quiet rooms.";
    owner.selectSource({ id: "red-source", label: "Red preference", text: redText, now: 2 });
    owner.selectSource({ id: "neighbor-source", label: "Room preference", text: neighborText, now: 3 });
    const redBelief = agent.infer(
      "red-source",
      extraction(redText, preference("PREFERENCES.md", "editor theme", "Prefers red themes.", ["red"]), redText),
      4,
    )[0];
    const neighborBelief = agent.infer(
      "neighbor-source",
      extraction(neighborText, preference("PREFERENCES.md", "room sound", "Prefers quiet rooms.", ["quiet"]), neighborText),
      5,
    )[0];
    assert.ok(redBelief && neighborBelief);
    const themeChoice = {
      scope: "editor theme",
      question: "Which color?",
      options: [
        { id: "red", label: "Red", value: "red" },
        { id: "blue", label: "Blue", value: "blue" },
      ],
    };
    const prediction = await owner.predict(themeChoice, 6);
    const outcome = owner.recordOutcome({ predictionId: prediction.id, optionId: "blue", now: 7 });
    assert.equal(outcome.matched, false);
    owner.undo(neighborBelief.id);
    assert.equal(JSON.stringify(owner.exportState()).includes(redText), true);

    owner.removeSource("red-source");
    const reopenedOwner = createMiniMeOwnerApi({ databasePath });
    const state = reopenedOwner.inspect();
    assert.deepEqual(state.sources.map((source) => source.id), ["neighbor-source"]);
    assert.equal(state.beliefs.some((belief) => belief.id === redBelief.id), false);
    assert.equal(state.beliefs.find((belief) => belief.id === neighborBelief.id)?.status, "undone");
    assert.equal(state.predictions.some((item) => item.id === prediction.id), false);
    assert.equal(state.outcomes.some((item) => item.id === outcome.id), false);
    assert.equal(JSON.stringify(reopenedOwner.exportState()).includes(redText), false);
    assert.equal(reopenedOwner.renderDocument("DECISIONS.md").includes(redText), false);
    assert.equal(reopenedOwner.renderDocument("PREFERENCES.md").includes(redText), false);
    assert.equal(state.suppressions.some((item) => item.sourceId === "neighbor-source"), true);
  });

  it("round-trips IDs, correction precedence, suppression, and frozen ledgers; rejects tampered or conflicting imports", async () => {
    const firstDirectory = temp();
    const sourcePath = join(firstDirectory, "source.sqlite");
    const owner = createMiniMeOwnerApi({ databasePath: sourcePath });
    const agent = createMiniMeAgentApi({ databasePath: sourcePath });
    owner.init("Ada", 1);
    const text = "I like a quiet workspace.";
    owner.selectSource({ id: "quiet-source", label: "Quiet notes", text, now: 2 });
    const inferred = agent.infer(
      "quiet-source",
      extraction(text, preference("PREFERENCES.md", "workspace sound", "Prefers quiet.", ["quiet"]), text),
      3,
    )[0];
    owner.undo(inferred.id);
    owner.learnDirect(preference("PREFERENCES.md", "editor theme", "Use light.", ["light"]), 4);
    owner.correct(preference("PREFERENCES.md", "editor theme", "Use dark.", ["dark"]), 5);
    const prediction = await owner.predict(themeChoice, 6);
    const outcome = owner.recordOutcome({ predictionId: prediction.id, optionId: "dark", now: 7 });
    const bundle = owner.exportState(8);
    assert.equal(bundle.format, "mini-me-portable-v1");

    const importedPath = join(temp(), "imported.sqlite");
    const importer = createMiniMeOwnerApi({ databasePath: importedPath });
    importer.importState(bundle, { now: 9 });
    const imported = importer.inspect();
    assert.equal(imported.profile.id, owner.inspect().profile.id);
    assert.equal(imported.profile.name, "Ada");
    assert.equal(imported.beliefs.find((item) => item.id === inferred.id)?.status, "undone");
    assert.equal(imported.predictions.find((item) => item.id === prediction.id).id, prediction.id);
    assert.equal(imported.outcomes.find((item) => item.id === outcome.id).id, outcome.id);
    assert.equal(imported.suppressions.some((item) => item.sourceId === "quiet-source"), true);

    const tamperedPath = join(temp(), "tampered.sqlite");
    const tamperedOwner = createMiniMeOwnerApi({ databasePath: tamperedPath });
    const tampered = structuredClone(bundle);
    tampered.snapshot.profile.name = "Changed without checksum";
    assert.throws(() => tamperedOwner.importState(tampered), /checksum/u);
    const currentRevision = importer.inspect().profile.revision;
    assert.throws(
      () => importer.importState(bundle, { expectedRevision: currentRevision - 1 }),
      /expectedRevision/u,
    );
    importer.importState(bundle, { expectedRevision: currentRevision, now: 10 });
    assert.equal(importer.inspect().profile.id, owner.inspect().profile.id);
  });
});
