import { Compile } from "typebox/compile";
import {
  MiniMePreferenceSchema,
  type MiniMePreference,
} from "./schema/mini-me.js";
import { normalizeMiniMeValue } from "./learning.js";
import { miniMeOperationFingerprint } from "./fingerprint.js";

const preference = Compile(MiniMePreferenceSchema);

/** Typed correction blocks are explicit; ordinary prose never rewrites frozen history. */
export function miniMeDocumentCorrections(content: string): MiniMePreference[] {
  const entries: MiniMePreference[] = [];
  const scopes = new Set<string>();
  const openings = [...content.matchAll(/^```mini-me-correction[^\n]*$/gm)].length;
  for (const match of content.matchAll(/^```mini-me-correction\s*\n([\s\S]*?)^```\s*$/gm)) {
    const value: unknown = JSON.parse(match[1] ?? "");
    if (!preference.Check(value)) {
      throw new Error("Each mini-me-correction block must contain a valid personal preference");
    }
    const scope = normalizeMiniMeValue(value.scope);
    if (scopes.has(scope) || entries.length >= 16) {
      throw new Error("Use at most sixteen correction blocks with distinct topics");
    }
    scopes.add(scope);
    entries.push(value);
  }
  if (entries.length !== openings) {
    throw new Error("Close each mini-me-correction block with a line containing three backticks");
  }
  return entries;
}

export function newMiniMeDocumentCorrections(previous: string, next: string): MiniMePreference[] {
  const existing = new Set(miniMeDocumentCorrections(previous).map(miniMeOperationFingerprint));
  return miniMeDocumentCorrections(next).filter(
    (entry) => !existing.has(miniMeOperationFingerprint(entry)),
  );
}
