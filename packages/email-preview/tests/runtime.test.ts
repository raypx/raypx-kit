import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { emailPreview } from "../src/server/plugin.js";
import { PreviewRuntime } from "../src/server/runtime.js";

const require = createRequire(import.meta.url);
const directories: string[] = [];
const servers: ViteDevServer[] = [];

async function linkReact(root: string) {
  for (const name of ["react", "react-dom"]) {
    await symlink(
      dirname(require.resolve(`${name}/package.json`)),
      join(root, "node_modules", name),
      "dir",
    );
  }
}

async function fixture(timeout = 10_000, createEmails = true, installReact = true, watch = true) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "email runtime ")));
  directories.push(root);
  const emails = join(root, "nested emails");
  if (createEmails) await mkdir(emails);
  await mkdir(join(root, "shared"));
  await mkdir(join(root, "node_modules"));
  if (installReact) await linkReact(root);
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "email-consumer", private: true, type: "module" }),
  );
  await writeFile(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { jsx: "react-jsx", baseUrl: ".", paths: { "@shared/*": ["./shared/*"] } },
    }),
  );
  const plugin = emailPreview({ dir: emails, renderTimeoutMs: timeout });
  const server = await createServer({
    configFile: false,
    root,
    appType: "custom",
    logLevel: "silent",
    resolve: { tsconfigPaths: true },
    server: { middlewareMode: true, hmr: false, ...(watch ? {} : { watch: null }) },
    plugins: [plugin],
  });
  servers.push(server);
  const runtime = (await (plugin.api as { runtime: () => Promise<PreviewRuntime> }).runtime())!;
  if (watch) {
    // createServer returns before Chokidar's initial scan finishes on Linux.
    // Observe a real watcher round trip before asserting later change notifications.
    const probe = join(createEmails ? emails : root, ".watcher-ready");
    let observed = false,
      sequence = 0;
    const ready = (_event: string, path: string) => {
      if (path === probe) observed = true;
    };
    server.watcher.on("all", ready);
    try {
      await expect
        .poll(
          async () => {
            await writeFile(probe, String(++sequence));
            return observed;
          },
          { timeout: 8_000 },
        )
        .toBe(true);
      // Drain the preview's debounce so readiness events cannot satisfy a later assertion.
      if (createEmails) await changed(runtime, () => rm(probe));
      else await rm(probe);
    } finally {
      server.watcher.off("all", ready);
    }
  }
  return { root, emails, runtime, server };
}

