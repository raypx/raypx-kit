import { describe, expect, it } from "vite-plus/test";
import {
  assertPackageInventory,
  compatibilityMatrix,
  minimumNode,
  minimumVersion,
  packagesForNode,
  peerVersions,
  type CompatibilityIndex,
  type CompatibilityPackage,
} from "../../../scripts/packages/matrix.js";

function library(name: string, engines = ">=22.14"): CompatibilityPackage {
  return {
    directory: name,
    manifest: {
      name: `@raypx-kit/${name}`,
      version: "0.0.0-alpha.0",
      exports: { ".": "./index.mjs" },
      engines: { node: engines },
    },
    minimumNode: minimumVersion(engines, name),
    consumerDependencies: {},
    profiles: { minimum: {}, current: {} },
    fixtureDevDependencies: {},
    archive: `${name}.tgz`,
    sha256: "fixture",
  };
}

function index(): CompatibilityIndex {
  return {
    version: 1,
    developmentNode: "24.22.0",
    compilerDependencies: { typescript: "7.0.2" },
    packages: [library("env"), library("devkit", ">=22.14")],
  };
}

describe("consumer compatibility matrix", () => {
  it("derives exact engine floors instead of testing the newest patch in a major", () => {
    expect(minimumVersion(">=20", "node")).toBe("20.0.0");
    expect(minimumVersion(">=22.14", "node")).toBe("22.14.0");
    expect(compatibilityMatrix(index())).toEqual({
      include: [
        { node: "22.14.0", peers: "minimum" },
        { node: "22.14.0", peers: "current" },
        { node: "24.22.0", peers: "minimum" },
        { node: "24.22.0", peers: "current" },
      ],
    });
  });

  it("checks each package at its own floor and every package at the development pin", () => {
    const value = index();
    value.packages[1] = library("devkit", ">=24.22");
    expect(packagesForNode(value, "22.14.0").map((entry) => entry.directory)).toEqual(["env"]);
    expect(packagesForNode(value, "24.22.0")).toHaveLength(2);
    expect(() => packagesForNode(index(), "22.22.0")).toThrow(
      "not a declared compatibility target",
    );
  });

  it("rejects missing, duplicated or changed public packages in a prepared artifact", () => {
    const value = index();
    expect(() => assertPackageInventory(value, [...value.packages].reverse())).not.toThrow();
    expect(() => assertPackageInventory(value, [value.packages[0]!])).toThrow(
      "public packages differ",
    );
    expect(() =>
      assertPackageInventory(
        { ...value, packages: [...value.packages, value.packages[0]!] },
        value.packages,
      ),
    ).toThrow("public packages differ");
    const changed = library("env");
    changed.manifest.peerDependencies = { zod: "^4.0.0" };
    expect(() => assertPackageInventory(value, [changed, value.packages[1]!])).toThrow(
      "public packages differ",
    );
  });

  it("deduplicates identical development and minimum engine targets", () => {
    const value = index();
    value.developmentNode = "22.14.0";
    value.packages = [library("env")];
    expect(compatibilityMatrix(value).include).toHaveLength(2);
  });

  it("does not silently skip packages that no longer support the development runtime", () => {
    const value = index();
    value.packages = [library("env", ">=22.14 <24")];
    expect(() => compatibilityMatrix(value)).toThrow("development Node is outside");
  });

  it("rejects empty, invalid and unsupported matrix declarations", () => {
    expect(() => compatibilityMatrix({ ...index(), packages: [] })).toThrow("No public packages");
    expect(() => minimumVersion("workspace:*", "react")).toThrow("invalid semver range");
    expect(() => minimumVersion("<0.0.0", "react")).toThrow("no supported minimum");
    const value = index();
    value.packages[0]!.minimumNode = "18.0.0";
    expect(() => compatibilityMatrix(value)).toThrow("minimum Node differs");
  });

  it("allows an engine-free JSON preset package but rejects undocumented JavaScript runtime support", () => {
    const manifest = {
      name: "@raypx-kit/tsconfig",
      version: "0.0.0-alpha.0",
      exports: { "./base.json": "./base.json" },
    };
    expect(minimumNode(manifest)).toBe("22.14.0");
    expect(() => minimumNode({ ...manifest, exports: { ".": "./index.mjs" } })).toThrow(
      "must declare engines.node",
    );
  });

  it("fails closed if an artifact loses or changes a declared peer profile", () => {
    const value = index();
    const entry = value.packages[0]!;
    entry.manifest.peerDependencies = { zod: "^4.0.0" };
    expect(() => compatibilityMatrix(value)).toThrow("consumer dependency changed peer zod");
    entry.consumerDependencies = { zod: "^4.0.0" };
    entry.profiles = { minimum: { zod: "4.1.0" }, current: { zod: "4.6.7" } };
    expect(() => compatibilityMatrix(value)).toThrow("minimum peer profile changed");
  });

  it("pins stable minimum peers exactly without raising their supported lower bounds", () => {
    const ranges = { react: "^19.0.0", zod: "^4.0.0" };
    const current = { react: "19.3.1", zod: "4.6.7" };
    expect(peerVersions(ranges, current, "minimum")).toEqual({ react: "19.0.0", zod: "4.0.0" });
    expect(peerVersions(ranges, current, "current")).toEqual(current);
    expect(ranges).toEqual({ react: "^19.0.0", zod: "^4.0.0" });
  });

  it("keeps prerelease minima in the declared RC hash family", () => {
    const ranges = { "drizzle-orm": ">=1.0.0-rc.5-5935859 <1.0.0-rc.5-z" };
    expect(peerVersions(ranges, { "drizzle-orm": "1.0.0-rc.5-9412ab0" }, "minimum")).toEqual({
      "drizzle-orm": "1.0.0-rc.5-5935859",
    });
    expect(() => peerVersions(ranges, { "drizzle-orm": "1.0.0-rc.6-a" }, "current")).toThrow(
      "does not satisfy",
    );
  });

  it("fails when the current profile is missing or is a range rather than an exact lock selection", () => {
    expect(() => peerVersions({ react: "^19.0.0" }, {}, "current")).toThrow("missing exact");
    expect(() => peerVersions({ react: "^19.0.0" }, { react: "^19.3.1" }, "current")).toThrow(
      "missing exact",
    );
    expect(() => peerVersions({ react: "^19.0.0" }, { react: "20.0.0" }, "current")).toThrow(
      "does not satisfy",
    );
  });
});
