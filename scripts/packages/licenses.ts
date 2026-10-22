import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";

interface Manifest {
  name: string;
  version: string;
  license?: unknown;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

const indexStart = "<!-- BEGIN GENERATED DEPENDENCY LICENSE INDEX -->";
const indexEnd = "<!-- END GENERATED DEPENDENCY LICENSE INDEX -->";
const licenseFile = /^(?:licen[cs]e|copying)(?:[.\-_]|$)/i;

function manifest(directory: string): Manifest {
  const value = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as Manifest;
  if (
    typeof value.name !== "string" ||
    !value.name ||
    typeof value.version !== "string" ||
    !value.version
  )
    throw new Error(`Missing package identity: ${directory}`);
  return value;
}

function resolvePackage(name: string, from: string): string | undefined {
  const require = createRequire(join(from, "package.json"));
  // Read manifests without executing package entries or requiring package.json exports.
  for (const search of require.resolve.paths(name) ?? []) {
    const directory = join(search, name);
    if (existsSync(join(directory, "package.json"))) return realpathSync(directory);
  }
}

function markdown(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Index direct runtime dependencies and peers; never traverse or copy upstream license text. */
export function dependencyLicenseIndex(directory: string): string {
  const current = realpathSync(directory);
  const parent = manifest(current);
  const declarations = new Map<string, { range: string; required: boolean }>();
  for (const [name, range] of Object.entries(parent.peerDependencies ?? {}))
    declarations.set(name, {
      range,
      required: parent.peerDependenciesMeta?.[name]?.optional !== true,
    });
  for (const [name, range] of Object.entries(parent.dependencies ?? {}))
    declarations.set(name, { range, required: true });
  for (const [name, range] of Object.entries(parent.optionalDependencies ?? {}))
    declarations.set(name, { range, required: false });
  const rows: string[][] = [];
  for (const [name, { range, required }] of [...declarations].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const resolved = resolvePackage(name, current);
    if (!resolved) {
      if (required)
        throw new Error(`${parent.name}: direct license dependency is not installed: ${name}`);
      continue;
    }
    const dependency = manifest(resolved);
    const identity = `${dependency.name}@${dependency.version}`;
    if (
      typeof dependency.license !== "string" ||
      !dependency.license.trim() ||
      /[\r\n]/.test(dependency.license) ||
      /^(?:SEE LICENSE IN\b|UNLICENSED$|UNKNOWN$|UNDEFINED$)/i.test(dependency.license.trim())
    )
      throw new Error(`${identity}: missing or ambiguous license identifier in package metadata`);
    const files = readdirSync(resolved, { withFileTypes: true })
      .filter((entry) => entry.isFile() && licenseFile.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    if (!files.length) throw new Error(`Installed package has no license file: ${identity}`);
    const links = files.map((file) => {
      if (!readFileSync(join(resolved, file), "utf8").trim())
        throw new Error(`Empty license file: ${identity}/${file}`);
      const url = range.startsWith("workspace:")
        ? relative(current, join(resolved, file))
            .replaceAll("\\", "/")
            .split("/")
            .map(encodeURIComponent)
            .join("/")
        : `https://unpkg.com/${dependency.name}@${encodeURIComponent(dependency.version)}/${encodeURIComponent(file)}`;
      return `[${markdown(file)}](${url})`;
    });
    rows.push([
      markdown(name),
      markdown(dependency.version),
      markdown(dependency.license),
      links.join(", "),
    ]);
  }
  if (!rows.length) return "No installed runtime or peer dependencies.";
  const headings = ["Package", "Installed version", "License", "License text"];
  const widths = headings.map((heading, index) =>
    Math.max(heading.length, ...rows.map((row) => row[index]!.length)),
  );
  const formatRow = (cells: string[]) =>
    `| ${cells.map((cell, index) => cell.padEnd(widths[index]!)).join(" | ")} |`;
  return [
    formatRow(headings),
    formatRow(widths.map((width) => "-".repeat(width))),
    ...rows.map(formatRow),
  ].join("\n");
}

function replaceIndex(readme: string, index: string, file: string): string {
  const start = readme.indexOf(indexStart);
  const end = readme.indexOf(indexEnd);
  if (
    start < 0 ||
    end < start ||
    readme.indexOf(indexStart, start + indexStart.length) >= 0 ||
    readme.indexOf(indexEnd, end + indexEnd.length) >= 0
  )
    throw new Error(
      `${file}: README needs exactly one ordered dependency license index marker pair`,
    );
  return `${readme.slice(0, start + indexStart.length)}\n\n${index}\n\n${readme.slice(end)}`;
}

/** Refresh or verify only the marked README indexes; LICENSE files are never modified. */
export function updatePackageLicenses(root: string, check = false): void {
  const updates = ["email-preview", "security", "themes", "ui"].map((name) => {
    const directory = join(root, "packages", name);
    const file = join(directory, "README.md");
    const original = readFileSync(file, "utf8");
    return {
      file,
      original,
      updated: replaceIndex(original, dependencyLicenseIndex(directory), file),
    };
  });
  // Validate every package before writing, so missing metadata never produces a partial update.
  for (const { file, original, updated } of updates) {
    if (check && updated !== original)
      throw new Error(`${file}: license index is stale; run bun run licenses:update`);
  }
  if (!check) {
    for (const { file, original, updated } of updates)
      if (updated !== original) writeFileSync(file, updated);
  }
}
