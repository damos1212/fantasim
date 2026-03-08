import { describe, expect, test } from "vitest";

import { BiomeType, TerrainType } from "../src/shared/gameTypes";
import { generateWorld } from "../src/sim/worldgen";
import { indexOf } from "../src/shared/grid";

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
    const riverTiles = world.terrain.reduce((sum, terrain) => {
      return sum + (terrain === 2 ? 1 : 0);
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
    expect(riverTiles).toBeGreaterThan(64);
    expect(desertTiles).toBeGreaterThan(160);
    expect(marshTiles).toBeGreaterThan(120);
    expect(volcanicTiles).toBeGreaterThan(120);
    expect(ashTiles).toBeGreaterThan(120);
    expect(archipelagoTiles).toBeGreaterThan(400);
    expect(cavernishTiles).toBeGreaterThan(180);
    expect(world.candidateStarts.length).toBeGreaterThan(8);
  });

  test("river networks are mostly connected and not dominated by stray strips", () => {
    const world = generateWorld("river-coherence", 320, 320);
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const;
    const visited = new Uint8Array(world.width * world.height);
    let riverTiles = 0;
    let orphanTiles = 0;

    for (let index = 0; index < world.terrain.length; index += 1) {
      if (world.terrain[index] !== TerrainType.River || visited[index]) continue;
      let touchesWater = false;
      let size = 0;
      const stack = [index];
      visited[index] = 1;
      while (stack.length > 0) {
        const current = stack.pop()!;
        size += 1;
        const x = current % world.width;
        const y = Math.floor(current / world.width);
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
          const neighbor = indexOf(nx, ny, world.width);
          const terrain = world.terrain[neighbor] as TerrainType;
          if (terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow) {
            touchesWater = true;
          }
          if (terrain === TerrainType.River && !visited[neighbor]) {
            visited[neighbor] = 1;
            stack.push(neighbor);
          }
        }
      }
      riverTiles += size;
      if (!touchesWater) {
        orphanTiles += size;
      }
    }

    expect(riverTiles).toBeGreaterThan(40);
    expect(orphanTiles / riverTiles).toBeLessThan(0.12);
  });
});
