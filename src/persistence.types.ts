import type {
  MiniMeBelief,
  MiniMeSnapshot,
} from "./schema/mini-me.js";

export type MiniMeContentSnapshot = Pick<
  MiniMeSnapshot,
  "contentRevision" | "documents" | "sources" | "beliefs" | "predictions" | "outcomes" | "suppressions"
>;

export type MiniMeLearningResult = {
  applied: MiniMeBelief[];
  contentRevision: number;
};

export class MiniMePersistenceError extends Error {
  readonly code: string;

  constructor(
    readonly reason:
      | "conflict"
      | "invalid"
      | "not-found"
  | "limit-reached",
    message: string,
  ) {
    super(message);
    this.name = "MiniMePersistenceError";
    this.code = "MINI_ME_" + reason.toUpperCase().replaceAll("-", "_");
  }
}
