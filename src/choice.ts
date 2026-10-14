import { Value } from "typebox/value";
import { MiniMeChoiceSchema, type MiniMeChoice } from "./schema/mini-me.js";
import { MINI_ME_LIMITS, normalizeMiniMeValue } from "./learning.js";

/** One semantic choice contract for the MCP, CLI, library, and prediction core. */
export function isValidMiniMeChoice(choice: unknown): choice is MiniMeChoice {
  if (!Value.Check(MiniMeChoiceSchema, choice) || !normalizeMiniMeValue(choice.scope)) {
    return false;
  }
  if (choice.options.length < 2 || choice.options.length > MINI_ME_LIMITS.options) {
    return false;
  }
  const values = choice.options.map((option) => normalizeMiniMeValue(option.value));
  return (
    choice.options.every((option) => option.id !== "abstain") &&
    values.every(Boolean) &&
    new Set(values).size === values.length &&
    new Set(choice.options.map((option) => option.id)).size === values.length
  );
}
