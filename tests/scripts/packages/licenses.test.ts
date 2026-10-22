import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vite-plus/test";
import {
  dependencyLicenseIndex,
  updatePackageLicenses,
} from "../../../scripts/packages/licenses.js";

const start = "<!-- BEGIN GENERATED DEPENDENCY LICENSE INDEX -->";
const end = "<!-- END GENERATED DEPENDENCY LICENSE INDEX -->";
const indexedPackages = ["email-preview", "security", "themes", "ui"];
const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "toolkit-license-test-"));
  roots.push(root);
  return root;
}
function pkg(directory: string, name: string, fields: Record<string, unknown> = {}) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ name, version: "1.0.0", license: "MIT", ...fields }),
  );
  writeFileSync(join(directory, "LICENSE"), "Original complete license text\n");
}
function repository() {
  const root = fixture();
  for (const name of indexedPackages) {
    const directory = join(root, "packages", name);
    pkg(directory, name, { dependencies: { runtime: "^1.0.0" } });
    writeFileSync(
      join(directory, "README.md"),
      `# Original heading\r\n\r\nOriginal prose.\n${start}\nold table\n${end}\n\nOriginal ending.\n`,
    );
  }
  pkg(join(root, "node_modules/runtime"), "runtime");
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("indexes only direct runtime dependencies and peers using actual installed filenames and versions", () => {
  const root = fixture();
  pkg(root, "consumer", {
    dependencies: { "@scope/direct": "^2.0.0" },
    devDependencies: { compiler: "1.0.0" },
    peerDependencies: { react: "^19.0.0", missing: "^1.0.0" },
    peerDependenciesMeta: { missing: { optional: true } },
  });
  const direct = join(root, "node_modules/@scope/direct");
  pkg(direct, "@scope/direct", {
    version: "2.3.4",
    dependencies: { transitive: "1.0.0" },
    exports: { ".": "./index.js" },
  });
  rmSync(join(direct, "LICENSE"));
  writeFileSync(join(direct, "LICENCE.md"), "Upstream full license remains in dependency\n");
  pkg(join(root, "node_modules/react"), "react", { version: "19.3.1" });
  pkg(join(root, "node_modules/compiler"), "compiler");
  // The transitive package is deliberately absent: generating the direct index must not resolve it.
  const index = dependencyLicenseIndex(root);
  expect(index).toMatch(/\| @scope\/direct\s+\| 2\.3\.4\s+\| MIT\s+\|/);
  expect(index).toContain("https://unpkg.com/@scope/direct@2.3.4/LICENCE.md");
  expect(index).toContain("https://unpkg.com/react@19.3.1/LICENSE");
  expect(index).not.toContain("compiler");
  expect(index).not.toContain("transitive");
  expect(index).not.toContain("Upstream full license");
});

it("links a direct workspace dependency to the adjacent package license", () => {
  const root = fixture();
  const ui = join(root, "packages/ui");
  const themes = join(root, "packages/themes");
  pkg(ui, "ui", { dependencies: { themes: "workspace:*" } });
  pkg(themes, "themes", { license: "Apache-2.0" });
  mkdirSync(join(root, "node_modules"));
  symlinkSync(themes, join(root, "node_modules/themes"), "dir");
  expect(dependencyLicenseIndex(ui)).toContain("[LICENSE](../themes/LICENSE)");
  expect(dependencyLicenseIndex(ui)).toMatch(/\| themes\s+\| 1\.0\.0\s+\| Apache-2\.0\s+\|/);
});

it("fails on missing dependency installations, missing or empty license files and ambiguous metadata", () => {
  const root = fixture();
  pkg(root, "consumer", { dependencies: { runtime: "^1.0.0" } });
  expect(() => dependencyLicenseIndex(root)).toThrow("direct license dependency is not installed");
  const runtime = join(root, "node_modules/runtime");
  pkg(runtime, "runtime");
  rmSync(join(runtime, "LICENSE"));
  writeFileSync(join(runtime, "NOTICE"), "Attribution alone is not a license file");
  expect(() => dependencyLicenseIndex(root)).toThrow("Installed package has no license file");
  writeFileSync(join(runtime, "LICENSE"), "\n");
  expect(() => dependencyLicenseIndex(root)).toThrow("Empty license file");
  for (const license of [undefined, { type: "MIT" }, "SEE LICENSE IN LICENSE", "UNKNOWN", ""]) {
    pkg(runtime, "runtime", { license });
    expect(() => dependencyLicenseIndex(root)).toThrow("missing or ambiguous license identifier");
  }
});

it.each(indexedPackages)(
  "updates only %s's README index, preserves every LICENSE and is idempotent",
  (name) => {
    const root = repository();
    const directory = join(root, "packages", name);
    const readmeFile = join(directory, "README.md");
    const original = readFileSync(readmeFile, "utf8");
    const licenses = indexedPackages.map((name) =>
      readFileSync(join(root, "packages", name, "LICENSE"), "utf8"),
    );
    updatePackageLicenses(root);
    const updated = readFileSync(readmeFile, "utf8");
    expect(updated.slice(0, updated.indexOf(start))).toBe(
      original.slice(0, original.indexOf(start)),
    );
    expect(updated.slice(updated.indexOf(end))).toBe(original.slice(original.indexOf(end)));
    expect(updated).toContain("https://unpkg.com/runtime@1.0.0/LICENSE");
    updatePackageLicenses(root);
    expect(readFileSync(readmeFile, "utf8")).toBe(updated);
    expect(() => updatePackageLicenses(root, true)).not.toThrow();
    expect(
      indexedPackages.map((name) => readFileSync(join(root, "packages", name, "LICENSE"), "utf8")),
    ).toEqual(licenses);
  },
);

it("reports version drift in read-only check mode without rewriting README or LICENSE", () => {
  const root = repository();
  updatePackageLicenses(root);
  const readme = join(root, "packages/email-preview/README.md");
  const original = readFileSync(readme, "utf8");
  const licenseFile = join(root, "packages/email-preview/LICENSE");
  const license = readFileSync(licenseFile, "utf8");
  pkg(join(root, "node_modules/runtime"), "runtime", { version: "1.1.0" });
  expect(() => updatePackageLicenses(root, true)).toThrow("license index is stale");
  expect(readFileSync(readme, "utf8")).toBe(original);
  expect(readFileSync(licenseFile, "utf8")).toBe(license);
});

it.each(["no markers", `${end}\n${start}`, `${start}\n${start}\n${end}`])(
  "rejects malformed marker blocks before writing any README: %s",
  (invalid) => {
    const root = repository();
    const readme = join(root, "packages/email-preview/README.md");
    const original = readFileSync(readme, "utf8");
    writeFileSync(join(root, "packages/ui/README.md"), invalid);
    expect(() => updatePackageLicenses(root)).toThrow(
      "exactly one ordered dependency license index marker pair",
    );
    expect(readFileSync(readme, "utf8")).toBe(original);
  },
);

it("keeps generated indexes stable through the repository Markdown formatter", () => {
  const root = repository();
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  updatePackageLicenses(root);
  const readmes = indexedPackages.map((name) => join(root, "packages", name, "README.md"));
  execFileSync(join(repositoryRoot, "node_modules/.bin/vp"), ["fmt", "--write", ...readmes], {
    cwd: repositoryRoot,
    stdio: "pipe",
  });
  expect(() => updatePackageLicenses(root, true)).not.toThrow();
}, 30_000);
