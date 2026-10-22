import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, readlink, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(
  fileURLToPath(import.meta.resolve("@raypx-kit/email-preview/package.json")),
);
const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
const cli = join(packageRoot, manifest.bin["raypx-email"]);
assert.ok((await readFile(cli, "utf8")).startsWith("#!/usr/bin/env node"));
const notices = await readFile(join(packageRoot, "dist", "THIRD_PARTY_LICENSES.txt"), "utf8");
const license = await readFile(join(packageRoot, "LICENSE"), "utf8");
assert.match(license, /Apache License/);
assert.doesNotMatch(license, /BEGIN GENERATED DEPENDENCY LICENSES/);
const readme = await readFile(join(packageRoot, "README.md"), "utf8");
for (const name of ["@react-email/render", "esbuild", "chokidar"])
  assert.ok(readme.includes(name), `Missing external dependency in README: ${name}`);
for (const name of [
  "react",
  "react-dom",
  "@tanstack/react-router",
  "nitro",
  "srvx",
  "ufo",
  "@raypx-kit/ui",
  "@raypx-kit/themes",
  "@shikijs/core",
  "tailwindcss",
  "tw-animate-css",
])
  assert.ok(notices.includes(`\n${name}@`), `Missing bundled license notice: ${name}`);
assert.match(notices, /Permission is hereby granted, free of charge/);
assert.match(notices, /Copyright \(c\) 2023 shadcn/);

// Keep the project beneath the isolated consumer so its own dependencies resolve.
const project = await mkdtemp(join(process.cwd(), ".email preview contract "));
const emails = join(project, "mail templates");
const helper = join(project, "shared", "message.ts");
const template = join(emails, "nested", "welcome.tsx");
let child;
let output = "";
let eventTask;
let eventError;
const events = new AbortController();
const changes = [];

async function snapshot(directory) {
  const hash = createHash("sha256");
  async function visit(path, prefix) {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const relative = `${prefix}/${entry.name}`;
      hash.update(relative);
      const absolute = join(path, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isSymbolicLink()) hash.update(await readlink(absolute));
      else hash.update(await readFile(absolute));
    }
  }
  await visit(directory, "");
  return hash.digest("hex");
}

async function freePort() {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function eventually(check, message, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null))
      throw new Error(`Preview exited early: ${output}`);
    if (eventError) throw eventError;
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  throw new Error(`${message}\n${String(lastError ?? "")}\n${output}`);
}

const source = `
import { useState } from "react";
import { Body, Html, Img, Text } from "@react-email/components";
import { message } from "@shared/message";
import { Footer } from "../_components/footer";
export default function Welcome({ name }) {
  const [greeting] = useState(message);
  return <Html><Body><Text>{greeting} {name}</Text><Img src="/static/mark.svg" alt="Mark" /><Footer /></Body></Html>;
}
Welcome.PreviewProps = { name: "Archive Reader" };
`;

const timer = setTimeout(() => {
  child?.kill("SIGKILL");
  throw new Error(`Email preview archive contract exceeded 90 seconds.\n${output}`);
}, 90_000);

