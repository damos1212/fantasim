import { createNoise2D } from "simplex-noise";

import { CHUNK_SIZE } from "../shared/config";
import { CARDINALS, inBounds, indexOf, manhattan } from "../shared/grid";
import {
  BiomeType,
  FeatureType,
  UndergroundFeatureType,
  UndergroundTerrainType,
  RaceDef,
  ResourceType,
  StaticWorldData,
  TerrainType,
} from "../shared/gameTypes";
import { createSeededRandom, randInt } from "../shared/rng";

export type WorldData = StaticWorldData & {
  elevation: Uint8Array;
  volcanic: Uint8Array;
  road: Uint8Array;
  owner: Int16Array;
  resourceType: Uint8Array;
  resourceAmount: Uint16Array;
  buildingByTile: Int32Array;
  candidateStarts: StartCandidate[];
};

export type StartCandidate = {
  x: number;
  y: number;
  score: number;
};

const OCEAN = new Set<TerrainType>([TerrainType.WaterDeep, TerrainType.WaterShallow, TerrainType.River]);

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function terrainIsLand(terrain: TerrainType): boolean {
  return !OCEAN.has(terrain) && terrain !== TerrainType.Lava;
}

export function isWaterTerrain(terrain: TerrainType): boolean {
  return OCEAN.has(terrain);
}

export function isBuildableTerrain(terrain: TerrainType): boolean {
  return terrainIsLand(terrain) && terrain !== TerrainType.Mountain;
}

function addLake(world: WorldData, cx: number, cy: number, radius: number): void {
  for (let y = Math.max(0, cy - radius); y < Math.min(world.height, cy + radius + 1); y += 1) {
    for (let x = Math.max(0, cx - radius); x < Math.min(world.width, cx + radius + 1); x += 1) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance <= radius + ((x + y) % 3) * 0.2) {
        const index = indexOf(x, y, world.width);
        world.terrain[index] = distance < radius * 0.68 ? TerrainType.WaterDeep : TerrainType.WaterShallow;
        world.feature[index] = distance < radius * 0.45 ? FeatureType.FishShoal : FeatureType.None;
        world.resourceType[index] = distance < radius * 0.45 ? ResourceType.Fish : ResourceType.None;
        world.resourceAmount[index] = distance < radius * 0.45 ? 300 : 0;
        world.moisture[index] = clampByte(world.moisture[index]! + 36);
        world.fertility[index] = clampByte(world.fertility[index]! + 20);
      } else if (distance <= radius + 2.4) {
        const index = indexOf(x, y, world.width);
        if (terrainIsLand(world.terrain[index])) {
          world.moisture[index] = clampByte(world.moisture[index]! + 24);
          world.fertility[index] = clampByte(world.fertility[index]! + 18);
          if (world.terrain[index] === TerrainType.Grass && world.moisture[index]! > 170) {
            world.terrain[index] = TerrainType.ForestFloor;
          }
        }
      }
    }
  }
}

function sculptOceanBasins(world: WorldData, random: () => number): void {
  const minDim = Math.min(world.width, world.height);
  const basinCount = Math.max(1, Math.floor((world.width * world.height) / 2_400_000));
  const minRadius = Math.max(18, Math.floor(minDim * 0.045));
  const maxRadius = Math.max(minRadius + 8, Math.floor(minDim * 0.12));
  for (let i = 0; i < basinCount; i += 1) {
    const cx = randInt(random, Math.floor(world.width * 0.08), Math.floor(world.width * 0.92));
    const cy = randInt(random, Math.floor(world.height * 0.08), Math.floor(world.height * 0.92));
    const rx = randInt(random, minRadius, maxRadius);
    const ry = randInt(random, Math.max(14, Math.floor(minRadius * 0.8)), Math.max(20, Math.floor(maxRadius * 0.85)));
    const depth = randInt(random, 16, 34);
    for (let y = Math.max(0, cy - ry - 2); y < Math.min(world.height, cy + ry + 3); y += 1) {
      for (let x = Math.max(0, cx - rx - 2); x < Math.min(world.width, cx + rx + 3); x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const distance = Math.hypot(nx, ny);
        if (distance > 1.15) continue;
        const falloff = Math.max(0, 1 - distance);
        const index = indexOf(x, y, world.width);
        world.elevation[index] = clampByte(world.elevation[index]! - depth * falloff * 1.35);
        world.moisture[index] = clampByte(world.moisture[index]! + 16 * falloff);
        world.fertility[index] = clampByte(world.fertility[index]! + 8 * falloff);
      }
    }
  }
}

