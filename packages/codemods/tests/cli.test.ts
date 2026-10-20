import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import type { Codemod } from "../src/index.js";
import { runCli } from "../src/internal/cli.js";
import { codemods } from "../src/migrations/index.js";

let cwd: string;
let output: string[];
let errors: string[];
const rename: Codemod = {
  name: "rename",
  description: "Rename a fixture identifier",
  transform: ({ source }) => source.replaceAll("before", "after"),
};
const options = () => ({
  cwd,
  stdout: (message: string) => output.push(message),
  stderr: (message: string) => errors.push(message),
});

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "codemods-cli-"));
  output = [];
  errors = [];
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe("codemod CLI", () => {
  it("ships an honest empty registry and lists it successfully", async () => {
    expect(codemods).toEqual([]);
    expect(await runCli(["list"], codemods, options())).toBe(0);
    expect(output).toEqual(["No codemods are registered."]);
    expect(errors).toEqual([]);
  });

  it.each([[], ["--help"], ["-h"]])("prints usage for %j", async (...args) => {
    expect(await runCli(args, codemods, options())).toBe(0);
    expect(output.join("\n")).toContain("Usage: raypx-kit-codemod");
    expect(errors).toEqual([]);
  });

  it("lists registered migrations with their descriptions", async () => {
    expect(await runCli(["list"], [rename], options())).toBe(0);
    expect(output).toEqual(["rename\tRename a fixture identifier"]);
  });

  it("defaults to dry-run and requires --write to change a file", async () => {
    const path = join(cwd, "source.ts");
    await writeFile(path, "before");

    expect(await runCli(["rename", "source.ts"], [rename], options())).toBe(0);
    expect(output).toEqual(["Mode: dry-run", `changed\t${path}`]);
    expect(await readFile(path, "utf8")).toBe("before");
    expect(await runCli(["rename", "--write", "source.ts"], [rename], options())).toBe(0);
    expect(await readFile(path, "utf8")).toBe("after");
    expect(errors).toEqual([]);
    expect(output.join("\n")).not.toContain("before");
  });

  it("accepts explicit dry-run and a separator for dash-prefixed files", async () => {
    await writeFile(join(cwd, "-source.ts"), "before");
    expect(await runCli(["rename", "--dry-run", "--", "-source.ts"], [rename], options())).toBe(0);
    expect(await readFile(join(cwd, "-source.ts"), "utf8")).toBe("before");
  });

  it.each([
    { args: ["missing", "--write", "source.ts"], error: "Unknown migration" },
    { args: ["rename", "--dry-run", "--write", "source.ts"], error: "either" },
    { args: ["rename", "--unknown", "source.ts"], error: "Unknown option" },
    { args: ["rename"], error: "at least one file" },
    { args: ["list", "source.ts"], error: "does not accept arguments" },
  ])("rejects $args before writing files", async ({ args, error }) => {
    const path = join(cwd, "source.ts");
    await writeFile(path, "before");

    expect(await runCli(args, [rename], options())).toBe(1);
    expect(errors.join("\n")).toContain(error);
    expect(await readFile(path, "utf8")).toBe("before");
    expect(output).toEqual([]);
  });

  it("reports migration failures and preserves prepared source files", async () => {
    await writeFile(join(cwd, "source.ts"), "before");
    expect(
      await runCli(
        ["broken", "source.ts", "--write"],
        [
          {
            ...rename,
            name: "broken",
            transform: () => {
              throw new Error("Migration failed");
            },
          },
        ],
        options(),
      ),
    ).toBe(1);
    expect(errors).toEqual(["Migration failed"]);
    expect(await readFile(join(cwd, "source.ts"), "utf8")).toBe("before");
  });
});
