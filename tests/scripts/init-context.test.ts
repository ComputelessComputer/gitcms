import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve(__dirname, "../../scripts/init-context.mjs");
const REPO_ROOT = resolve(__dirname, "../..");

// Minimal config that the script can parse without resolving `gitcms/config`.
// We avoid the `defineConfig` import because the bootstrap script must work
// against any user's `gitcms.config.ts`, including ones that import from the
// installed package — but our test setup just needs the shape, not the helper.
const CONFIG_TS = `
export default {
  content: {
    repo: "alice/site",
    branch: "main",
    path: "content",
    workingBranchPrefix: "gitcms/",
  },
  collections: [
    {
      id: "blog",
      label: "Blog",
      path: "blog",
      bodyFormat: "markdown",
      schema: { title: { type: "string", required: true } },
    },
  ],
};
`;

let workdir: string;

function runScript(args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args], {
      cwd: workdir,
      encoding: "utf8",
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    return { stdout, stderr: "", status: 0 };
  } catch (error) {
    const err = error as { stdout?: Buffer; stderr?: Buffer; status: number };
    return {
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
      status: err.status,
    };
  }
}

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), "gitcms-init-"));
  // Symlink node_modules so the script can resolve `jiti`. The bootstrap
  // script expects to run inside a real project; this stand-in is enough.
  execFileSync("ln", ["-s", join(REPO_ROOT, "node_modules"), join(workdir, "node_modules")]);
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe("scripts/init-context.mjs", () => {
  it("exits non-zero when gitcms.config.ts is missing", () => {
    const result = runScript([]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("could not find");
  });

  it("creates repo-level brief files when none exist", () => {
    writeFileSync(join(workdir, "gitcms.config.ts"), CONFIG_TS);
    const result = runScript([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("2 created, 0 skipped");
    expect(existsSync(join(workdir, "content", ".gitcms", "context.md"))).toBe(true);
    expect(existsSync(join(workdir, "content", ".gitcms", "voice.md"))).toBe(true);
    expect(readFileSync(join(workdir, "content", ".gitcms", "context.md"), "utf8")).toContain(
      "About <Your Company>",
    );
  });

  it("also writes the collection voice override when a collection id is given", () => {
    writeFileSync(join(workdir, "gitcms.config.ts"), CONFIG_TS);
    const result = runScript(["blog"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("3 created, 0 skipped");
    expect(existsSync(join(workdir, "content", "blog", ".gitcms", "voice.md"))).toBe(true);
    expect(readFileSync(join(workdir, "content", "blog", ".gitcms", "voice.md"), "utf8")).toContain(
      "Voice — Blog",
    );
  });

  it("is idempotent: a second run skips existing files", () => {
    writeFileSync(join(workdir, "gitcms.config.ts"), CONFIG_TS);
    runScript([]);
    const original = readFileSync(join(workdir, "content", ".gitcms", "context.md"), "utf8");

    // Mutate one file; the script must not clobber it on the second run.
    writeFileSync(join(workdir, "content", ".gitcms", "context.md"), "MY CUSTOM CONTEXT");
    const second = runScript([]);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("0 created, 2 skipped");
    expect(readFileSync(join(workdir, "content", ".gitcms", "context.md"), "utf8")).toBe(
      "MY CUSTOM CONTEXT",
    );
    // sanity: the starter content really was the original on the first pass
    expect(original).toContain("About <Your Company>");
  });

  it("--force overwrites existing files", () => {
    writeFileSync(join(workdir, "gitcms.config.ts"), CONFIG_TS);
    runScript([]);
    writeFileSync(join(workdir, "content", ".gitcms", "context.md"), "STALE");

    const result = runScript(["--force"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("2 created, 0 skipped");
    expect(readFileSync(join(workdir, "content", ".gitcms", "context.md"), "utf8")).toContain(
      "About <Your Company>",
    );
  });

  it("warns and continues when the requested collection id is unknown", () => {
    writeFileSync(join(workdir, "gitcms.config.ts"), CONFIG_TS);
    const result = runScript(["does-not-exist"]);
    expect(result.status).toBe(0);
    // Repo files still get created
    expect(existsSync(join(workdir, "content", ".gitcms", "context.md"))).toBe(true);
    // No collection dir is created for the unknown id
    expect(existsSync(join(workdir, "content", "does-not-exist"))).toBe(false);
  });
});