function raiseIslandChains(world: WorldData, random: () => number): void {
  const minDim = Math.min(world.width, world.height);
  const chainCount = Math.max(2, Math.floor((world.width * world.height) / 1_300_000));
  const step = Math.max(8, Math.floor(minDim * 0.022));
  const radius = Math.max(4, Math.floor(minDim * 0.012));
  for (let i = 0; i < chainCount; i += 1) {
    let cx = random() > 0.5
      ? (random() > 0.5 ? randInt(random, 8, Math.floor(world.width * 0.18)) : randInt(random, Math.floor(world.width * 0.82), world.width - 8))
      : randInt(random, 8, world.width - 8);
    let cy = random() > 0.5
      ? randInt(random, 8, world.height - 8)
      : (random() > 0.5 ? randInt(random, 8, Math.floor(world.height * 0.18)) : randInt(random, Math.floor(world.height * 0.82), world.height - 8));
    let direction = random() * Math.PI * 2;
    const segments = randInt(random, 4, 10);
    for (let segment = 0; segment < segments; segment += 1) {
      const uplift = randInt(random, 18, 34);
      const rx = radius + randInt(random, 0, Math.max(2, Math.floor(radius * 0.6)));
      const ry = radius + randInt(random, 0, Math.max(2, Math.floor(radius * 0.5)));
      for (let y = Math.max(0, cy - ry - 1); y < Math.min(world.height, cy + ry + 2); y += 1) {
        for (let x = Math.max(0, cx - rx - 1); x < Math.min(world.width, cx + rx + 2); x += 1) {
          const nx = (x - cx) / rx;
          const ny = (y - cy) / ry;
          const distance = Math.hypot(nx, ny);
          if (distance > 1.05) continue;
          const falloff = Math.max(0, 1 - distance);
          const index = indexOf(x, y, world.width);
          world.elevation[index] = clampByte(world.elevation[index]! + uplift * falloff * 1.1);
          world.moisture[index] = clampByte(world.moisture[index]! + 12 * falloff);
          world.fertility[index] = clampByte(world.fertility[index]! + 8 * falloff);
        }
      }
      cx = Math.max(8, Math.min(world.width - 8, Math.round(cx + Math.cos(direction) * step + randInt(random, -4, 4))));
      cy = Math.max(8, Math.min(world.height - 8, Math.round(cy + Math.sin(direction) * step + randInt(random, -4, 4))));
      direction += (random() - 0.5) * 0.85;
    }
  }
}

function igniteVolcanicBelts(world: WorldData, random: () => number): void {
  const count = Math.max(2, Math.floor((world.width * world.height) / 1_900_000));
  const minDim = Math.min(world.width, world.height);
  const minRadius = Math.max(16, Math.floor(minDim * 0.035));
  const maxRadius = Math.max(minRadius + 8, Math.floor(minDim * 0.075));
  for (let i = 0; i < count; i += 1) {
    const cx = randInt(random, Math.floor(world.width * 0.08), Math.floor(world.width * 0.92));
    const cy = randInt(random, Math.floor(world.height * 0.08), Math.floor(world.height * 0.92));
    const rx = randInt(random, minRadius, maxRadius);
    const ry = randInt(random, Math.max(12, Math.floor(minRadius * 0.75)), Math.max(18, Math.floor(maxRadius * 0.82)));
    for (let y = Math.max(0, cy - ry - 2); y < Math.min(world.height, cy + ry + 3); y += 1) {
      for (let x = Math.max(0, cx - rx - 2); x < Math.min(world.width, cx + rx + 3); x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const distance = Math.hypot(nx, ny);
        if (distance > 1.1) continue;
        const falloff = Math.max(0, 1 - distance);
        const index = indexOf(x, y, world.width);
        world.volcanic[index] = clampByte(world.volcanic[index]! + 90 * falloff);
        world.elevation[index] = clampByte(world.elevation[index]! + 22 * falloff);
        world.temperature[index] = clampByte(world.temperature[index]! + 14 * falloff);
        world.moisture[index] = clampByte(world.moisture[index]! - 28 * falloff);
        world.fertility[index] = clampByte(world.fertility[index]! - 18 * falloff);
      }
    }
  }
}

function applyCoastalHumidity(world: WorldData): void {
  const horizontal = new Uint16Array(world.width * world.height);
  const vertical = new Uint16Array(world.width * world.height);
  const maxDistance = 120;

  for (let y = 0; y < world.height; y += 1) {
    let distance = maxDistance;
    for (let x = 0; x < world.width; x += 1) {
      const index = indexOf(x, y, world.width);
      distance = isWaterTerrain(world.terrain[index] as TerrainType) ? 0 : Math.min(maxDistance, distance + 1);
      horizontal[index] = distance;
    }
    distance = maxDistance;
    for (let x = world.width - 1; x >= 0; x -= 1) {
      const index = indexOf(x, y, world.width);
      distance = isWaterTerrain(world.terrain[index] as TerrainType) ? 0 : Math.min(maxDistance, distance + 1);
      horizontal[index] = Math.min(horizontal[index]!, distance);
    }
  }

  for (let x = 0; x < world.width; x += 1) {
    let distance = maxDistance;
    for (let y = 0; y < world.height; y += 1) {
      const index = indexOf(x, y, world.width);
      distance = isWaterTerrain(world.terrain[index] as TerrainType) ? 0 : Math.min(maxDistance, distance + 1);
      vertical[index] = distance;
    }
    distance = maxDistance;
    for (let y = world.height - 1; y >= 0; y -= 1) {
      const index = indexOf(x, y, world.width);
      distance = isWaterTerrain(world.terrain[index] as TerrainType) ? 0 : Math.min(maxDistance, distance + 1);
      vertical[index] = Math.min(vertical[index]!, distance);
    }
  }

  for (let i = 0; i < world.width * world.height; i += 1) {
    const distance = Math.min(horizontal[i]!, vertical[i]!);
    const moistureBoost = Math.max(0, 34 - distance * 0.42);
    const tempSoftening = Math.max(0, 16 - distance * 0.16);
    world.moisture[i] = clampByte(world.moisture[i]! + moistureBoost);
    world.temperature[i] = clampByte(world.temperature[i]! - tempSoftening * 0.35);
    world.fertility[i] = clampByte(world.fertility[i]! + moistureBoost * 0.28);
  }
}