async function changed(runtime: PreviewRuntime, mutate: () => Promise<void>) {
  const previous = runtime.revision;
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const event = new Promise<void>((resolve, reject) => {
    unsubscribe = runtime.subscribe((revision) => {
      if (revision > previous) resolve();
    });
    timer = setTimeout(() => reject(new Error("No template change event received")), 8_000);
  });
  try {
    await mutate();
    await event;
  } finally {
    unsubscribe?.();
    clearTimeout(timer);
  }
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("preview runtime", () => {
  it("formats source independently, preserves Outlook comments, and tolerates invalid HTML", async () => {
    const { emails, runtime } = await fixture();
    const comment = "<!--[if mso]><p>Outlook only</p><![endif]-->";
    const source = (markup: string) =>
      `export default () => <html><body dangerouslySetInnerHTML={{ __html: ${JSON.stringify(markup)} }} /></html>;`;
    await writeFile(join(emails, "outlook.jsx"), source(`${comment}<p>Original email</p>`));
    const rendered = await runtime.renderTemplate("outlook.jsx");
    expect(rendered.html).toContain(comment);
    expect(rendered.html).not.toContain("\n");
    expect(rendered.formattedHtml).toContain(comment);
    expect(rendered.formattedHtml).toContain("\n");
    expect(rendered.formattedHtml).not.toBe(rendered.html);
    expect(rendered.text).toContain("Original email");

    await changed(runtime, () =>
      writeFile(join(emails, "outlook.jsx"), source("<div><span>Malformed source</div>")),
    );
    const malformed = await runtime.renderTemplate("outlook.jsx");
    expect(malformed.formattedHtml).toBe(malformed.html);
    expect(malformed.text).toContain("Malformed source");
  });

  it("starts with an absent directory and discovers templates when it is created", async () => {
    const { emails, runtime } = await fixture(10_000, false);
    expect((await runtime.listTemplates()).templates).toEqual([]);
    await changed(runtime, async () => {
      await mkdir(emails);
      await writeFile(join(emails, "first.tsx"), "export default () => <p>First email</p>;");
    });
    expect((await runtime.listTemplates()).templates[0]?.id).toBe("first.tsx");
    expect((await runtime.renderTemplate("first.tsx")).html).toContain("First email");
  });

  it("renders PreviewProps, consumer hooks, and tsconfig aliases with the project React", async () => {
    const { root, emails, runtime } = await fixture();
    await writeFile(join(root, "shared", "label.ts"), 'export const label = "First version";');
    await writeFile(
      join(emails, "welcome.tsx"),
      `import { useState } from "react";
import { label } from "@shared/label";
export default function Welcome({ name }: { name: string }) {
  const [greeting] = useState(label);
  return <html><body><h1>{greeting}, {name}</h1></body></html>;
}
Welcome.PreviewProps = { name: "Ada" };`,
    );
    const first = await runtime.renderTemplate("welcome.tsx");
    expect(first.html).toContain("First version");
    expect(first.text.toLowerCase()).toContain("ada");
    await changed(runtime, () =>
      writeFile(
        join(root, "shared", "label.ts"),
        'export const label = "Updated shared component";',
      ),
    );
    const next = await runtime.renderTemplate("welcome.tsx");
    expect(next.html).toContain("Updated shared component");
    expect(next.html).not.toContain("First version");
    expect(next.revision).toBeGreaterThan(first.revision);
    await mkdir(join(root, "replacement"));
    await writeFile(join(root, "replacement", "label.ts"), 'export const label = "Changed alias";');
    await changed(runtime, () =>
      writeFile(
        join(root, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            jsx: "react-jsx",
            baseUrl: ".",
            paths: { "@shared/*": ["./replacement/*"] },
          },
        }),
      ),
    );
    expect((await runtime.renderTemplate("welcome.tsx")).html).toContain("Changed alias");
  }, 20_000);

  it("recovers from compilation errors and supports JSX", async () => {
    const { emails, runtime } = await fixture();
    await writeFile(join(emails, "broken.jsx"), "export default function Broken() { return <div>;");
    await expect(runtime.renderTemplate("broken.jsx")).rejects.toMatchObject({
      code: "COMPILE_ERROR",
      status: 422,
    });
    await changed(runtime, () =>
      writeFile(join(emails, "broken.jsx"), "export default () => <p>Repaired template</p>;"),
    );
    expect((await runtime.renderTemplate("broken.jsx")).text).toContain("Repaired template");
    await writeFile(join(emails, "missing.jsx"), "export const helper = 1;");
    await expect(runtime.renderTemplate("missing.jsx")).rejects.toMatchObject({
      code: "RENDER_ERROR",
    });
  }, 20_000);

  it("recovers when the watcher drops a repair inside its change throttle", async () => {
    // Vite reports the broken save, the failed render is cached, and the repair lands
    // inside the watcher's change throttle, as on Linux. Real watching is off; a runtime on
    // a scripted watcher replays that sequence with a window wide enough for slow runners.
    const { emails, server } = await fixture(10_000, true, true, false);
    const watcher = Object.assign(new EventEmitter(), { add() {} });
    const scripted = new Proxy(server, {
      get: (target, key) => (key === "watcher" ? watcher : Reflect.get(target, key)),
    });
    const runtime = await PreviewRuntime.create(scripted, {
      directory: emails,
      renderTimeoutMs: 10_000,
      missedChangeWindowMs: 1_000,
    });
    try {
      const file = join(emails, "quick.jsx");
      await writeFile(file, "export default function Broken() { return <div>;");
      watcher.emit("all", "change", file);
      await expect(runtime.renderTemplate("quick.jsx")).rejects.toMatchObject({
        code: "COMPILE_ERROR",
      });
      await writeFile(file, "export default () => <p>Quick repair</p>;");
      const deadline = Date.now() + 3_000;
      let text = "";
      while (Date.now() < deadline && !text.includes("Quick repair")) {
        text = await runtime.renderTemplate("quick.jsx").then(
          (result) => result.text,
          () => "",
        );
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(text).toContain("Quick repair");
    } finally {
      runtime.close();
    }
  });

  it("recovers once React is installed without restarting", async () => {
    const { root, emails, runtime } = await fixture(10_000, true, false);
    await writeFile(join(emails, "welcome.jsx"), "export default () => <p>Installed</p>;");
    await expect(runtime.renderTemplate("welcome.jsx")).rejects.toMatchObject({
      code: "DEPENDENCY_ERROR",
    });
    await linkReact(root);
    expect((await runtime.renderTemplate("welcome.jsx")).text).toContain("Installed");
  });

  it("publishes directory and static-file changes and rejects unknown template IDs", async () => {
    const { emails, runtime } = await fixture();
    expect((await runtime.listTemplates()).templates).toEqual([]);
    await changed(runtime, () => writeFile(join(emails, "new.tsx"), "export default () => null;"));
    expect((await runtime.listTemplates()).templates[0]?.id).toBe("new.tsx");
    await changed(runtime, () => rm(join(emails, "new.tsx")));
    expect((await runtime.listTemplates()).templates).toEqual([]);
    await expect(runtime.renderTemplate("../new.tsx")).rejects.toMatchObject({ status: 404 });
    await changed(runtime, () => mkdir(join(emails, "static")));
    await changed(runtime, () => writeFile(join(emails, "static", "logo.svg"), "<svg/>"));
    expect((await runtime.getStaticFile("logo.svg")).contentType).toBe("image/svg+xml");
  });

  it("reports a template that never settles and closes the runtime cleanly", async () => {
    const { emails, runtime } = await fixture(100);
    await writeFile(
      join(emails, "pending.tsx"),
      "await new Promise(() => {});\nexport default function Pending() { return null; }",
    );
    await expect(runtime.renderTemplate("pending.tsx")).rejects.toMatchObject({
      code: "RENDER_TIMEOUT",
    });
    runtime.close();
    runtime.close();
    await expect(runtime.listTemplates()).rejects.toMatchObject({ status: 503 });
  }, 20_000);
});
