import { describe, expect, test } from "vitest";

import { createSimulation } from "../src/sim/simulation";
import { INITIAL_AGENTS_PER_TRIBE, INITIAL_TRIBE_COUNT } from "../src/shared/config";
import { AgeType } from "../src/shared/gameTypes";

describe("simulation", () => {
  test("seeds tribes, buildings, and agents", () => {
    const sim = createSimulation("sim-seed", { width: 768, height: 768 });

    expect(sim.tribes.length).toBe(INITIAL_TRIBE_COUNT);
    expect(sim.buildings.length).toBeGreaterThanOrEqual(32);
    expect(sim.agents.length).toBe(INITIAL_TRIBE_COUNT * INITIAL_AGENTS_PER_TRIBE);
    expect(sim.weatherCells.length).toBeGreaterThan(0);
    expect(sim.creatures.length).toBeGreaterThan(0);
    expect(sim.dungeons.length).toBeGreaterThan(0);
    expect(sim.world.surfaceWater.length).toBe(768 * 768);
    expect(sim.world.undergroundTerrain.length).toBe(768 * 768);
  });

  test("remains stable across extended ticks and progresses technology", { timeout: 20000 }, () => {
    const sim = createSimulation("long-run", { width: 768, height: 768 });
    let lastSnapshot = sim.snapshotNow();
    for (let i = 0; i < 180; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    expect(lastSnapshot.tribes.every((tribe) => tribe.population > 0)).toBe(true);
    expect(lastSnapshot.agents.every((agent) => agent.x >= 0 && agent.y >= 0)).toBe(true);
    expect(lastSnapshot.buildings.length).toBeGreaterThanOrEqual(INITIAL_TRIBE_COUNT * 4);
    expect(lastSnapshot.tribes.some((tribe) => tribe.age >= AgeType.Stone)).toBe(true);
    expect(lastSnapshot.tribes.every((tribe) => typeof tribe.horses === "number" && typeof tribe.boats === "number")).toBe(true);
    expect(lastSnapshot.tribes.every((tribe) => tribe.techs.length >= 6)).toBe(true);
    expect(Array.isArray(lastSnapshot.boats)).toBe(true);
    expect(Array.isArray(lastSnapshot.wagons)).toBe(true);
    expect(Array.isArray(lastSnapshot.caravans)).toBe(true);
    expect(Array.isArray(lastSnapshot.siegeEngines)).toBe(true);
    expect(lastSnapshot.weather.length).toBeGreaterThan(0);
    expect(lastSnapshot.creatures.length).toBeGreaterThan(0);
    expect(lastSnapshot.events.length).toBeGreaterThan(0);
    expect(lastSnapshot.dungeons.length).toBeGreaterThan(0);
    expect(lastSnapshot.agents.every((agent) => agent.name.length > 0 && agent.ageYears >= 18)).toBe(true);
    expect(lastSnapshot.agents.every((agent) =>
      typeof agent.status === "string" &&
      typeof agent.level === "number" &&
      typeof agent.wounds === "number" &&
      typeof agent.blessed === "boolean" &&
      typeof agent.underground === "boolean" &&
      typeof agent.condition === "number" &&
      typeof agent.fatigue === "number" &&
      typeof agent.sickness === "number" &&
      typeof agent.inspiration === "number",
    )).toBe(true);
    expect(lastSnapshot.tribes.every((tribe) =>
      typeof tribe.armyPower === "number" &&
      typeof tribe.heroes === "number" &&
      typeof tribe.wounded === "number" &&
      typeof tribe.faith === "number" &&
      typeof tribe.water === "number" &&
      typeof tribe.waterworks === "number" &&
      typeof tribe.allies === "number" &&
      typeof tribe.tradePartners === "number" &&
      (tribe.tributeTo === null || typeof tribe.tributeTo === "number") &&
      typeof tribe.tributaries === "number" &&
      typeof tribe.delves === "number" &&
      typeof tribe.undergroundTiles === "number" &&
      typeof tribe.wagons === "number" &&
      typeof tribe.flooded === "number" &&
      typeof tribe.sick === "number" &&
      typeof tribe.exhausted === "number" &&
      typeof tribe.inspired === "number" &&
      typeof tribe.rulerName === "string" &&
      typeof tribe.rulerTitle === "string" &&
      typeof tribe.successionCount === "number",
    )).toBe(true);
    expect(lastSnapshot.tribes.some((tribe) => tribe.siege >= 0)).toBe(true);
  });

  test("small-world simulation perf stays within a reasonable budget", () => {
    const sim = createSimulation("perf-smoke", { width: 384, height: 384 });
    const start = Date.now();
    for (let i = 0; i < 24; i += 1) {
      sim.tick();
    }
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(4500);
  });
});
