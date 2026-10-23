import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vite-plus/test";
import { licenseNotices } from "../build/license-notices.js";

describe("bundled license notices", () => {
  it("retains complete licenses across client/server builds and expands bundled notices", () => {
    const root = mkdtempSync(join(tmpdir(), "email-preview-licenses-"));
    try {
      const output = join(root, "dist", "THIRD_PARTY_LICENSES.txt");
      const addPackage = (name: string, license: string, parent = "node_modules") => {
        const directory = join(root, parent, name);
        mkdirSync(join(directory, "dist"), { recursive: true });
        writeFileSync(join(directory, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
        writeFileSync(join(directory, "LICENSE"), license);
        return directory;
      };
      const client = addPackage("client", "Client copyright\nComplete client license\n");
      const server = addPackage("server", "Server copyright\nComplete server license\n");
      const workspace = addPackage("ui", "Workspace UI license\n", "packages");
      writeFileSync(join(workspace, "THIRD_PARTY_LICENSES.txt"), "Full shadcn license\n");
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({
          name: "@raypx-kit/email-preview",
          version: "0.0.0-alpha.0",
          dependencies: { external: "1.0.0" },
        }),
      );
      writeFileSync(join(root, "LICENSE"), "Own package license\n");
      const external = addPackage("external", "External runtime license\n");
      const stylesheet = addPackage("stylesheet", "Complete stylesheet license\n");
      writeFileSync(join(server, "dist", "package.json"), '{"type":"module"}');
      writeFileSync(
        join(server, "dist", "THIRD-PARTY-LICENSES.md.gz"),
        gzipSync("Bundled dependency license\n"),
      );
      const plugin = licenseNotices(output, [
        { name: "stylesheet", importer: join(root, "package.json") },
      ]);
      plugin.generateBundle(
        {},
        { client: { type: "chunk", modules: { [join(client, "index.js")]: {} } } },
      );
      plugin.generateBundle(
        {},
        {
          generated: {
            type: "chunk",
            modules: { [join(root, "node_modules", ".cache", "index.js")]: {} },
          },
        },
      );
      plugin.generateBundle(
        {},
        { server: { type: "chunk", modules: { [join(server, "dist", "index.js")]: {} } } },
      );
      plugin.generateBundle(
        {},
        { workspace: { type: "chunk", modules: { [join(workspace, "dist", "button.js")]: {} } } },
      );
      const notices = readFileSync(output, "utf8");
      expect(notices).toContain("Client copyright\nComplete client license\n");
      expect(notices).toContain("Server copyright\nComplete server license\n");
      expect(notices).toContain("Bundled dependency license\n");
      expect(notices).toContain("Workspace UI license\n");
      expect(notices).toContain("Full shadcn license\n");
      expect(notices).toContain("Complete stylesheet license\n");
      expect(notices.match(/client@1\.0\.0/g)).toHaveLength(1);
      expect(notices).not.toContain("Own package license");
      expect(notices).not.toContain("External runtime license");
      expect(readFileSync(join(root, "LICENSE"), "utf8")).toBe("Own package license\n");
      expect(readFileSync(join(external, "LICENSE"), "utf8")).toBe("External runtime license\n");
      expect(readFileSync(join(stylesheet, "LICENSE"), "utf8")).toBe(
        "Complete stylesheet license\n",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails packaging when an included third-party package has no license", () => {
    const root = mkdtempSync(join(tmpdir(), "email-preview-unlicensed-"));
    try {
      const directory = join(root, "node_modules", "missing-license");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "package.json"),
        JSON.stringify({ name: "missing-license", version: "1.0.0" }),
      );
      const plugin = licenseNotices(join(root, "notices.txt"));
      expect(() =>
        plugin.generateBundle(
          {},
          { chunk: { type: "chunk", modules: { [join(directory, "index.js")]: {} } } },
        ),
      ).toThrow("Bundled package has no license file: missing-license");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
