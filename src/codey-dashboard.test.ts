import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { listWorkspaceEntries, verificationChecks } from "./codey-dashboard.js";

const root = mkdtempSync(join(tmpdir(), "codey3-dashboard-"));
execFileSync("git", ["init"], { cwd: root });
execFileSync("git", ["config", "user.email", "codey3@example.test"], { cwd: root });
execFileSync("git", ["config", "user.name", "CODEY 3 Test"], { cwd: root });
mkdirSync(join(root, "src"));
writeFileSync(join(root, "README.md"), "CODEY 3\n");
writeFileSync(join(root, "src", "index.ts"), "export {};\n");
execFileSync("git", ["add", "."], { cwd: root });
execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });

const listing = await listWorkspaceEntries({ root });
assert.deepEqual(listing.entries.map((entry) => entry.name), ["src", "README.md"]);
assert.equal(listing.entries.find((entry) => entry.name === "src")?.type, "directory");
assert.equal("content" in listing.entries[0]!, false);

await assert.rejects(() => listWorkspaceEntries({ root, path: "../" }), /relative/);
assert.deepEqual(verificationChecks().map((check) => check.id), ["test", "typecheck", "build"]);
