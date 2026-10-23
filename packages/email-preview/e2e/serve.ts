import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer, type Plugin, type ViteDevServer } from "vite";

const portIndex = process.argv.indexOf("--port");
const port = Number(portIndex < 0 ? 4174 : process.argv[portIndex + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid --port");

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const stateFile = fileURLToPath(
  new URL("../../../.artifacts/email-preview-e2e/state.json", import.meta.url),
);
const project = await mkdtemp(join(tmpdir(), "raypx-email-browser-"));
const emails = join(project, "emails");
let server: ViteDevServer | undefined;
let stopping: Promise<void> | undefined;

function stop(code = 0): Promise<void> {
  stopping ??= (async () => {
    await server?.close();
    await rm(project, { recursive: true, force: true });
    await rm(stateFile, { force: true });
    process.exitCode = code;
  })();
  return stopping;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const)
  process.once(signal, () => void stop());

try {
  await cp(join(packageRoot, "examples"), emails, {
    recursive: true,
    // The examples' own Vite configuration targets the package source.
    filter: (source) => !source.endsWith("vite.config.ts"),
  });
  await symlink(join(packageRoot, "node_modules"), join(project, "node_modules"), "dir");
  await writeFile(join(project, "package.json"), JSON.stringify({ private: true, type: "module" }));
  const welcome = join(emails, "welcome.tsx");
  const welcomeSource = (await readFile(welcome, "utf8")).replace(
    'name: "Alex"',
    'name: "Browser Reader"',
  );
  await writeFile(welcome, welcomeSource);
  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(
    stateFile,
    JSON.stringify({
      emails,
      welcomeSource,
      footerSource: await readFile(join(emails, "_components/footer.tsx"), "utf8"),
      markSource: await readFile(join(emails, "static/mark.svg"), "utf8"),
    }),
  );
  // Load the built package, as a project's `vite dev` would.
  const { emailPreview } = (await import(
    pathToFileURL(join(packageRoot, "dist/index.mjs")).href
  )) as { emailPreview: (options: { dir: string; base: string }) => Plugin };
  server = await createServer({
    configFile: false,
    root: project,
    appType: "custom",
    logLevel: "warn",
    resolve: { tsconfigPaths: true },
    server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
    plugins: [emailPreview({ dir: emails, base: "/" })],
  });
  await server.listen();
} catch (error) {
  console.error(error);
  await stop(1);
}
