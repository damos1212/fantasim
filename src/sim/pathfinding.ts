import { MAX_PATH_STEPS } from "../shared/config";
import { CARDINALS, inBounds, indexOf, manhattan } from "../shared/grid";
import { FeatureType, TerrainType } from "../shared/gameTypes";
import { isWaterTerrain, WorldData } from "./worldgen";

type Node = {
  index: number;
  parent: number;
  g: number;
  f: number;
};

export type PathMode = "land" | "water";

function movementCost(world: WorldData, x: number, y: number, mode: PathMode): number {
  const index = indexOf(x, y, world.width);
  const terrain = world.terrain[index];
  const feature = world.feature[index];

  if (mode === "water") {
    return isWaterTerrain(terrain) ? 1 : Number.POSITIVE_INFINITY;
  }

  if (
    terrain === TerrainType.WaterDeep ||
    terrain === TerrainType.WaterShallow ||
    terrain === TerrainType.River ||
    terrain === TerrainType.Lava ||
    feature === FeatureType.IrrigationCanal ||
    feature === FeatureType.Palisade ||
    feature === FeatureType.StoneWall
  ) {
    return Number.POSITIVE_INFINITY;
  }

  let cost = 1;
  if (terrain === TerrainType.ForestFloor || terrain === TerrainType.Marsh) cost += 1;
  if (terrain === TerrainType.Desert || terrain === TerrainType.Rocky) cost += 1;
  if (terrain === TerrainType.Snow) cost += 1.5;
  if (terrain === TerrainType.Mountain) cost += 5;
  if (feature === FeatureType.Trench) cost += 1.3;
  if (feature === FeatureType.Gate) cost += 0.6;
  if (world.road[index] > 0) cost = Math.max(0.45, cost - 0.6);

  return cost;
}

export function findPath(
  world: WorldData,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  mode: PathMode = "land",
  maxSteps = MAX_PATH_STEPS,
): number[] {
  if (!inBounds(startX, startY, world.width, world.height) || !inBounds(goalX, goalY, world.width, world.height)) {
    return [];
  }

  if (startX === goalX && startY === goalY) {
    return [indexOf(startX, startY, world.width)];
  }

  const start = indexOf(startX, startY, world.width);
  const goal = indexOf(goalX, goalY, world.width);
  const open: Node[] = [{ index: start, parent: -1, g: 0, f: manhattan(startX, startY, goalX, goalY) }];
  const cameFrom = new Int32Array(world.width * world.height).fill(-2);
  const gScore = new Float64Array(world.width * world.height);
  gScore.fill(Number.POSITIVE_INFINITY);
  gScore[start] = 0;

  let steps = 0;
  while (open.length > 0 && steps < maxSteps * 32) {
    steps += 1;
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    if (current.index === goal) {
      const path: number[] = [goal];
      let at = goal;
      while (at !== start) {
        at = cameFrom[at]!;
        if (at < 0) {
          break;
        }
        path.push(at);
      }
      path.reverse();
      return path.slice(0, maxSteps);
    }

    const x = current.index % world.width;
    const y = Math.floor(current.index / world.width);

    for (const [dx, dy] of CARDINALS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, world.width, world.height)) {
        continue;
      }
      const next = indexOf(nx, ny, world.width);
      const cost = movementCost(world, nx, ny, mode);
      if (!Number.isFinite(cost)) {
        continue;
      }
      const tentative = gScore[current.index] + cost;
      if (tentative >= gScore[next]) {
        continue;
      }

      cameFrom[next] = current.index;
      gScore[next] = tentative;
      open.push({
        index: next,
        parent: current.index,
        g: tentative,
        f: tentative + manhattan(nx, ny, goalX, goalY),
      });
    }
  }

  return [];
}