function applyRainShadow(world: WorldData): void {
  for (let y = 0; y < world.height; y += 1) {
    let humidity = 22;
    for (let x = 0; x < world.width; x += 1) {
      const index = indexOf(x, y, world.width);
      const terrain = world.terrain[index] as TerrainType;
      const elevation = world.elevation[index]!;
      if (isWaterTerrain(terrain)) {
        humidity = 30;
        continue;
      }
      const uplift = elevation > 176 ? (elevation - 176) * 0.22 : 0;
      const deposit = Math.min(humidity, uplift);
      if (deposit > 0) {
        world.moisture[index] = clampByte(world.moisture[index]! + deposit);
        world.fertility[index] = clampByte(world.fertility[index]! + deposit * 0.32);
      }
      if (terrain === TerrainType.Mountain || terrain === TerrainType.Rocky) {
        humidity = Math.max(0, humidity - 7 - uplift * 0.35);
      } else {
        const leeDry = humidity < 8 && elevation > 120 ? 6 : humidity < 12 && elevation > 100 ? 3 : 0;
        if (leeDry > 0) {
          world.moisture[index] = clampByte(world.moisture[index]! - leeDry);
          world.temperature[index] = clampByte(world.temperature[index]! + leeDry * 0.35);
          world.fertility[index] = clampByte(world.fertility[index]! - leeDry * 0.25);
        }
        humidity = Math.max(0, humidity - 0.08);
      }
    }
  }
}

function classifyTerrain(world: WorldData, index: number): void {
  const elev = world.elevation[index]!;
  const temp = world.temperature[index]!;
  const moist = world.moisture[index]!;
  const volc = world.volcanic[index]!;

  if (elev < 88) {
    world.terrain[index] = TerrainType.WaterDeep;
  } else if (elev < 98) {
    world.terrain[index] = TerrainType.WaterShallow;
  } else if (elev < 104) {
    world.terrain[index] = TerrainType.Beach;
  } else if (volc > 214 && elev > 136) {
    world.terrain[index] = TerrainType.Lava;
  } else if (volc > 182 && elev > 128) {
    world.terrain[index] = TerrainType.Ashland;
  } else if (elev > 210) {
    world.terrain[index] = TerrainType.Mountain;
  } else if (elev > 174) {
    world.terrain[index] = temp < 112 ? TerrainType.Snow : TerrainType.Rocky;
  } else if (temp < 54) {
    world.terrain[index] = TerrainType.Snow;
  } else if (moist > 210 && elev < 150 && temp > 80) {
    world.terrain[index] = TerrainType.Marsh;
  } else if (temp > 150 && moist < 116) {
    world.terrain[index] = TerrainType.Desert;
  } else if (moist > 166) {
    world.terrain[index] = TerrainType.ForestFloor;
  } else {
    world.terrain[index] = TerrainType.Grass;
  }
}

function markRiver(world: WorldData, x: number, y: number, width = 1): void {
  if (!inBounds(x, y, world.width, world.height)) {
    return;
  }

  for (let dy = -width; dy <= width; dy += 1) {
    for (let dx = -width; dx <= width; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, world.width, world.height)) {
        continue;
      }
      const index = indexOf(nx, ny, world.width);
      if (world.terrain[index] === TerrainType.Mountain || world.terrain[index] === TerrainType.Lava) {
        continue;
      }

      world.terrain[index] = TerrainType.River;
      if (world.feature[index] === FeatureType.None) {
        world.feature[index] = FeatureType.FishShoal;
      }
      world.resourceType[index] = ResourceType.Fish;
      world.resourceAmount[index] = Math.max(world.resourceAmount[index], 220);
      world.moisture[index] = clampByte(world.moisture[index]! + 34);
      world.fertility[index] = clampByte(world.fertility[index]! + 22);

      for (let by = -2; by <= 2; by += 1) {
        for (let bx = -2; bx <= 2; bx += 1) {
          const rx = nx + bx;
          const ry = ny + by;
          if (!inBounds(rx, ry, world.width, world.height)) {
            continue;
          }
          const riverbank = indexOf(rx, ry, world.width);
          if (!terrainIsLand(world.terrain[riverbank])) {
            continue;
          }
          world.moisture[riverbank] = clampByte(world.moisture[riverbank]! + 10);
          world.fertility[riverbank] = clampByte(world.fertility[riverbank]! + 8);
          if (world.terrain[riverbank] === TerrainType.Grass && world.moisture[riverbank]! > 176) {
            world.terrain[riverbank] = TerrainType.ForestFloor;
          }
        }
      }
    }
  }
}

