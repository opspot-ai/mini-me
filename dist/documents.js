import { MINI_ME_DOCUMENT_NAMES, } from "./schema/mini-me.js";
import { MINI_ME_LIMITS, miniMeEvidenceRevision } from "./learning.js";
const HEADER = "<!-- mini-me-portable ";
const LEARNED = "\n<!-- mini-me-generated -->\n";
const END = "\n<!-- /mini-me-generated -->\n";
/** Render owner-authored content separately from generated beliefs and decision provenance. */
export function renderMiniMeDocument(profile, document, beliefs, decisions) {
    const learnedBeliefs = beliefs
        .filter((belief) => belief.status === "active" && belief.preference.document === document.name)
        .map((belief) => {
        const evidence = belief.evidence
            .map((entry) => "  - Source " + entry.sourceId + "@" + entry.sourceRevision + ": " +
            JSON.stringify(entry.excerpt))
            .join("\n");
        return "- [" + belief.origin + "; " + belief.preference.scope + "; " + belief.id + "] " +
            JSON.stringify(belief.preference.statement) + (evidence ? "\n" + evidence : "");
    })
        .join("\n");
    const decisionHistory = document.name === "DECISIONS.md" && decisions
        ? decisions.predictions
            .toSorted((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
            .slice(0, 20)
            .toReversed()
            .map((prediction) => {
            const outcomes = decisions.outcomes.filter((outcome) => outcome.predictionId === prediction.id);
            const evidence = prediction.evidence
                .slice(0, 2)
                .map((entry) => "  - Evidence excerpt " + entry.sourceId + "@" + entry.sourceRevision + ": " +
                JSON.stringify(entry.excerpt.slice(0, 240)))
                .join("\n");
            const outcomeText = outcomes.length
                ? outcomes
                    .map((outcome) => "  - Genuine owner decision " + outcome.id + ": " +
                    JSON.stringify(outcome.optionId) + "; " +
                    (outcome.matched ? "matches" : "differs from") +
                    " the frozen prediction" +
                    (outcome.correctionId ? "; correction " + outcome.correctionId : "") + ".")
                    .join("\n")
                : "  - Awaiting a genuine owner decision.";
            return "- Prediction " + prediction.id + ": " +
                JSON.stringify(prediction.choice.question) + "; predicted " +
                JSON.stringify(prediction.optionId) + "; uncertainty " + prediction.uncertainty +
                "; " + prediction.provider + "." + (evidence ? "\n" + evidence : "") +
                "\n" + outcomeText;
        })
            .join("\n")
        : "";
    const generated = [
        learnedBeliefs,
        decisionHistory
            ? "Recent frozen decisions (up to 20; full history is available in Mini Me):\n" +
                decisionHistory
            : "",
    ]
        .filter(Boolean)
        .join("\n\n");
    const header = {
        version: 1,
        miniMeId: profile.id,
        name: document.name,
        revision: document.revision,
        authoredHash: miniMeEvidenceRevision(document.content),
        generatedHash: miniMeEvidenceRevision(generated),
    };
    const output = HEADER + JSON.stringify(header) + " -->\n" + document.content + LEARNED + generated + END;
    if (Buffer.byteLength(output, "utf8") > MINI_ME_LIMITS.documentBytes) {
        throw new Error(document.name + " exceeds its 64 KiB projection limit; narrow learned material");
    }
    return output;
}
export function inspectMiniMeDocument(text, profile, name) {
    if (Buffer.byteLength(text, "utf8") > MINI_ME_LIMITS.documentBytes || !text.startsWith(HEADER)) {
        throw new Error(name + " has no Mini Me revision header; keep the file and review it before importing");
    }
    const boundary = text.indexOf(" -->\n");
    const generatedAt = text.lastIndexOf(LEARNED);
    if (boundary < 0 || generatedAt < boundary || !text.endsWith(END)) {
        throw new Error(name + " has conflicting projection boundaries");
    }
    const header = JSON.parse(text.slice(HEADER.length, boundary));
    const authored = text.slice(boundary + 5, generatedAt);
    const generated = text.slice(generatedAt + LEARNED.length, -END.length);
    if (!header || typeof header !== "object" ||
        header.version !== 1 ||
        header.miniMeId !== profile.id ||
        header.name !== name ||
        !Number.isSafeInteger(header.revision) ||
        header.revision < 0 ||
        header.generatedHash !== miniMeEvidenceRevision(generated)) {
        throw new Error(name + " has changed generated material or belongs to another revision owner");
    }
    const parsed = header;
    return {
        authored,
        revision: parsed.revision,
        authoredChanged: parsed.authoredHash !== miniMeEvidenceRevision(authored),
    };
}
export function renderAllMiniMeDocuments(input) {
    const rendered = {};
    for (const name of MINI_ME_DOCUMENT_NAMES) {
        const document = input.documents.find((item) => item.name === name);
        if (!document) {
            throw new Error("Mini Me document " + name + " is missing");
        }
        rendered[name] = renderMiniMeDocument(input.profile, document, input.beliefs, input);
    }
    return rendered;
}
