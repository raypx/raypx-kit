import { describe, expect, it } from "vite-plus/test";
import { prereleaseDistTag } from "../../../scripts/release/tags.js";

describe("prerelease dist-tag", () => {
  it("moves latest while a package has only prereleases, including npm's staging placeholder", () => {
    expect(prereleaseDistTag([], "alpha")).toBe("latest");
    expect(prereleaseDistTag(["0.0.0-alpha.0"], "alpha")).toBe("latest");
    expect(prereleaseDistTag(["0.0.0-stage", "0.0.0-alpha.0"], "alpha")).toBe("latest");
  });

  it("keeps latest on the stable release once one exists", () => {
    expect(prereleaseDistTag(["0.0.0-alpha.3", "0.0.0", "0.0.1-alpha.0"], "alpha")).toBe("alpha");
  });
});
