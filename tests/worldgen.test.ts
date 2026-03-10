import { describe, expect, test } from "vitest";

import { BiomeType, TerrainType } from "../src/shared/gameTypes";
import { generateWorld } from "../src/sim/worldgen";

function checksum(values: Uint8Array | Uint16Array): number {
  let sum = 0;
  const step = Math.max(1, Math.floor(values.length / 2048));
  for (let i = 0; i < values.length; i += step) {
    sum = (sum * 131 + values[i]!) % 2147483647;
  }
  return sum;
}

describe("world generation", () => {
  test("is deterministic for the same seed", () => {
    const worldA = generateWorld("same-seed", 256, 256);
    const worldB = generateWorld("same-seed", 256, 256);

    expect(checksum(worldA.elevation)).toBe(checksum(worldB.elevation));
    expect(checksum(worldA.terrain)).toBe(checksum(worldB.terrain));
    expect(checksum(worldA.biome)).toBe(checksum(worldB.biome));
    expect(checksum(worldA.feature)).toBe(checksum(worldB.feature));
    expect(checksum(worldA.undergroundTerrain)).toBe(checksum(worldB.undergroundTerrain));
    expect(checksum(worldA.undergroundFeature)).toBe(checksum(worldB.undergroundFeature));
  });

  test("creates water, land, and biome variety", () => {
    const world = generateWorld("variety-seed", 320, 320);
    const terrainKinds = new Set(world.terrain);
    const biomeKinds = new Set(world.biome);

    const waterTiles = world.terrain.reduce((sum, terrain) => {
      return sum + (terrain <= 2 ? 1 : 0);
    }, 0);
    const desertTiles = world.biome.reduce((sum, biome) => {
      return sum + (biome === BiomeType.Desert ? 1 : 0);
    }, 0);
    const marshTiles = world.biome.reduce((sum, biome) => {
      return sum + (biome === BiomeType.Marshland ? 1 : 0);
    }, 0);
    const volcanicTiles = world.biome.reduce((sum, biome) => {
      return sum + (biome === BiomeType.VolcanicHighland ? 1 : 0);
    }, 0);
    const ashTiles = world.biome.reduce((sum, biome) => {
      return sum + (biome === BiomeType.AshWaste ? 1 : 0);
    }, 0);
    const archipelagoTiles = world.biome.reduce((sum, biome) => {
      return sum + (biome === BiomeType.Archipelago ? 1 : 0);
    }, 0);
    const cavernishTiles = world.undergroundTerrain.reduce((sum, tile) => {
      return sum + (tile === 2 || tile === 5 ? 1 : 0);
    }, 0);

    expect(terrainKinds.size).toBeGreaterThan(8);
    expect(biomeKinds.size).toBeGreaterThan(8);
    expect(waterTiles).toBeGreaterThan(320 * 320 * 0.08);
    expect(desertTiles).toBeGreaterThan(160);
    expect(marshTiles).toBeGreaterThan(120);
    expect(volcanicTiles).toBeGreaterThan(120);
    expect(ashTiles).toBeGreaterThan(120);
    expect(archipelagoTiles).toBeGreaterThan(400);
    expect(cavernishTiles).toBeGreaterThan(180);
    expect(world.candidateStarts.length).toBeGreaterThan(8);
  });

  test("temporary no-river mode avoids inland river strips", () => {
    const world = generateWorld("river-disabled", 320, 320);
    const riverTiles = world.terrain.reduce((sum, terrain) => {
      return sum + (terrain === TerrainType.River ? 1 : 0);
    }, 0);
    expect(riverTiles).toBe(0);
  });
});
