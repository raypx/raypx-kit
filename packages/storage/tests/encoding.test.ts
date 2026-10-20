import { describe, expect, it } from "vite-plus/test";

import { toBase64Url, toHex } from "../src/internal/encoding.js";

describe("byte encodings", () => {
  it("matches Node's base64url and hex without Buffer", () => {
    for (const length of [0, 1, 2, 3, 31, 32, 255]) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 37 + 251) % 256);
      expect(toBase64Url(bytes)).toBe(Buffer.from(bytes).toString("base64url"));
      expect(toHex(bytes.buffer)).toBe(Buffer.from(bytes).toString("hex"));
    }
  });
});
