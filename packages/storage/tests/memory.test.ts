import { describe, expect, it } from "vite-plus/test";

import { describeDriver } from "./helpers/conformance.js";
import { createStorage } from "../src/index.js";
import { createMemoryDriver } from "../src/memory.js";

describeDriver("memory driver", () => createStorage(createMemoryDriver()));

describe("memory isolation", () => {
  it("does not share buffers with callers", async () => {
    const storage = createStorage(createMemoryDriver());
    const bytes = new Uint8Array([1, 2, 3]);
    await storage.put("a", bytes);
    bytes[0] = 9;
    const info = await storage.head("a");
    info!.metadata.x = "y";
    const object = await storage.get("a");
    expect(new Uint8Array(await new Response(object!.body).arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect((await storage.head("a"))!.metadata).toEqual({});
  });
});
