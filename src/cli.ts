#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { createMiniMeOwnerApi } from "./store.js";
import type { MiniMeChoice, MiniMeDocumentName, MiniMePreference } from "./schema/mini-me.js";

const help = `Mini Me local owner CLI

Every command uses exactly one SQLite file. Supply --db /absolute/path or set MINI_ME_DB_PATH.

  mini-me init --db PATH --name NAME
  mini-me inspect --db PATH
  mini-me source select --db PATH --id ID --label LABEL --file FILE
  mini-me source revise --db PATH --id ID --expected-revision HASH --file FILE
  mini-me source list --db PATH
  mini-me source remove --db PATH --id ID
  mini-me learn direct --db PATH --file preference.json
  mini-me learn correct --db PATH --file preference.json
  mini-me undo --db PATH --belief ID
  mini-me doc set --db PATH --name FILE.md --expected-revision N --file CONTENT.md
  mini-me doc render --db PATH --name FILE.md
  mini-me predict --db PATH --file choice.json
  mini-me outcome --db PATH --prediction ID --option ID [--correction-file preference.json]
  mini-me export --db PATH --out export.json
  mini-me import --db PATH --in export.json [--replace-revision N]
`;

function flags(args: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!flag?.startsWith("--")) {
      throw new Error("Expected a --flag, received " + String(flag));
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for " + flag);
    }
    result.set(flag.slice(2), value);
    index += 1;
  }
  return result;
}

function required(values: Map<string, string>, name: string): string {
  const value = values.get(name);
  if (!value) {
    throw new Error("Required option --" + name + " is missing");
  }
  return value;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function print(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

async function run(): Promise<void> {
  const [command, subcommand, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "help") {
    process.stdout.write(help);
    return;
  }
  const values = flags(command === "source" || command === "learn" || command === "doc" ? rest : [subcommand, ...rest].filter((item): item is string => Boolean(item)));
  const databasePath = values.get("db") ?? process.env.MINI_ME_DB_PATH;
  if (!databasePath) {
    throw new Error("Set --db to an absolute SQLite file path or set MINI_ME_DB_PATH explicitly");
  }
  const owner = createMiniMeOwnerApi({ databasePath });

  if (command === "init") {
    const parsed = flags([subcommand, ...rest].filter((item): item is string => Boolean(item)));
    const initPath = parsed.get("db") ?? process.env.MINI_ME_DB_PATH;
    if (!initPath) {
      throw new Error("Set --db to an absolute SQLite file path or set MINI_ME_DB_PATH explicitly");
    }
    print(createMiniMeOwnerApi({ databasePath: initPath }).init(required(parsed, "name")));
    return;
  }
  if (command === "inspect") {
    print(owner.inspect());
    return;
  }
  if (command === "source" && subcommand === "select") {
    const text = readFileSync(required(values, "file"), "utf8");
    print(owner.selectSource({ id: required(values, "id"), label: required(values, "label"), text }));
    return;
  }
  if (command === "source" && subcommand === "revise") {
    const text = readFileSync(required(values, "file"), "utf8");
    print(owner.reviseSource({
      sourceId: required(values, "id"),
      expectedRevision: required(values, "expected-revision"),
      text,
    }));
    return;
  }
  if (command === "source" && subcommand === "list") {
    print(owner.inspect().sources.map((source) => ({
      id: source.id,
      label: source.label,
      currentRevision: source.currentRevision,
      revisions: source.revisions.length,
    })));
    return;
  }
  if (command === "source" && subcommand === "remove") {
    print({ removed: required(values, "id"), retainedRecords: owner.removeSource(required(values, "id")) });
    return;
  }
  if (command === "learn" && (subcommand === "direct" || subcommand === "correct")) {
    const preference = readJson(required(values, "file")) as MiniMePreference;
    print(subcommand === "direct" ? owner.learnDirect(preference) : owner.correct(preference));
    return;
  }
  if (command === "undo") {
    print(owner.undo(required(values, "belief")));
    return;
  }
  if (command === "doc" && subcommand === "set") {
    print(owner.setDocument({
      name: required(values, "name") as MiniMeDocumentName,
      content: readFileSync(required(values, "file"), "utf8"),
      expectedRevision: Number(required(values, "expected-revision")),
    }));
    return;
  }
  if (command === "doc" && subcommand === "render") {
    process.stdout.write(owner.renderDocument(required(values, "name") as MiniMeDocumentName));
    return;
  }
  if (command === "predict") {
    print(await owner.predict(readJson(required(values, "file")) as MiniMeChoice));
    return;
  }
  if (command === "outcome") {
    const correctionFile = values.get("correction-file");
    print(owner.recordOutcome({
      predictionId: required(values, "prediction"),
      optionId: required(values, "option"),
      ...(correctionFile ? { correction: readJson(correctionFile) as MiniMePreference } : {}),
    }));
    return;
  }
  if (command === "export") {
    const path = required(values, "out");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(owner.exportState(), null, 2) + "\n", { flag: "wx", mode: 0o600 });
    process.stdout.write("Exported Mini Me state to " + basename(path) + "\n");
    return;
  }
  if (command === "import") {
    const expected = values.get("replace-revision");
    print(owner.importState(readJson(required(values, "in")), {
      ...(expected === undefined ? {} : { expectedRevision: Number(expected) }),
    }));
    return;
  }
  throw new Error("Unknown Mini Me command. Run mini-me --help.");
}

run().catch((error: unknown) => {
  console.error("Mini Me:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
