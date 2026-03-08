import { describe, expect, test } from "vitest";

import { createRuntimeSeed } from "../src/shared/seed";

describe("runtime seeds", () => {
  test("generate a fresh seed string for each call", () => {
    const seedA = createRuntimeSeed();
    const seedB = createRuntimeSeed();

    expect(seedA).toMatch(/^fantasim-/);
    expect(seedB).toMatch(/^fantasim-/);
    expect(seedA).not.toBe(seedB);
  });
});