try {
  await Promise.all([
    mkdir(join(emails, "nested"), { recursive: true }),
    mkdir(join(emails, "_components"), { recursive: true }),
    mkdir(join(emails, "static"), { recursive: true }),
    mkdir(join(project, "shared"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(project, "package.json"), JSON.stringify({ private: true, type: "module" })),
    writeFile(
      join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { jsx: "react-jsx", baseUrl: ".", paths: { "@shared/*": ["shared/*"] } },
      }),
    ),
    writeFile(helper, 'export const message = "Welcome from a shared import";\n'),
    writeFile(template, source),
    writeFile(
      join(emails, "plain.jsx"),
      "export default function Plain() { return <p>JSX archive template</p>; }\n",
    ),
    writeFile(
      join(emails, "_components", "footer.tsx"),
      "export function Footer() { return <p>Shared footer</p>; }\n",
    ),
    writeFile(join(emails, "_ignored.tsx"), "invalid source must not be discovered"),
    writeFile(
      join(emails, "static", "mark.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"><title>Archive Mark</title></svg>',
    ),
  ]);
  const before = await snapshot(packageRoot);
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const get = async (path) => {
    try {
      return await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      throw new Error(`GET ${path} failed.\n${output}`, { cause: error });
    }
  };
  const getJson = async (path) => {
    const response = await get(path);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const preview = () => getJson("/api/preview?template=nested%2Fwelcome.tsx");
  child = spawn(process.execPath, [cli, "dev", "--dir", emails, "--port", String(port)], {
    cwd: project,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NO_COLOR: "1" },
  });
  child.stdout.on("data", (data) => {
    output = `${output}${data}`.slice(-20_000);
  });
  child.stderr.on("data", (data) => {
    output = `${output}${data}`.slice(-20_000);
  });
  const closed = once(child, "exit");
  const inventory = await eventually(
    () => getJson("/api/templates"),
    "Preview did not become ready",
  );
  assert.deepEqual(inventory.templates.map(({ id }) => id).sort(), [
    "nested/welcome.tsx",
    "plain.jsx",
  ]);

  const page = await get("/?template=nested%2Fwelcome.tsx");
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<html/i);
  const assets = [
    ...new Set(
      [...html.matchAll(/(?:href|src)=["']([^"']*\/assets\/[^"']+)["']/g)].map((match) => match[1]),
    ),
  ];
  assert.ok(
    assets.some((asset) => /\.js(?:\?|$)/.test(asset)),
    "Packaged UI must reference JavaScript assets",
  );
  for (const asset of assets) {
    const response = await fetch(new URL(asset, origin), { signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, 200, `Missing packaged UI asset: ${asset}`);
    assert.ok((await response.text()).length > 0, `Empty packaged UI asset: ${asset}`);
  }

  const rendered = await preview();
  assert.match(rendered.html, /Welcome from a shared import/);
  assert.match(rendered.html, /Archive Reader/);
  assert.match(rendered.html, /Shared footer/);
  assert.match(rendered.formattedHtml, /\n\s+</);
  assert.match(rendered.formattedHtml, /Welcome from a shared import/);
  assert.match(rendered.text, /Welcome from a shared import Archive Reader/);
  assert.match((await getJson("/api/preview?template=plain.jsx")).text, /JSX archive template/);
  const staticAsset = await get("/static/mark.svg");
  assert.equal(staticAsset.status, 200);
  assert.match(staticAsset.headers.get("content-type") ?? "", /image\/svg\+xml/);
  assert.match(await staticAsset.text(), /Archive Mark/);

  const stream = await fetch(`${origin}/api/events`, { signal: events.signal });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get("content-type") ?? "", /text\/event-stream/);
  const reader = stream.body.getReader();
  eventTask = (async () => {
    const decoder = new TextDecoder();
    let pending = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true }).replaceAll("\r\n", "\n");
      let boundary;
      while ((boundary = pending.indexOf("\n\n")) >= 0) {
        const event = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        if (/^event: ?change$/m.test(event)) {
          const payload = event.match(/^data: ?(.+)$/m)?.[1];
          if (payload) changes.push(JSON.parse(payload));
        }
      }
    }
  })().catch((error) => {
    if (!events.signal.aborted) eventError = error;
  });

  const changeCount = changes.length;
  await writeFile(helper, 'export const message = "Updated shared import";\n');
  await eventually(
    () => changes.length > changeCount,
    "Shared imports did not emit a change event",
  );
  assert.ok(changes.at(-1).revision !== undefined);
  await eventually(
    async () => /Updated shared import/.test((await preview()).text),
    "Shared import changes were cached",
  );

  const beforeAssetChange = changes.length;
  await writeFile(
    join(emails, "static", "mark.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"><title>Updated Archive Mark</title></svg>',
  );
  await eventually(
    () => changes.length > beforeAssetChange,
    "Static asset changes did not emit a change event",
  );
  assert.match(await (await get("/static/mark.svg")).text(), /Updated Archive Mark/);

  await writeFile(template, "export default function Broken( {");
  await eventually(
    async () => (await get("/api/preview?template=nested%2Fwelcome.tsx")).status >= 400,
    "Invalid template did not report an error",
  );
  assert.match((await getJson("/api/preview?template=plain.jsx")).text, /JSX archive template/);
  await writeFile(template, source.replace("Archive Reader", "Recovered Reader"));
  await eventually(
    async () => /Recovered Reader/.test((await preview()).text),
    "Template did not recover after fixing its source",
  );

  const added = join(emails, "new.jsx");
  await writeFile(
    added,
    "export default function New() { return <p>A newly created template</p>; }\n",
  );
  await eventually(
    async () => (await getJson("/api/templates")).templates.some(({ id }) => id === "new.jsx"),
    "New template was not discovered",
  );
  await rm(added);
  await eventually(
    async () => !(await getJson("/api/templates")).templates.some(({ id }) => id === "new.jsx"),
    "Deleted template remained in the list",
  );

  events.abort();
  await eventTask;
  child.kill("SIGINT");
  const [code, signal] = await Promise.race([
    closed,
    delay(8_000, undefined, { ref: false }).then(() => {
      throw new Error(`CLI did not stop after SIGINT.\n${output}`);
    }),
  ]);
  assert.ok(
    code === 0 || code === 130 || signal === "SIGINT",
    `Unexpected CLI exit: ${code} ${signal}\n${output}`,
  );
  child = undefined;
  await assert.rejects(() =>
    fetch(`${origin}/api/templates`, { signal: AbortSignal.timeout(500) }),
  );
  assert.equal(
    await snapshot(packageRoot),
    before,
    "Running the CLI changed its installed package",
  );
} finally {
  clearTimeout(timer);
  events.abort();
  if (eventTask) await eventTask.catch(() => {});
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
  }
  await rm(project, { recursive: true, force: true });
}