function carveRivers(world: WorldData, random: () => number): void {
  const heads: number[] = [];
  const directions = [
    ...CARDINALS,
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;
  const hasNearbyMountain = (x: number, y: number, radius: number): boolean => {
    for (let ny = Math.max(1, y - radius); ny <= Math.min(world.height - 2, y + radius); ny += 1) {
      for (let nx = Math.max(1, x - radius); nx <= Math.min(world.width - 2, x + radius); nx += 1) {
        const terrain = world.terrain[indexOf(nx, ny, world.width)] as TerrainType;
        if (terrain === TerrainType.Mountain || terrain === TerrainType.Rocky || terrain === TerrainType.Snow) {
          return true;
        }
      }
    }
    return false;
  };
  for (let y = 24; y < world.height - 24; y += 4) {
    for (let x = 24; x < world.width - 24; x += 4) {
      const index = indexOf(x, y, world.width);
      if (
        world.elevation[index] > 168 &&
        world.moisture[index] > 118 &&
        world.terrain[index] !== TerrainType.WaterDeep &&
        world.terrain[index] !== TerrainType.WaterShallow &&
        world.terrain[index] !== TerrainType.Lava &&
        world.terrain[index] !== TerrainType.River &&
        hasNearbyMountain(x, y, 5) &&
        world.volcanic[index] < 155 &&
        !hasAdjacentWater(world, x, y, 12) &&
        random() > 0.987
      ) {
        heads.push(index);
      }
    }
  }

  for (let i = heads.length - 1; i > 0; i -= 1) {
    const j = randInt(random, 0, i);
    [heads[i], heads[j]] = [heads[j]!, heads[i]!];
  }

  if (heads.length < 6) {
    const fallback: Array<{ index: number; score: number }> = [];
    for (let y = 24; y < world.height - 24; y += 6) {
      for (let x = 24; x < world.width - 24; x += 6) {
        const index = indexOf(x, y, world.width);
        if (
          world.terrain[index] === TerrainType.WaterDeep ||
          world.terrain[index] === TerrainType.WaterShallow ||
          world.terrain[index] === TerrainType.Lava ||
          world.terrain[index] === TerrainType.River ||
          !hasNearbyMountain(x, y, 5) ||
          hasAdjacentWater(world, x, y, 10)
        ) {
          continue;
        }
        fallback.push({
          index,
          score: world.elevation[index]! * 1.2 + world.moisture[index]! * 0.8 - world.volcanic[index]! * 0.5,
        });
      }
    }
    fallback.sort((a, b) => b.score - a.score);
    for (const candidate of fallback.slice(0, 18)) {
      heads.push(candidate.index);
    }
  }

  const maxRivers = Math.max(10, Math.floor((world.width * world.height) / 240000));
  const maxSteps = Math.max(180, Math.floor(Math.max(world.width, world.height) / 6));
  const chosenHeads: number[] = [];
  for (const head of heads) {
    if (chosenHeads.length >= maxRivers) {
      break;
    }
    const hx = head % world.width;
    const hy = Math.floor(head / world.width);
    if (chosenHeads.some((other) => manhattan(hx, hy, other % world.width, Math.floor(other / world.width)) < 54)) {
      continue;
    }
    chosenHeads.push(head);
  }

  for (const head of chosenHeads) {
    let current = head;
    const seen = new Set<number>();
    let previousDx = 0;
    let previousDy = 1;

    for (let steps = 0; steps < maxSteps; steps += 1) {
      if (seen.has(current)) {
        break;
      }
      seen.add(current);

      const { x, y } = { x: current % world.width, y: Math.floor(current / world.width) };
      const channelWidth = steps > 48 && random() > 0.72 ? 2 : 1;
      markRiver(world, x, y, channelWidth);

      const terrain = world.terrain[current];
      if (terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow) {
        break;
      }

      let best = current;
      let bestScore = Number.POSITIVE_INFINITY;
      let bestDx = 0;
      let bestDy = 0;
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, world.width, world.height)) {
          continue;
        }
        const neighbor = indexOf(nx, ny, world.width);
        const nextElevation = world.elevation[neighbor];
        if (world.terrain[neighbor] === TerrainType.WaterDeep || world.terrain[neighbor] === TerrainType.WaterShallow) {
          best = neighbor;
          break;
        }
        const diagonalPenalty = dx !== 0 && dy !== 0 ? 0.8 : 0;
        const uphillPenalty = nextElevation > world.elevation[current]! ? 24 + (nextElevation - world.elevation[current]!) * 0.9 : 0;
        const sameDirectionBonus = dx === previousDx && dy === previousDy ? -1.4 : 0;
        const oceanPull = (world.height - ny) * 0.015 + Math.min(nx, world.width - nx) * 0.003;
        const meanderBias = (random() - 0.5) * 0.9;
        const score = nextElevation + diagonalPenalty + uphillPenalty + oceanPull + meanderBias + sameDirectionBonus;
        if (score < bestScore) {
          bestScore = score;
          best = neighbor;
          bestDx = dx;
          bestDy = dy;
        }
      }

      if (best === current) {
        if (steps > 18 && random() > 0.72) {
          addLake(world, x, y, randInt(random, 2, 5));
        }
        break;
      }
      previousDx = bestDx;
      previousDy = bestDy;
      current = best;
    }
  }

  const visited = new Uint8Array(world.width * world.height);
  const component: number[] = [];
  for (let index = 0; index < world.terrain.length; index += 1) {
    if (visited[index] || world.terrain[index] !== TerrainType.River) {
      continue;
    }
    component.length = 0;
    let touchesWater = false;
    const stack = [index];
    visited[index] = 1;
    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);
      const x = current % world.width;
      const y = Math.floor(current / world.width);
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, world.width, world.height)) continue;
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
    if (!touchesWater && component.length < 72) {
      for (const tile of component) {
        if (world.feature[tile] === FeatureType.FishShoal) {
          world.feature[tile] = FeatureType.None;
        }
        world.resourceType[tile] = ResourceType.None;
        world.resourceAmount[tile] = 0;
        classifyTerrain(world, tile);
      }
    }
  }
}

