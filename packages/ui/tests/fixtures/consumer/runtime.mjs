import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "@tailwindcss/node";
import * as ui from "@raypx-kit/ui";
import { Button } from "@raypx-kit/ui/components/ui/button";
import { Input } from "@raypx-kit/ui/components/ui/input";
import { Badge } from "@raypx-kit/ui/components/ui/badge";
import { Dialog } from "@raypx-kit/ui/components/ui/dialog";
import { Tabs } from "@raypx-kit/ui/components/ui/tabs";
import { Skeleton } from "@raypx-kit/ui/components/ui/skeleton";
import { NativeSelect } from "@raypx-kit/ui/components/ui/native-select";
import { cn } from "@raypx-kit/ui/lib/utils";

assert.equal(ui.Button, Button);
for (const component of [Input, Badge, Dialog, Tabs, Skeleton, NativeSelect])
  assert.equal(typeof component, "function");
assert.equal(cn("h-8", "h-12"), "h-12");
assert.match(renderToStaticMarkup(createElement(Button, null, "Save changes")), /type="button"/);
assert.match(
  renderToStaticMarkup(createElement(Input, { "aria-label": "Email" })),
  /aria-label="Email"/,
);
assert.match(
  renderToStaticMarkup(createElement(Badge, { variant: "destructive" }, "Failed")),
  /text-destructive-text/,
);

const stylesheet = fileURLToPath(import.meta.resolve("@raypx-kit/ui/styles.css"));
const css = await readFile(stylesheet, "utf8");
assert.match(css, /@source\s+["']\.\/dist["']/);
assert.doesNotMatch(css, /@import\s+["']tailwindcss["']/);
const entry = fileURLToPath(import.meta.resolve("@raypx-kit/ui/components/ui/button"));
assert.match(await readFile(entry, "utf8"), /["']use client["']/);

const compiler = await compile('@import "tailwindcss";\n@import "@raypx-kit/ui/styles.css";', {
  base: dirname(fileURLToPath(import.meta.url)),
  onDependency() {},
});
const output = compiler.build([
  "bg-primary",
  "text-destructive-text",
  "rounded-lg",
  "motion-reduce:animate-none",
]);
assert.match(output, /\.bg-primary/);
assert.match(output, /var\(--primary\)/);
assert.match(output, /\.text-destructive-text/);
assert.match(output, /prefers-reduced-motion/);
