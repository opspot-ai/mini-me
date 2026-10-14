import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, it } from "node:test";
import { createMiniMeOwnerApi } from "../dist/index.js";

const temporaryDirectories = [];
const root = new URL("..", import.meta.url).pathname;
const temp = () => {
  const directory = mkdtempSync(join(tmpdir(), "mini-me-storage-permissions-"));
  temporaryDirectories.push(directory);
  return directory;
};
const mode = (path) => statSync(path).mode & 0o777;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("private SQLite storage", () => {
  it("keeps fresh and reopened storage private under umask 022 in a fresh process", () => {
    const dataRoot = temp();
    const databasePath = join(dataRoot, "fresh", "nested", "profile.sqlite");
    const entrypoint = pathToFileURL(join(root, "dist", "index.js")).href;
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      import { statSync } from "node:fs";
      import { dirname } from "node:path";
      import { createMiniMeOwnerApi } from ${JSON.stringify(entrypoint)};
      process.umask(0o022);
      const databasePath = process.env.MINI_ME_DB_PATH;
      const owner = createMiniMeOwnerApi({ databasePath });
      owner.init("Fresh process profile", 1);
      owner.inspect();
      const mode = (path) => (statSync(path).mode & 0o777).toString(8);
      console.log(JSON.stringify({
        umask: process.umask().toString(8),
        freshDirectory: mode(dirname(dirname(databasePath))),
        nestedDirectory: mode(dirname(databasePath)),
        database: mode(databasePath)
      }));
    `], {
      cwd: root,
      env: { ...process.env, MINI_ME_DB_PATH: databasePath },
      encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout.trim());
    assert.equal(result.umask, "22");
    assert.equal(mode(join(dataRoot, "fresh")), 0o700);
    assert.equal(mode(join(dataRoot, "fresh", "nested")), 0o700);
    assert.equal(mode(databasePath), 0o600);
    assert.equal(result.freshDirectory, "700");
    assert.equal(result.nestedDirectory, "700");
    assert.equal(result.database, "600");
  });

  it("repairs only the selected database and active SQLite sidecars, preserving data", () => {
    const previousUmask = process.umask(0o022);
    const databasePath = join(temp(), "profile.sqlite");
    const owner = createMiniMeOwnerApi({ databasePath });
    try {
      owner.init("Preserved profile", 1);

      chmodSync(databasePath, 0o644);
      assert.equal(owner.inspect().profile.name, "Preserved profile");
      assert.equal(mode(databasePath), 0o600);

      const sqlite = new DatabaseSync(databasePath);
      try {
        sqlite.exec("PRAGMA journal_mode = WAL");
        sqlite.exec("BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS permission_probe (value TEXT); INSERT INTO permission_probe VALUES ('synthetic'); COMMIT");
        const sidecars = [`${databasePath}-wal`, `${databasePath}-shm`].filter(existsSync);
        assert.ok(sidecars.length > 0, "the active WAL connection should create a WAL or SHM sidecar");
        for (const sidecar of sidecars) chmodSync(sidecar, 0o644);

        assert.equal(owner.inspect().profile.name, "Preserved profile");
        for (const sidecar of sidecars) assert.equal(mode(sidecar), 0o600);
      } finally {
        sqlite.close();
      }
    } finally {
      process.umask(previousUmask);
    }
  });

  it("rejects an unsafe selected directory before creating a database", () => {
    const directory = join(temp(), "shared");
    mkdirSync(directory, { mode: 0o700 });
    chmodSync(directory, 0o755);
    const databasePath = join(directory, "profile.sqlite");

    assert.throws(
      () => createMiniMeOwnerApi({ databasePath }).init("Must not be written", 1),
      /data directory must be owned by this user and private/,
    );
    assert.equal(existsSync(databasePath), false);
    assert.equal(mode(directory), 0o755);
  });

  it("continues to reject a symbolic-link database path", () => {
    const directory = temp();
    const databasePath = join(directory, "profile.sqlite");
    const linkPath = join(directory, "linked.sqlite");
    const owner = createMiniMeOwnerApi({ databasePath });
    owner.init("Original profile", 1);
    symlinkSync(databasePath, linkPath);

    assert.throws(
      () => createMiniMeOwnerApi({ databasePath: linkPath }).inspect(),
      /regular files, not symbolic links/,
    );
    assert.equal(owner.inspect().profile.name, "Original profile");
  });
});
