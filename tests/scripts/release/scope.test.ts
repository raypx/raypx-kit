import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { assertReleasePackage, snapshotPackageNames } from "../../../scripts/release/scope.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const packages = readdirSync(join(root, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const manifest = JSON.parse(
      readFileSync(join(root, "packages", entry.name, "package.json"), "utf8"),
    ) as { name: string; private?: boolean };
    return { directory: entry.name, ...manifest };
  })
  .filter((manifest) => !manifest.private);

describe("release package scope", () => {
  it("accepts every public workspace under its migrated identity", () => {
    expect(packages.map(({ directory }) => directory).sort()).toEqual([
      "analytics",
      "codemods",
      "devkit",
      "drizzle",
      "drizzle-kit",
      "email-preview",
      "env",
      "intl",
      "logger",
      "notifications",
      "security",
      "storage",
      "themes",
      "tsconfig",
    ]);
    for (const { name } of packages) expect(() => assertReleasePackage(name)).not.toThrow();
  });

  it.each(["@other/env", "@raypx/env", "@raypx-kit-other/env", "env"])(
    "rejects a release outside the migrated scope: %s",
    (name) => {
      expect(() => assertReleasePackage(name)).toThrow("outside the @raypx-kit scope");
    },
  );

  it("resolves short snapshot names to the actual published workspace identities", () => {
    expect(snapshotPackageNames(packages.map(({ directory }) => directory))).toEqual(
      packages.map(({ name }) => name),
    );
  });

  it("deduplicates short and explicit names while retaining the requested order", () => {
    expect(snapshotPackageNames(["intl", "@raypx-kit/env", "@raypx-kit/intl", "env"])).toEqual([
      "@raypx-kit/intl",
      "@raypx-kit/env",
    ]);
  });

  it("rejects a foreign scope before snapshot builds or packing can begin", () => {
    expect(() => snapshotPackageNames(["env", "@other/intl"])).toThrow(
      "outside the @raypx-kit scope",
    );
  });
});
