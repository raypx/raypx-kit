import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  discoverTemplates,
  resolveContainedFile,
  resolveDirectory,
} from "../src/server/discovery.js";
import { readStaticFile } from "../src/server/static.js";

const directories: string[] = [];

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "email-discovery-")));
  directories.push(root);
  const emails = join(root, "emails");
  await mkdir(emails);
  return { root, emails };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("email discovery", () => {
  it("lists nested TSX/JSX templates and excludes helper and static directories", async () => {
    const { emails } = await fixture();
    for (const name of ["nested", "_components", ".private", "static"])
      await mkdir(join(emails, name));
    for (const name of [
      "welcome.tsx",
      "nested/reset.jsx",
      "_helper.tsx",
      "_components/card.tsx",
      ".private/secret.tsx",
      "static/logo.tsx",
      "notes.ts",
    ]) {
      await writeFile(join(emails, name), "export default () => null");
    }
    expect(await discoverTemplates(emails)).toEqual([
      { id: "nested/reset.jsx", name: "reset", directory: "nested" },
      { id: "welcome.tsx", name: "welcome", directory: "" },
    ]);
  });

  it("supports empty and not-yet-created directories", async () => {
    const { root, emails } = await fixture();
    expect(await discoverTemplates(emails)).toEqual([]);
    expect(await resolveDirectory(root, "emails")).toBe(emails);
    const missing = await resolveDirectory(root, "not-created/emails");
    expect(await discoverTemplates(missing)).toEqual([]);
  });

  it("rejects traversal and symlinks leaving the allowed directory", async () => {
    const { root, emails } = await fixture();
    await writeFile(join(root, "secret.tsx"), "secret");
    await symlink(join(root, "secret.tsx"), join(emails, "linked.tsx"));
    await symlink(root, join(emails, "outside"));
    expect(await discoverTemplates(emails)).toEqual([]);
    for (const name of [
      "../secret.tsx",
      "/etc/passwd",
      "..\\secret.tsx",
      "linked.tsx",
      "outside/secret.tsx",
    ]) {
      await expect(resolveContainedFile(emails, name)).rejects.toMatchObject({ status: 404 });
    }
  });

  it("serves static assets while rejecting a symlinked static root", async () => {
    const { root, emails } = await fixture();
    await mkdir(join(emails, "static"));
    await writeFile(join(emails, "static", "logo.svg"), "<svg/>");
    const asset = await readStaticFile(emails, "logo.svg");
    expect(asset.contentType).toBe("image/svg+xml");
    expect(new TextDecoder().decode(asset.data)).toBe("<svg/>");
    await expect(readStaticFile(emails, "../welcome.tsx")).rejects.toMatchObject({ status: 404 });
    await rm(join(emails, "static"), { recursive: true });
    await symlink(root, join(emails, "static"));
    await expect(readStaticFile(emails, "secret")).rejects.toMatchObject({ status: 404 });
  });
});
