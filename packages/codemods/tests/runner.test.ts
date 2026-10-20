import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { runCodemod, type Codemod, type CodemodFile } from "../src/index.js";

let cwd: string;
const rename: Codemod = {
  name: "rename",
  description: "Rename a fixture identifier",
  transform: ({ source }) => source.replaceAll("before", "after"),
};

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "codemods-runner-"));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe("runCodemod", () => {
  it("reports changes without writing by default and passes an absolute path", async () => {
    const path = join(cwd, "source.ts");
    await writeFile(path, "const before = 1;\n");
    const transform = vi.fn(async ({ path: filePath, source }: CodemodFile) => {
      expect(filePath).toBe(path);
      return source.replace("before", "after");
    });

    expect(await runCodemod({ ...rename, transform }, ["source.ts"], { cwd })).toEqual({
      mode: "dry-run",
      files: [{ path, status: "changed" }],
    });
    expect(await readFile(path, "utf8")).toBe("const before = 1;\n");
    expect(transform).toHaveBeenCalledOnce();
  });

  it("deduplicates resolved paths and writes each changed file once", async () => {
    const path = join(cwd, "source.ts");
    await writeFile(path, "before\n");
    const transform = vi.fn(rename.transform);

    expect(
      await runCodemod({ ...rename, transform }, ["source.ts", "./source.ts", path], {
        cwd,
        write: true,
      }),
    ).toEqual({ mode: "write", files: [{ path, status: "changed" }] });
    expect(await readFile(path, "utf8")).toBe("after\n");
    expect(transform).toHaveBeenCalledOnce();
    expect(await runCodemod(rename, [path], { write: true })).toEqual({
      mode: "write",
      files: [{ path, status: "unchanged" }],
    });
  });

  it.each([null, undefined, "before"])("treats %s as unchanged", async (result) => {
    const path = join(cwd, "source.ts");
    await writeFile(path, "before");
    const codemod: Codemod = { ...rename, transform: () => result };

    expect(await runCodemod(codemod, [path], { write: true })).toEqual({
      mode: "write",
      files: [{ path, status: "unchanged" }],
    });
    expect(await readFile(path, "utf8")).toBe("before");
  });

  it("supports intentionally empty transformed files", async () => {
    const path = join(cwd, "source.ts");
    await writeFile(path, "before");
    await runCodemod({ ...rename, transform: () => "" }, [path], { write: true });
    expect(await readFile(path, "utf8")).toBe("");
  });

  it("finishes all transforms before writing, including rejected async transforms", async () => {
    const first = join(cwd, "first.ts");
    const second = join(cwd, "second.ts");
    await Promise.all([writeFile(first, "before"), writeFile(second, "before")]);
    const codemod: Codemod = {
      ...rename,
      async transform({ path, source }) {
        if (path === second) throw new Error("Cannot migrate second.ts");
        return source.replace("before", "after");
      },
    };

    await expect(runCodemod(codemod, [first, second], { write: true })).rejects.toThrow(
      "Cannot migrate second.ts",
    );
    expect(await readFile(first, "utf8")).toBe("before");
    expect(await readFile(second, "utf8")).toBe("before");
  });

  it("rejects a missing file before applying prepared changes", async () => {
    const path = join(cwd, "source.ts");
    await writeFile(path, "before");

    await expect(
      runCodemod(rename, [path, join(cwd, "missing.ts")], { write: true }),
    ).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe("before");
  });

  it("rejects directories and symlink files", async () => {
    const path = join(cwd, "source.ts");
    const link = join(cwd, "link.ts");
    await writeFile(path, "before");
    await symlink(path, link);

    await expect(runCodemod(rename, [cwd], { write: true })).rejects.toThrow("regular file");
    await expect(runCodemod(rename, [link], { write: true })).rejects.toThrow("symlink");
    expect(await readFile(path, "utf8")).toBe("before");
  });

  it("accepts an empty explicit file set", async () => {
    expect(await runCodemod(rename, [])).toEqual({ mode: "dry-run", files: [] });
  });
});