function assignBiome(world: WorldData, index: number): void {
  const terrain = world.terrain[index];
  const temp = world.temperature[index];
  const moisture = world.moisture[index];
  const volcanic = world.volcanic[index];
  const elevation = world.elevation[index];

  if (terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow) {
    world.biome[index] = terrain === TerrainType.WaterShallow || elevation > 94 || moisture > 150 ? BiomeType.Archipelago : BiomeType.Coastline;
    return;
  }
  if (terrain === TerrainType.River || terrain === TerrainType.Beach) {
    world.biome[index] = BiomeType.Coastline;
    return;
  }
  if (terrain === TerrainType.Lava || volcanic > 220) {
    world.biome[index] = BiomeType.VolcanicHighland;
    return;
  }
  if (terrain === TerrainType.Ashland || volcanic > 175) {
    world.biome[index] = BiomeType.AshWaste;
    return;
  }
  if (terrain === TerrainType.Mountain || elevation > 210) {
    world.biome[index] = temp < 102 ? BiomeType.Tundra : BiomeType.Alpine;
    return;
  }
  if (terrain === TerrainType.Snow || (temp < 78 && elevation > 120)) {
    world.biome[index] = moisture > 96 ? BiomeType.SnowyForest : BiomeType.Tundra;
    return;
  }
  if (terrain === TerrainType.Marsh || (moisture > 205 && temp > 84 && elevation < 154)) {
    world.biome[index] = BiomeType.Marshland;
    return;
  }
  if (terrain === TerrainType.Desert || (temp > 142 && moisture < 122)) {
    world.biome[index] = BiomeType.Desert;
    return;
  }
  if (terrain === TerrainType.ForestFloor) {
    world.biome[index] = temp < 95 ? BiomeType.SnowyForest : BiomeType.DeepForest;
    return;
  }
  world.biome[index] = moisture < 92 && temp > 106 ? BiomeType.Scrubland : BiomeType.TemperatePlains;
}

