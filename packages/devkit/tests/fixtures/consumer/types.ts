import { checkArchitecture } from "@raypx-kit/devkit/architecture";
import {
  discover,
  type DiscoverOptions,
  type Metadata,
  type WorkspaceIndex,
} from "@raypx-kit/devkit/workspaces";

const metadata = {
  "packages/library": {
    kind: "library",
    target: "node",
    sourceEntries: { ".": "./src/index.ts" },
  },
} as const satisfies Readonly<Record<string, Metadata>>;

// Checked against the installed tarball, without workspace source aliases.
export function workspaceConfigContract(root: string) {
  const options = { metadata } satisfies DiscoverOptions;
  const index: WorkspaceIndex = discover(root, options);
  const findings: string[] = checkArchitecture(index);
  const legacy: WorkspaceIndex = discover(root, { metadataKey: "customPolicy" });
  // @ts-expect-error Workspace targets must be one of the supported platforms.
  const invalidTarget: Metadata["target"] = "desktop";
  // @ts-expect-error Supplied metadata must contain workspace metadata values.
  const invalidOptions: DiscoverOptions = { metadata: { "packages/library": "node" } };
  return { index, findings, legacy, invalidTarget, invalidOptions };
}
