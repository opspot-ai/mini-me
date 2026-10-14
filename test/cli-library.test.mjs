import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { createMiniMeAgentApi } from "../dist/index.js";

const temporaryDirectories = [];
const temp = () => {
  const directory = mkdtempSync(join(tmpdir(), "mini-me-cli-"));
  temporaryDirectories.push(directory);
  return directory;
};
const root = new URL("..", import.meta.url).pathname;
const cli = join(root, "dist", "cli.js");

function runCli(...args) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function jsonCli(...args) {
  return JSON.parse(runCli(...args));
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("portable executable and imported library", () => {
  it("runs owner CLI operations and shares imported profile state through the built library", async () => {
    const directory = temp();
    const databasePath = join(directory, "owner.sqlite");
    const sourcePath = join(directory, "selected.txt");
    const directPath = join(directory, "direct.json");
    const choicePath = join(directory, "choice.json");
    const exportPath = join(directory, "portable-export.json");
    const importedPath = join(directory, "imported.sqlite");
    writeFileSync(sourcePath, "I enjoy quiet workspaces.");
    writeFileSync(directPath, JSON.stringify({
      document: "PREFERENCES.md",
      scope: "workspace sound",
      statement: "Use quiet workspaces.",
      preferred: ["quiet"],
      avoided: ["loud"],
    }));
    writeFileSync(choicePath, JSON.stringify({
      scope: "workspace sound",
      question: "Where should I work?",
      options: [
        { id: "quiet", label: "Quiet room", value: "quiet" },
        { id: "loud", label: "Cafe", value: "loud" },
      ],
    }));

    const initialized = jsonCli("init", "--db", databasePath, "--name", "CLI synthetic profile");
    assert.equal(initialized.profile.name, "CLI synthetic profile");
    const selected = jsonCli(
      "source", "select", "--db", databasePath,
      "--id", "selected-quiet", "--label", "Owner selected note", "--file", sourcePath,
    );
    assert.equal(selected.id, "selected-quiet");
    const direct = jsonCli("learn", "direct", "--db", databasePath, "--file", directPath);
    assert.equal(direct.origin, "direct");
    assert.equal(jsonCli("inspect", "--db", databasePath).documents.length, 6);

    const prediction = jsonCli("predict", "--db", databasePath, "--file", choicePath);
    assert.equal(prediction.optionId, "quiet");
    assert.equal(prediction.authority, "advisory");
    const outcome = jsonCli(
      "outcome", "--db", databasePath,
      "--prediction", prediction.id, "--option", "quiet",
    );
    assert.equal(outcome.origin, "owner");
    assert.equal(outcome.matched, true);
    assert.match(runCli("export", "--db", databasePath, "--out", exportPath), /Exported Mini Me state/u);

    const imported = jsonCli("import", "--db", importedPath, "--in", exportPath);
    assert.equal(imported.profile.id, initialized.profile.id);
    const libraryAgent = createMiniMeAgentApi({ databasePath: importedPath });
    assert.equal(libraryAgent.view().profile.name, "CLI synthetic profile");
    assert.equal(libraryAgent.selectedSources()[0].text, "I enjoy quiet workspaces.");
    const consultation = await libraryAgent.consult({
      scope: "workspace sound",
      question: "Where should I work?",
      options: [
        { id: "quiet", label: "Quiet room", value: "quiet" },
        { id: "loud", label: "Cafe", value: "loud" },
      ],
    }, 10);
    assert.equal(consultation.authority, "advisory");
    assert.equal(consultation.optionId, "quiet");
    const importedOwner = await import("../dist/index.js");
    assert.equal(importedOwner.createMiniMeOwnerApi({ databasePath: importedPath }).inspect().outcomes[0].id, outcome.id);
  });
});