function seedFeatures(world: WorldData, random: () => number): void {
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const index = indexOf(x, y, world.width);
      const terrain = world.terrain[index];
      const biome = world.biome[index];
      const fertility = world.fertility[index];

      if (terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow || terrain === TerrainType.River) {
        if (world.feature[index] === FeatureType.None && random() > 0.96) {
          world.feature[index] = FeatureType.FishShoal;
          world.resourceType[index] = ResourceType.Fish;
          world.resourceAmount[index] = 240;
        }
        continue;
      }

      if (terrain === TerrainType.Lava) {
        world.feature[index] = FeatureType.Volcano;
        world.resourceType[index] = ResourceType.None;
        continue;
      }

      if (terrain === TerrainType.Mountain || terrain === TerrainType.Rocky) {
        if (random() > 0.84) {
          world.feature[index] = FeatureType.StoneOutcrop;
          world.resourceType[index] = ResourceType.Stone;
          world.resourceAmount[index] = randInt(random, 100, 260);
        }
        if (random() > 0.93) {
          world.feature[index] = FeatureType.OreVein;
          world.resourceType[index] = ResourceType.Ore;
          world.resourceAmount[index] = randInt(random, 80, 220);
        }
        continue;
      }

      if (terrain === TerrainType.Marsh) {
        world.feature[index] = random() > 0.72 ? FeatureType.Reeds : FeatureType.None;
        world.resourceType[index] = world.feature[index] === FeatureType.Reeds ? ResourceType.Clay : ResourceType.None;
        world.resourceAmount[index] = world.feature[index] === FeatureType.Reeds ? randInt(random, 60, 120) : 0;
        continue;
      }

      if (biome === BiomeType.DeepForest || biome === BiomeType.SnowyForest) {
        if (random() > 0.35) {
          world.feature[index] = FeatureType.Trees;
          world.resourceType[index] = ResourceType.Wood;
          world.resourceAmount[index] = randInt(random, 80, 170);
        } else if (random() > 0.97) {
          world.feature[index] = FeatureType.BerryPatch;
          world.resourceType[index] = ResourceType.Berries;
          world.resourceAmount[index] = randInt(random, 40, 90);
        }
        continue;
      }

      if ((biome === BiomeType.TemperatePlains || biome === BiomeType.Coastline) && fertility > 130) {
        if (random() > 0.93) {
          world.feature[index] = FeatureType.BerryPatch;
          world.resourceType[index] = ResourceType.Berries;
          world.resourceAmount[index] = randInt(random, 45, 95);
        } else if (random() > 0.9) {
          world.feature[index] = FeatureType.Trees;
          world.resourceType[index] = ResourceType.Wood;
          world.resourceAmount[index] = randInt(random, 60, 110);
        }
        continue;
      }

      if (biome === BiomeType.Desert || biome === BiomeType.Scrubland) {
        if (random() > 0.975) {
          world.feature[index] = FeatureType.ClayDeposit;
          world.resourceType[index] = ResourceType.Clay;
          world.resourceAmount[index] = randInt(random, 40, 100);
        }
        continue;
      }

      if ((biome === BiomeType.AshWaste || biome === BiomeType.VolcanicHighland) && random() > 0.96) {
        world.feature[index] = FeatureType.StoneOutcrop;
        world.resourceType[index] = random() > 0.6 ? ResourceType.Ore : ResourceType.Stone;
        world.resourceAmount[index] = randInt(random, 80, 170);
      }
    }
  }
}

function generateUnderground(world: WorldData, seed: string, random: () => number): void {
  const cavernNoise = createNoise2D(createSeededRandom(`${seed}:underground:caverns`));
  const seamNoise = createNoise2D(createSeededRandom(`${seed}:underground:seams`));
  const riverNoise = createNoise2D(createSeededRandom(`${seed}:underground:rivers`));
  const ruinNoise = createNoise2D(createSeededRandom(`${seed}:underground:ruins`));

  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const index = indexOf(x, y, world.width);
      const terrain = world.terrain[index] as TerrainType;
      const biome = world.biome[index] as BiomeType;
      const cavernValue = cavernNoise(x / 78, y / 78) * 0.75 + cavernNoise(x / 24, y / 24) * 0.25;
      const seamValue = seamNoise(x / 36, y / 36) * 0.7 + seamNoise(x / 14, y / 14) * 0.3;
      const riverValue = riverNoise(x / 130, y / 130) * 0.8 + riverNoise(x / 34, y / 34) * 0.2;
      const ruinValue = ruinNoise(x / 90, y / 90) * 0.7 + ruinNoise(x / 20, y / 20) * 0.3;

      const mountainBias = terrain === TerrainType.Mountain ? 0.12 : terrain === TerrainType.Rocky ? 0.08 : 0;
      const wetBias = terrain === TerrainType.Marsh || biome === BiomeType.Marshland || world.moisture[index]! > 180 ? 0.08 : 0;
      const volcanicBias = world.volcanic[index]! > 205 ? 0.1 : 0;

      let underTerrain = UndergroundTerrainType.SolidRock;
      if (world.volcanic[index]! > 220 && cavernValue + volcanicBias > 0.42) {
        underTerrain = UndergroundTerrainType.Magma;
      } else if ((terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow || terrain === TerrainType.River || wetBias > 0) && riverValue > 0.54) {
        underTerrain = UndergroundTerrainType.UndergroundRiver;
      } else if (ruinValue > 0.67 && cavernValue > 0.18) {
        underTerrain = UndergroundTerrainType.Ruins;
      } else if (cavernValue + mountainBias > 0.36 || (terrain === TerrainType.Mountain && cavernValue > 0.16)) {
        underTerrain = UndergroundTerrainType.Cavern;
      }

      world.undergroundTerrain[index] = underTerrain;
      world.undergroundFeature[index] = UndergroundFeatureType.None;
      world.undergroundResourceType[index] = ResourceType.None;
      world.undergroundResourceAmount[index] = 0;

      if (underTerrain === UndergroundTerrainType.Magma || underTerrain === UndergroundTerrainType.UndergroundRiver) {
        continue;
      }

      if (seamValue + mountainBias > 0.48) {
        world.undergroundFeature[index] = UndergroundFeatureType.OreSeam;
        world.undergroundResourceType[index] = ResourceType.Ore;
        world.undergroundResourceAmount[index] = randInt(random, 140, 360);
        continue;
      }

      if (underTerrain === UndergroundTerrainType.Cavern && world.moisture[index]! > 150 && random() > 0.78) {
        world.undergroundFeature[index] = UndergroundFeatureType.MushroomGrove;
        world.undergroundResourceType[index] = ResourceType.Grain;
        world.undergroundResourceAmount[index] = randInt(random, 60, 150);
        continue;
      }

      if ((biome === BiomeType.DeepForest || biome === BiomeType.SnowyForest) && random() > 0.84) {
        world.undergroundFeature[index] = UndergroundFeatureType.RootTangle;
        world.undergroundResourceType[index] = ResourceType.Wood;
        world.undergroundResourceAmount[index] = randInt(random, 50, 120);
        continue;
      }

      if ((underTerrain === UndergroundTerrainType.Cavern || underTerrain === UndergroundTerrainType.Ruins) && random() > 0.9) {
        world.undergroundFeature[index] = underTerrain === UndergroundTerrainType.Ruins ? UndergroundFeatureType.AncientRemains : UndergroundFeatureType.CrystalCluster;
        world.undergroundResourceType[index] = ResourceType.Stone;
        world.undergroundResourceAmount[index] = randInt(random, 40, 120);
      }
    }
  }
}

