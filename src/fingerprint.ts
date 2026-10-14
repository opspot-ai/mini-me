import { createHash } from "node:crypto";

export function miniMeOperationFingerprint(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(normalize);
    }
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input)
          .filter(([, item]) => item !== undefined)
          .toSorted(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, normalize(item)]),
      );
    }
    return input;
  };
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
}
