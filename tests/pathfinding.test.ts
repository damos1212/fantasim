import { describe, expect, test } from "vitest";

import { findPath } from "../src/sim/pathfinding";
import { BiomeType, FeatureType, TerrainType, UndergroundFeatureType, UndergroundTerrainType } from "../src/shared/gameTypes";
import { WorldData } from "../src/sim/worldgen";

function makeWorld(width: number, height: number): WorldData {
  const count = width * height;
  return {
    width,
    height,
    terrain: new Uint8Array(count).fill(TerrainType.Grass),
    biome: new Uint8Array(count).fill(BiomeType.TemperatePlains),
    feature: new Uint8Array(count).fill(FeatureType.None),
    fertility: new Uint8Array(count).fill(128),
    temperature: new Uint8Array(count).fill(128),
    moisture: new Uint8Array(count).fill(128),
    elevation: new Uint8Array(count).fill(128),
    surfaceWater: new Uint8Array(count),
    undergroundTerrain: new Uint8Array(count).fill(UndergroundTerrainType.SolidRock),
    undergroundFeature: new Uint8Array(count).fill(UndergroundFeatureType.None),
    undergroundResourceType: new Uint8Array(count),
    undergroundResourceAmount: new Uint16Array(count),
    volcanic: new Uint8Array(count),
    road: new Uint8Array(count),
    owner: new Int16Array(count).fill(-1),
    resourceType: new Uint8Array(count),
    resourceAmount: new Uint16Array(count),
    buildingByTile: new Int32Array(count).fill(-1),
    candidateStarts: [],
  };
}

describe("pathfinding", () => {
  test("routes around impassable water", () => {
    const world = makeWorld(10, 10);
    for (let y = 1; y < 9; y += 1) {
      world.terrain[y * 10 + 4] = TerrainType.WaterDeep;
    }
    world.terrain[5 * 10 + 4] = TerrainType.Grass;

    const path = findPath(world, 1, 1, 8, 8);
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((index) => index === 5 * 10 + 4)).toBe(true);
  });

  test("prefers roads when available", () => {
    const world = makeWorld(12, 6);
    for (let x = 1; x < 11; x += 1) {
      world.road[2 * 12 + x] = 1;
    }

    const path = findPath(world, 1, 2, 10, 2);
    expect(path.length).toBeGreaterThan(0);
    expect(path.every((index) => Math.floor(index / 12) === 2)).toBe(true);
  });
});
