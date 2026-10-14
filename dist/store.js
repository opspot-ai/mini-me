import { randomUUID } from "node:crypto";
import { constants, closeSync, fchmodSync, fstatSync, lstatSync, mkdirSync, openSync, realpathSync, statSync, } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { Compile } from "typebox/compile";
import { MINI_ME_DOCUMENT_NAMES, MiniMeExportSchema, MiniMeSnapshotSchema, } from "./schema/mini-me.js";
import { MINI_ME_LIMITS, miniMeEvidenceRevision, parseMiniMeExtraction } from "./learning.js";
import { newMiniMeDocumentCorrections } from "./document-corrections.js";
import { renderMiniMeDocument, renderAllMiniMeDocuments, inspectMiniMeDocument } from "./documents.js";
import { applyMiniMeDecisionOutcome, buildMiniMeDecisionBatch, predictMiniMeBaseline, } from "./prediction.js";
import { miniMeOperationFingerprint } from "./fingerprint.js";
import { learnBeliefBatch, undoBelief } from "./persistence.content-learning.js";
import { addContentSource, appendContentSourceRevision, removeContentSource, } from "./persistence.content-sources.js";
import { appendOutcome, freezePrediction, newPredictionId, reviseDocument, } from "./persistence.content-records.js";
import { readContentSnapshot } from "./persistence.content-read.js";
import { MiniMePersistenceError } from "./persistence.types.js";
const snapshotValidator = Compile(MiniMeSnapshotSchema);
const exportValidator = Compile(MiniMeExportSchema);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const createBlankSnapshot = () => ({
    profile: null,
    contentRevision: 0,
    documents: [],
    sources: [],
    beliefs: [],
    predictions: [],
    outcomes: [],
    suppressions: [],
});
function isInside(parent, target) {
    const child = relative(parent, target);
    return child === "" || (child !== ".." && !child.startsWith(".." + sep) && !isAbsolute(child));
}
function checkedDatabasePath(databasePath) {
    if (!isAbsolute(databasePath) || databasePath === ":memory:") {
        throw new MiniMePersistenceError("invalid", "Use an absolute SQLite file path outside the installed package");
    }
    const path = resolve(databasePath);
    if (isInside(packageRoot, path)) {
        throw new MiniMePersistenceError("invalid", "Mini Me data must live outside the installed package");
    }
    return path;
}
function isErrno(error, code) {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
function canonicalDatabasePath(databasePath) {
    const path = checkedDatabasePath(databasePath);
    const actualPath = resolve(realpathSync(dirname(path)), basename(path));
    if (isInside(packageRoot, actualPath)) {
        throw new MiniMePersistenceError("invalid", "Mini Me data must live outside the installed package");
    }
    return actualPath;
}
function checkPrivateDirectory(path) {
    const directory = statSync(path);
    const userId = typeof process.getuid === "function" ? process.getuid() : undefined;
    if (!directory.isDirectory() ||
        (directory.mode & 0o077) !== 0 ||
        (userId !== undefined && directory.uid !== userId)) {
        throw new MiniMePersistenceError("invalid", "Selected Mini Me data directory must be owned by this user and private (mode 0700); choose a private directory");
    }
}
function secureOwnerOnlyFile(path, create) {
    let exists = true;
    try {
        const entry = lstatSync(path);
        if (entry.isSymbolicLink() || !entry.isFile()) {
            throw new MiniMePersistenceError("invalid", "Mini Me database and SQLite sidecars must be regular files, not symbolic links");
        }
    }
    catch (error) {
        if (!isErrno(error, "ENOENT")) {
            throw error;
        }
        exists = false;
    }
    if (!exists && !create) {
        return;
    }
    const flags = constants.O_RDWR | constants.O_NOFOLLOW;
    let descriptor;
    if (exists) {
        descriptor = openSync(path, flags);
    }
    else {
        try {
            descriptor = openSync(path, flags | constants.O_CREAT | constants.O_EXCL, 0o600);
        }
        catch (error) {
            if (!isErrno(error, "EEXIST")) {
                throw error;
            }
            descriptor = openSync(path, flags);
        }
    }
    try {
        const file = fstatSync(descriptor);
        const userId = typeof process.getuid === "function" ? process.getuid() : undefined;
        if (!file.isFile() || (userId !== undefined && file.uid !== userId)) {
            throw new MiniMePersistenceError("invalid", "Mini Me database and SQLite sidecars must be regular files owned by this user");
        }
        fchmodSync(descriptor, 0o600);
    }
    finally {
        closeSync(descriptor);
    }
}
function secureSQLiteSidecars(databasePath) {
    for (const suffix of ["-wal", "-shm"]) {
        secureOwnerOnlyFile(databasePath + suffix, false);
    }
}
function connect(databasePath) {
    const path = checkedDatabasePath(databasePath);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const actualPath = canonicalDatabasePath(path);
    checkPrivateDirectory(dirname(actualPath));
    secureOwnerOnlyFile(actualPath, true);
    const database = new DatabaseSync(actualPath);
    try {
        database.exec("PRAGMA busy_timeout = 10000");
        database.exec("PRAGMA journal_mode = WAL");
        database.exec("PRAGMA synchronous = FULL");
        database.exec("CREATE TABLE IF NOT EXISTS mini_me_state (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), revision INTEGER NOT NULL, payload_json TEXT NOT NULL, sha256 TEXT NOT NULL)");
        secureSQLiteSidecars(actualPath);
        return database;
    }
    catch (error) {
        database.close();
        throw error;
    }
}
function checkSnapshot(value) {
    if (!snapshotValidator.Check(value)) {
        throw new MiniMePersistenceError("invalid", "Mini Me state does not match the portable schema");
    }
    const snapshot = value;
    if (!snapshot.profile) {
        throw new MiniMePersistenceError("invalid", "A persisted Mini Me profile cannot be empty");
    }
    if (snapshot.documents.length !== MINI_ME_DOCUMENT_NAMES.length ||
        MINI_ME_DOCUMENT_NAMES.some((name) => snapshot.documents.filter((document) => document.name === name).length !== 1)) {
        throw new MiniMePersistenceError("invalid", "A Mini Me state must contain each of the six authored documents once");
    }
    if (snapshot.sources.length > MINI_ME_LIMITS.sources || snapshot.beliefs.length > MINI_ME_LIMITS.retainedEvents) {
        throw new MiniMePersistenceError("limit-reached", "Mini Me state exceeds a retained record limit");
    }
    const sourceIds = new Set();
    for (const source of snapshot.sources) {
        if (sourceIds.has(source.id)) {
            throw new MiniMePersistenceError("invalid", "Mini Me source IDs must be unique");
        }
        sourceIds.add(source.id);
        const revisions = new Set();
        for (const revision of source.revisions) {
            if (revisions.has(revision.revision) ||
                miniMeEvidenceRevision(revision.text) !== revision.revision ||
                Buffer.byteLength(revision.text, "utf8") > MINI_ME_LIMITS.inferenceBytes) {
                throw new MiniMePersistenceError("invalid", "Mini Me source revision hash or history is invalid");
            }
            revisions.add(revision.revision);
        }
        if (!revisions.has(source.currentRevision)) {
            throw new MiniMePersistenceError("invalid", "Mini Me source has no current revision");
        }
    }
    const beliefIds = new Set();
    for (const belief of snapshot.beliefs) {
        if (beliefIds.has(belief.id)) {
            throw new MiniMePersistenceError("invalid", "Mini Me belief IDs must be unique");
        }
        beliefIds.add(belief.id);
        if (belief.evidence.some((evidence) => !evidenceIsRetained(snapshot, evidence.sourceId, evidence.sourceRevision, evidence.excerpt))) {
            throw new MiniMePersistenceError("invalid", "Mini Me belief cites withdrawn or ungrounded evidence");
        }
        if (belief.origin === "inferred" && belief.evidence.some((evidence) => !sourceIds.has(evidence.sourceId))) {
            throw new MiniMePersistenceError("invalid", "Inferred beliefs must cite selected owner sources");
        }
    }
    for (const belief of snapshot.beliefs) {
        if (belief.supersedes) {
            const previous = snapshot.beliefs.find((item) => item.id === belief.supersedes);
            if (!previous ||
                belief.origin !== "correction" ||
                previous.id === belief.id ||
                previous.preference.scope.normalize("NFKC").trim().toLocaleLowerCase("en-US") !==
                    belief.preference.scope.normalize("NFKC").trim().toLocaleLowerCase("en-US")) {
                throw new MiniMePersistenceError("invalid", "Mini Me correction lineage is invalid");
            }
        }
    }
    const suppressionIds = new Set();
    for (const item of snapshot.suppressions) {
        const key = item.sourceId + ":" + item.evidenceKey;
        if (suppressionIds.has(key) || (!sourceIds.has(item.sourceId) && !item.sourceId.startsWith("owner:"))) {
            throw new MiniMePersistenceError("invalid", "Mini Me suppression identity is invalid");
        }
        suppressionIds.add(key);
    }
    const predictionIds = new Set();
    for (const prediction of snapshot.predictions) {
        if (predictionIds.has(prediction.id)) {
            throw new MiniMePersistenceError("invalid", "Mini Me prediction IDs must be unique");
        }
        predictionIds.add(prediction.id);
        if (prediction.authority !== "advisory" ||
            prediction.profileGeneration !== snapshot.profile.generation ||
            prediction.contentRevision > snapshot.contentRevision ||
            (prediction.optionId !== null && !prediction.choice.options.some((option) => option.id === prediction.optionId)) ||
            prediction.evidence.some((evidence) => !evidenceIsRetained(snapshot, evidence.sourceId, evidence.sourceRevision, evidence.excerpt))) {
            throw new MiniMePersistenceError("invalid", "Mini Me prediction ledger is not grounded");
        }
    }
    const outcomePredictions = new Set();
    const outcomeIds = new Set();
    for (const outcome of snapshot.outcomes) {
        const prediction = snapshot.predictions.find((item) => item.id === outcome.predictionId);
        if (!prediction || outcomePredictions.has(outcome.predictionId) || outcomeIds.has(outcome.id) ||
            !prediction.choice.options.some((option) => option.id === outcome.optionId) ||
            outcome.matched !== (prediction.optionId === outcome.optionId) ||
            outcome.createdAt <= prediction.createdAt ||
            (outcome.correctionId !== null && !snapshot.beliefs.some((belief) => belief.id === outcome.correctionId && belief.origin === "correction"))) {
            throw new MiniMePersistenceError("invalid", "Mini Me owner outcome does not match its frozen prediction");
        }
        outcomePredictions.add(outcome.predictionId);
        outcomeIds.add(outcome.id);
    }
}
function evidenceIsRetained(snapshot, sourceId, sourceRevision, excerpt) {
    const source = snapshot.sources.find((item) => item.id === sourceId);
    if (source) {
        return source.revisions.some((revision) => revision.revision === sourceRevision && revision.text.includes(excerpt));
    }
    return sourceId.startsWith("owner:") && /^[a-f0-9]{64}$/.test(sourceRevision) && excerpt.length > 0;
}
function readRow(database) {
    const row = database
        .prepare("SELECT revision, payload_json, sha256 FROM mini_me_state WHERE singleton = 1")
        .get();
    if (!row) {
        return null;
    }
    const parsed = JSON.parse(row.payload_json);
    checkSnapshot(parsed);
    if (miniMeOperationFingerprint(parsed) !== row.sha256 ||
        parsed.profile?.revision !== row.revision) {
        throw new MiniMePersistenceError("invalid", "Mini Me database integrity or revision check failed");
    }
    return parsed;
}
function readState(databasePath) {
    const database = connect(databasePath);
    try {
        const snapshot = readRow(database);
        if (!snapshot) {
            throw new MiniMePersistenceError("not-found", "No Mini Me profile exists at this data path; initialize one explicitly");
        }
        return readContentSnapshot(snapshot);
    }
    finally {
        database.close();
    }
}
function transact(databasePath, operation) {
    const database = connect(databasePath);
    database.exec("BEGIN IMMEDIATE");
    try {
        const current = readRow(database);
        const change = operation(current);
        if (change.dirty) {
            if (!change.next?.profile) {
                throw new MiniMePersistenceError("invalid", "Cannot persist an empty Mini Me profile");
            }
            if (current) {
                change.next.profile.revision = current.profile.revision + 1;
                change.next.profile.updatedAt = Date.now();
            }
            checkSnapshot(change.next);
            const payload = JSON.stringify(change.next);
            const sha256 = miniMeOperationFingerprint(change.next);
            if (current) {
                database
                    .prepare("UPDATE mini_me_state SET revision = ?, payload_json = ?, sha256 = ? WHERE singleton = 1")
                    .run(change.next.profile.revision, payload, sha256);
            }
            else {
                database
                    .prepare("INSERT INTO mini_me_state(singleton, revision, payload_json, sha256) VALUES(1, ?, ?, ?)")
                    .run(change.next.profile.revision, payload, sha256);
            }
        }
        database.exec("COMMIT");
        secureSQLiteSidecars(canonicalDatabasePath(databasePath));
        return structuredClone(change.result);
    }
    catch (error) {
        try {
            database.exec("ROLLBACK");
        }
        catch {
            // Preserve the original error if SQLite already closed the transaction.
        }
        throw error;
    }
    finally {
        database.close();
    }
}
function requireState(current) {
    if (!current) {
        throw new MiniMePersistenceError("not-found", "No Mini Me profile exists at this data path; initialize one explicitly");
    }
    return current;
}
function createBelief(preference, origin, now, evidence, supersedes = null) {
    return {
        id: randomUUID(),
        preference: structuredClone(preference),
        origin,
        evidence,
        status: "active",
        supersedes,
        createdAt: now,
    };
}
function ownerEvidence(preference, label, now) {
    const revision = miniMeOperationFingerprint({ preference, label, now });
    const sourceId = "owner:" + label + ":" + randomUUID();
    return [{ sourceId, sourceRevision: revision, excerpt: preference.statement }];
}
function latestCorrectionTarget(state, scope) {
    const normalized = scope.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
    const active = state.beliefs
        .filter((belief) => belief.status === "active" && belief.preference.scope.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US") === normalized)
        .toSorted((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
    return active.find((belief) => belief.origin === "correction") ?? active[0];
}
function snapshotExport(snapshot, now) {
    const body = readContentSnapshot(snapshot);
    return {
        format: "mini-me-portable-v1",
        exportedAt: now,
        snapshot: body,
        sha256: miniMeOperationFingerprint(body),
    };
}
function validateImport(value) {
    if (!exportValidator.Check(value)) {
        throw new MiniMePersistenceError("invalid", "Mini Me import does not match the export schema");
    }
    if (miniMeOperationFingerprint(value.snapshot) !== value.sha256) {
        throw new MiniMePersistenceError("invalid", "Mini Me import checksum does not match the snapshot");
    }
    checkSnapshot(value.snapshot);
    return structuredClone(value);
}
/**
 * Owner API for a trusted local principal. Do not expose it directly to an untrusted transport.
 * The same-user process boundary is a local trust boundary, not a malicious-code sandbox.
 */
export function createMiniMeOwnerApi(input) {
    const databasePath = checkedDatabasePath(input.databasePath);
    return {
        init(name, now = Date.now()) {
            if (!name.trim() || name.length > 80) {
                throw new MiniMePersistenceError("invalid", "Mini Me name must contain 1 to 80 characters");
            }
            const documents = MINI_ME_DOCUMENT_NAMES.map((documentName) => ({
                name: documentName,
                content: "",
                revision: 0,
                updatedAt: now,
            }));
            const next = createBlankSnapshot();
            next.profile = {
                id: randomUUID(),
                name: name.trim(),
                generation: 1,
                revision: 0,
                createdAt: now,
                updatedAt: now,
            };
            next.documents = documents;
            return transact(databasePath, (current) => {
                if (current) {
                    throw new MiniMePersistenceError("conflict", "This data path already contains a Mini Me profile");
                }
                return { next, result: next, dirty: true };
            });
        },
        inspect() {
            return readState(databasePath);
        },
        async predict(choice, now = Date.now()) {
            const snapshot = readState(databasePath);
            const predictionInput = {
                id: newPredictionId(),
                agentId: null,
                choice,
                beliefs: snapshot.beliefs,
                profileGeneration: snapshot.profile.generation,
                contentRevision: snapshot.contentRevision,
                now,
            };
            let prediction = predictMiniMeBaseline(predictionInput);
            if (input.decisionProvider) {
                const batch = buildMiniMeDecisionBatch(predictionInput);
                if (batch) {
                    prediction = applyMiniMeDecisionOutcome(predictionInput, await input.decisionProvider(batch));
                }
            }
            return transact(databasePath, (current) => {
                const state = requireState(current);
                freezePrediction(state, prediction);
                return { next: state, result: prediction, dirty: true };
            });
        },
        setDocument(input) {
            return transact(databasePath, (current) => {
                const state = requireState(current);
                const previous = state.documents.find((document) => document.name === input.name);
                if (!previous) {
                    throw new MiniMePersistenceError("not-found", "Mini Me document is unavailable");
                }
                const preferenceCorrections = newMiniMeDocumentCorrections(previous.content, input.content);
                const document = reviseDocument(state, {
                    ...input,
                    now: input.now ?? Date.now(),
                });
                const now = input.now ?? Date.now();
                const beliefs = preferenceCorrections.map((preference) => {
                    const revision = miniMeEvidenceRevision(input.content);
                    return createBelief(preference, "correction", now, [
                        {
                            sourceId: "owner:document:" + input.name,
                            sourceRevision: revision,
                            excerpt: JSON.stringify(preference),
                        },
                    ], latestCorrectionTarget(state, preference.scope)?.id ?? null);
                });
                learnBeliefBatch(state, beliefs);
                return { next: state, result: document, dirty: true };
            });
        },
        selectSource(input) {
            return transact(databasePath, (current) => {
                const state = requireState(current);
                const source = addContentSource(state, { ...input, now: input.now ?? Date.now() });
                return { next: state, result: source, dirty: true };
            });
        },
        reviseSource(input) {
            return transact(databasePath, (current) => {
                const state = requireState(current);
                const source = appendContentSourceRevision(state, { ...input, now: input.now ?? Date.now() });
                const changed = source.currentRevision !== input.expectedRevision;
                return { next: state, result: source, dirty: changed };
            });
        },
        removeSource(sourceId) {
            return transact(databasePath, (current) => {
                const state = requireState(current);
                const count = removeContentSource(state, sourceId);
                return { next: state, result: count, dirty: true };
            });
        },
        learnDirect(preference, now = Date.now()) {
            return transact(databasePath, (current) => {
                const state = requireState(current);
                const belief = createBelief(preference, "direct", now, ownerEvidence(preference, "direct", now));
                const result = learnBeliefBatch(state, [belief]);
                return { next: state, result: result.applied[0] ?? null, dirty: result.applied.length > 0 };
            });
        },
        correct(preference, now = Date.now()) {
            return transact(databasePath, (current) => {
                const state = requireState(current);
                const prior = latestCorrectionTarget(state, preference.scope);
                const belief = createBelief(preference, "correction", now, ownerEvidence(preference, "correction", now), prior?.id ?? null);
                const result = learnBeliefBatch(state, [belief]);
                return { next: state, result: result.applied[0] ?? null, dirty: result.applied.length > 0 };
            });
        },
        undo(beliefId) {
            return transact(databasePath, (current) => {
                const state = requireState(current);
                const result = undoBelief(state, beliefId);
                return { next: state, result, dirty: true };
            });
        },
        recordOutcome(input) {
            return transact(databasePath, (current) => {
                const state = requireState(current);
                const prediction = state.predictions.find((item) => item.id === input.predictionId);
                if (!prediction) {
                    throw new MiniMePersistenceError("not-found", "Frozen prediction is unavailable");
                }
                const previous = state.outcomes.find((item) => item.predictionId === input.predictionId);
                if (previous) {
                    const previousCorrection = previous.correctionId
                        ? state.beliefs.find((belief) => belief.id === previous.correctionId)?.preference
                        : undefined;
                    if (previous.optionId === input.optionId &&
                        miniMeOperationFingerprint(previousCorrection ?? null) ===
                            miniMeOperationFingerprint(input.correction ?? null)) {
                        return { next: state, result: previous, dirty: false };
                    }
                    throw new MiniMePersistenceError("conflict", "A conflicting actual outcome already exists");
                }
                const now = Math.max(input.now ?? Date.now(), prediction.createdAt + 1);
                let correctionId = null;
                if (input.correction) {
                    const prior = latestCorrectionTarget(state, input.correction.scope);
                    const belief = createBelief(input.correction, "correction", now, ownerEvidence(input.correction, "outcome", now), prior?.id ?? null);
                    const learned = learnBeliefBatch(state, [belief]);
                    correctionId = learned.applied[0]?.id ?? null;
                }
                const outcome = {
                    id: randomUUID(),
                    predictionId: prediction.id,
                    optionId: input.optionId,
                    origin: "owner",
                    matched: prediction.optionId === input.optionId,
                    correctionId,
                    createdAt: now,
                };
                const result = appendOutcome(state, outcome);
                state.contentRevision += 1;
                return { next: state, result, dirty: true };
            });
        },
        renderDocument(name) {
            const state = readState(databasePath);
            const document = state.documents.find((item) => item.name === name);
            if (!document) {
                throw new MiniMePersistenceError("not-found", "Mini Me document is unavailable");
            }
            return renderMiniMeDocument(state.profile, document, state.beliefs, state);
        },
        renderAllDocuments() {
            const state = readState(databasePath);
            return renderAllMiniMeDocuments({
                profile: state.profile,
                documents: state.documents,
                beliefs: state.beliefs,
                predictions: state.predictions,
                outcomes: state.outcomes,
            });
        },
        inspectProjection(name, text) {
            const state = readState(databasePath);
            return inspectMiniMeDocument(text, state.profile, name);
        },
        exportState(now = Date.now()) {
            return snapshotExport(readState(databasePath), now);
        },
        importState(value, options = {}) {
            const imported = validateImport(value);
            const next = readContentSnapshot(imported.snapshot);
            return transact(databasePath, (current) => {
                if (current && options.expectedRevision !== current.profile.revision) {
                    throw new MiniMePersistenceError("conflict", "Import replaces existing data only when expectedRevision matches the current profile revision");
                }
                if (!current && options.expectedRevision !== undefined) {
                    throw new MiniMePersistenceError("conflict", "A new data path has no revision to replace");
                }
                return { next, result: next, dirty: true };
            });
        },
    };
}
/** Default agent-facing API. It has no owner methods, import/export, or filesystem effects. */
export function createMiniMeAgentApi(input) {
    const databasePath = checkedDatabasePath(input.databasePath);
    return {
        view() {
            const state = readState(databasePath);
            return {
                profile: structuredClone(state.profile),
                contentRevision: state.contentRevision,
                beliefs: structuredClone(state.beliefs.filter((belief) => belief.status === "active")),
            };
        },
        selectedSources() {
            const state = readState(databasePath);
            return state.sources.map((source) => {
                const revision = source.revisions.find((item) => item.revision === source.currentRevision);
                return { id: source.id, label: source.label, revision: revision.revision, text: revision.text };
            });
        },
        infer(sourceId, response, now = Date.now()) {
            return transact(databasePath, (current) => {
                const state = requireState(current);
                const source = state.sources.find((item) => item.id === sourceId);
                if (!source) {
                    throw new MiniMePersistenceError("not-found", "Only an explicitly selected source can be learned");
                }
                const revision = source.revisions.find((item) => item.revision === source.currentRevision);
                const extracted = parseMiniMeExtraction({
                    text: revision.text,
                    sourceId,
                    sourceRevision: revision.revision,
                    response,
                });
                const beliefs = extracted.map((entry) => createBelief(entry.preference, "inferred", now, entry.evidence));
                const result = learnBeliefBatch(state, beliefs);
                return { next: state, result: result.applied, dirty: result.applied.length > 0 };
            });
        },
        async consult(choice, now = Date.now()) {
            const owner = createMiniMeOwnerApi({ databasePath });
            return owner.predict(choice, now);
        },
        async consultBaseline(choice, now = Date.now()) {
            const state = readState(databasePath);
            const prediction = predictMiniMeBaseline({
                id: newPredictionId(),
                agentId: null,
                choice,
                beliefs: state.beliefs,
                profileGeneration: state.profile.generation,
                contentRevision: state.contentRevision,
                now,
            });
            return transact(databasePath, (current) => {
                const next = requireState(current);
                freezePrediction(next, prediction);
                return { next, result: prediction, dirty: true };
            });
        },
    };
}
