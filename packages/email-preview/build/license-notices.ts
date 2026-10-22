import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

interface PackageNotice {
  name: string;
  version: string;
  files: { name: string; text: string }[];
}

interface BundleEntry {
  type: string;
  modules?: Record<string, unknown>;
}

const licenseFile = /^(?:licen[cs]e|copying|notice|third[-_]party[-_]licenses?)(?:[.\-_]|$)/i;

/** Share one instance between Vite and Nitro so notices cover client, SSR and server code. */
export function licenseNotices(
  outputFile: string,
  assetPackages: { name: string; importer: string }[] = [],
) {
  const packages = new Map<string, PackageNotice>();
  const included = new Set<string>();
  const owners = new Map<string, string | undefined>();

  function owner(id: string): string | undefined {
    if (id.startsWith("\0")) return;
    const file = (id.startsWith("file:") ? fileURLToPath(id) : id).split("?")[0]!;
    // Workspace libraries can also be bundled into the app; their licenses must
    // travel with the payload just like dependencies resolved from node_modules.
    if (!isAbsolute(file)) return;
    if (owners.has(file)) return owners.get(file);
    let current = dirname(file);
    const root = parse(current).root;
    while (current !== root) {
      if (existsSync(join(current, "package.json"))) {
        const manifest = JSON.parse(readFileSync(join(current, "package.json"), "utf8")) as {
          name?: string;
          version?: string;
        };
        // A nested package.json may only set CommonJS/ESM semantics.
        if (manifest.name && manifest.version) {
          owners.set(file, current);
          return current;
        }
      }
      current = dirname(current);
    }
    owners.set(file, undefined);
  }

  function collect(directory: string) {
    if (packages.has(directory)) return;
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as {
      name?: string;
      version?: string;
    };
    if (!manifest.name || !manifest.version)
      throw new Error(`Missing package identity: ${directory}`);
    // Nitro's generated modules live below our node_modules cache, but belong to
    // this package. Reading its dist notices would recursively copy prior builds.
    if (manifest.name === "@raypx-kit/email-preview") return;
    const identity = `${manifest.name}@${manifest.version}`;
    if (included.has(identity)) return;
    const paths = readdirSync(directory).filter((name) => licenseFile.test(name));
    // Nitro includes notices for dependencies already bundled into its published files.
    for (const name of [
      "THIRD-PARTY-LICENSES.md",
      "THIRD-PARTY-LICENSES.md.gz",
      "THIRD_PARTY_LICENSES.txt",
    ]) {
      if (existsSync(join(directory, "dist", name))) paths.push(`dist/${name}`);
    }
    if (paths.length === 0) {
      // Nitro's reduced ufo copy omits its license and its bundled-notice file
      // does not cover ufo. Retain the exact installed upstream version's text.
      if (manifest.name === "ufo" && manifest.version === "1.6.4") {
        packages.set(directory, {
          name: manifest.name,
          version: manifest.version,
          files: [
            {
              name: "LICENSE (retained from ufo@1.6.4)",
              text: readFileSync(new URL("./licenses/ufo-1.6.4.txt", import.meta.url), "utf8"),
            },
          ],
        });
        included.add(identity);
        return;
      }
      throw new Error(`Bundled package has no license file: ${manifest.name}`);
    }
    packages.set(directory, {
      name: manifest.name,
      version: manifest.version,
      files: paths.sort().map((name) => {
        const contents = readFileSync(join(directory, name));
        return {
          name,
          text: (name.endsWith(".gz") ? gunzipSync(contents) : contents).toString("utf8"),
        };
      }),
    });
    included.add(identity);
  }

  return {
    name: "email-preview-license-notices",
    generateBundle(_options: unknown, bundle: Record<string, BundleEntry>) {
      for (const entry of Object.values(bundle)) {
        if (entry.type !== "chunk") continue;
        for (const id of Object.keys(entry.modules ?? {})) {
          const directory = owner(id);
          if (directory) collect(directory);
        }
      }
      // Tailwind expands CSS imports before the emitted JS module graph. Retain
      // notices for those explicit asset owners, including style-only exports.
      for (const { name, importer } of assetPackages) {
        const directory = (createRequire(importer).resolve.paths(name) ?? [])
          .map((search) => join(search, name))
          .find((candidate) => existsSync(join(candidate, "package.json")));
        if (!directory) throw new Error(`Bundled asset package is not installed: ${name}`);
        collect(directory);
      }
      if (packages.size === 0) return;
      const text = [...packages.values()]
        .sort((left, right) =>
          `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`),
        )
        .map(({ name, version, files }) =>
          [
            `${name}@${version}`,
            "=".repeat(72),
            ...files.flatMap((file) => [`--- ${file.name} ---`, file.text]),
          ].join("\n\n"),
        )
        .join("\n\n");
      mkdirSync(dirname(outputFile), { recursive: true });
      writeFileSync(outputFile, `Third-party notices for bundled Email Preview code.\n\n${text}\n`);
    },
  };
}
