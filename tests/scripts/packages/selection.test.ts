import { expect, it } from "vite-plus/test";
import { archiveSelection } from "../../../scripts/packages/selection.js";

it("packs transitive local dependencies and fixture peers without requiring unrelated builds", () => {
  const packages = [
    { name: "app", dependencies: { core: "workspace:*" }, fixtureDependencies: { ui: "*" } },
    { name: "core", optionalDependencies: { config: "*" } },
    { name: "config", peerDependencies: { core: "*" } },
    { name: "ui" },
    { name: "unrelated" },
  ];
  expect([...archiveSelection(packages, ["app"])]).toEqual(["app", "core", "config", "ui"]);
  expect(archiveSelection(packages).size).toBe(5);
});

it("fails on unknown requested packages instead of silently checking nothing", () => {
  expect(() => archiveSelection([{ name: "known" }], ["missing"])).toThrow(
    "Unknown public package",
  );
});
