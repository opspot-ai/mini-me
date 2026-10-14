/** Return a detached point-in-time view; the SQLite adapter never caches this value. */
export function readContentSnapshot(snapshot) {
    return structuredClone(snapshot);
}