function nearbyLandBonus(world: WorldData, x: number, y: number): number {
  let score = 0;
  for (let dy = -8; dy <= 8; dy += 1) {
    for (let dx = -8; dx <= 8; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, world.width, world.height)) {
        continue;
      }
      const index = indexOf(nx, ny, world.width);
      const terrain = world.terrain[index];
      if (terrainIsLand(terrain)) {
        score += 1;
        score += world.fertility[index] * 0.015;
        if (world.feature[index] === FeatureType.Trees) score += 1;
        if (world.feature[index] === FeatureType.StoneOutcrop) score += 1.3;
        if (world.feature[index] === FeatureType.OreVein) score += 1.8;
      } else {
        score -= 0.15;
      }
    }
  }
  return score;
}

function collectStartCandidates(world: WorldData): StartCandidate[] {
  const candidates: StartCandidate[] = [];
  for (let y = CHUNK_SIZE; y < world.height - CHUNK_SIZE; y += 12) {
    for (let x = CHUNK_SIZE; x < world.width - CHUNK_SIZE; x += 12) {
      const index = indexOf(x, y, world.width);
      const terrain = world.terrain[index];
      if (!terrainIsLand(terrain) || terrain === TerrainType.Mountain || terrain === TerrainType.Ashland || terrain === TerrainType.Lava) {
        continue;
      }
      const score = nearbyLandBonus(world, x, y);
      if (score > 160) {
        candidates.push({ x, y, score });
      }
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

export function scoreStartForRace(world: WorldData, race: RaceDef, x: number, y: number): number {
  let score = nearbyLandBonus(world, x, y);
  for (let dy = -12; dy <= 12; dy += 1) {
    for (let dx = -12; dx <= 12; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, world.width, world.height)) {
        continue;
      }
      const index = indexOf(nx, ny, world.width);
      if (race.preferredBiomes.includes(world.biome[index])) {
        score += 4;
      }
      if (world.feature[index] === FeatureType.OreVein && race.buildBias > 1) {
        score += 2.5;
      }
      if (world.feature[index] === FeatureType.Trees && race.foodBias > 1) {
        score += 0.8;
      }
      if (isWaterTerrain(world.terrain[index]) && race.name === "Humans") {
        score += 0.5;
      }
    }
  }
  return score;
}

export function generateWorld(seed: string, width: number, height: number): WorldData {
  const random = createSeededRandom(seed);
  const elevationNoise = createNoise2D(createSeededRandom(`${seed}:elevation`));
  const mountainNoise = createNoise2D(createSeededRandom(`${seed}:mountains`));
  const moistureNoise = createNoise2D(createSeededRandom(`${seed}:moisture`));
  const tempNoise = createNoise2D(createSeededRandom(`${seed}:temperature`));
  const volcanicNoise = createNoise2D(createSeededRandom(`${seed}:volcanic`));
  const aridNoise = createNoise2D(createSeededRandom(`${seed}:arid`));
  const wetlandNoise = createNoise2D(createSeededRandom(`${seed}:wetland`));

  const tileCount = width * height;
  const elevation = new Uint8Array(tileCount);
  const terrain = new Uint8Array(tileCount);
  const biome = new Uint8Array(tileCount);
  const feature = new Uint8Array(tileCount);
  const surfaceWater = new Uint8Array(tileCount);
  const undergroundTerrain = new Uint8Array(tileCount);
  const undergroundFeature = new Uint8Array(tileCount);
  const undergroundResourceType = new Uint8Array(tileCount);
  const undergroundResourceAmount = new Uint16Array(tileCount);
  const fertility = new Uint8Array(tileCount);
  const temperature = new Uint8Array(tileCount);
  const moisture = new Uint8Array(tileCount);
  const volcanic = new Uint8Array(tileCount);
  const road = new Uint8Array(tileCount);
  const owner = new Int16Array(tileCount).fill(-1);
  const resourceType = new Uint8Array(tileCount);
  const resourceAmount = new Uint16Array(tileCount);
  const buildingByTile = new Int32Array(tileCount).fill(-1);

  const world: WorldData = {
    width,
    height,
    elevation,
    terrain,
    biome,
    feature,
    surfaceWater,
    undergroundTerrain,
    undergroundFeature,
    undergroundResourceType,
    undergroundResourceAmount,
    fertility,
    temperature,
    moisture,
    volcanic,
    road,
    owner,
    resourceType,
    resourceAmount,
    buildingByTile,
    candidateStarts: [],
  };

  for (let y = 0; y < height; y += 1) {
    const latitude = Math.abs(y / height - 0.5) * 2;
    for (let x = 0; x < width; x += 1) {
      const index = indexOf(x, y, width);
      const nx = x / width - 0.5;
      const ny = y / height - 0.5;
      const continent = elevationNoise(x / 240, y / 240) * 0.9 + elevationNoise(x / 110, y / 110) * 0.35;
      const ridges = Math.abs(mountainNoise(x / 80, y / 80)) * 0.8 + Math.abs(mountainNoise(x / 24, y / 24)) * 0.2;
      const moistureValue = moistureNoise(x / 170, y / 170) * 0.75 + moistureNoise(x / 40, y / 40) * 0.25;
      const tempValue = tempNoise(x / 160, y / 160);
      const volcanoValue = volcanicNoise(x / 85, y / 85) * 0.7 + volcanicNoise(x / 28, y / 28) * 0.3;
      const aridRegion = aridNoise(x / 320, y / 320) * 0.7 + aridNoise(x / 96, y / 96) * 0.3;
      const wetRegion = wetlandNoise(x / 280, y / 280) * 0.7 + wetlandNoise(x / 84, y / 84) * 0.3;
      const coastBias = Math.max(0, Math.abs(nx) * 0.8 + Math.abs(ny) * 0.78 - 0.29);

      const elev = continent * 108 + ridges * 55 - coastBias * 96 + 132;
      const temp = (1 - latitude) * 202 + tempValue * 46 - (elev - 128) * 0.32 + Math.max(0, aridRegion) * 28 - Math.max(0, wetRegion) * 10 + coastBias * 6;
      const moist = moistureValue * 92 + 112 - coastBias * 28 - Math.max(0, aridRegion) * 72 + Math.max(0, wetRegion) * 54 - Math.max(0, elev - 150) * 0.08;
      const volc = volcanoValue * 138 + ridges * 46 + 104;

      elevation[index] = clampByte(elev);
      temperature[index] = clampByte(temp);
      moisture[index] = clampByte(moist);
      volcanic[index] = clampByte(volc);
      fertility[index] = clampByte((moist + (200 - Math.abs(temp - 135)) + (160 - Math.abs(elev - 125))) / 3);
    }
  }

  sculptOceanBasins(world, random);
  raiseIslandChains(world, random);
  igniteVolcanicBelts(world, random);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      classifyTerrain(world, indexOf(x, y, width));
    }
  }

  applyCoastalHumidity(world);
  applyRainShadow(world);

  for (let i = 0; i < tileCount; i += 1) {
    classifyTerrain(world, i);
    fertility[i] = clampByte((moisture[i]! + (200 - Math.abs(temperature[i]! - 135)) + (160 - Math.abs(elevation[i]! - 125))) / 3);
  }

  const lakeCount = Math.max(14, Math.floor((width * height) / 240000));
  const lakeMarginX = Math.max(10, Math.min(70, Math.floor(width * 0.12)));
  const lakeMarginY = Math.max(10, Math.min(70, Math.floor(height * 0.12)));
  for (let i = 0; i < lakeCount; i += 1) {
    const largeLake = i % 5 === 0;
    addLake(
      world,
      randInt(random, lakeMarginX, width - lakeMarginX),
      randInt(random, lakeMarginY, height - lakeMarginY),
      largeLake ? randInt(random, 12, 28) : randInt(random, 6, 20),
    );
  }

  carveRivers(world, random);

  for (let i = 0; i < tileCount; i += 1) {
    assignBiome(world, i);
  }

  seedFeatures(world, random);
  generateUnderground(world, seed, random);
  world.candidateStarts = collectStartCandidates(world);

  return world;
}

export function hasAdjacentWater(world: WorldData, x: number, y: number, radius = 3): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, world.width, world.height)) {
        continue;
      }
      const terrain = world.terrain[indexOf(nx, ny, world.width)];
      if (isWaterTerrain(terrain)) {
        return true;
      }
    }
  }
  return false;
}

export function distanceToNearestFeature(
  world: WorldData,
  x: number,
  y: number,
  featureMatch: (feature: FeatureType, terrain: TerrainType) => boolean,
  maxRadius = 18,
): number {
  let best = Number.POSITIVE_INFINITY;
  for (let dy = -maxRadius; dy <= maxRadius; dy += 1) {
    for (let dx = -maxRadius; dx <= maxRadius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, world.width, world.height)) {
        continue;
      }
      const index = indexOf(nx, ny, world.width);
      if (featureMatch(world.feature[index], world.terrain[index])) {
        best = Math.min(best, manhattan(x, y, nx, ny));
      }
    }
  }
  return best;
}
