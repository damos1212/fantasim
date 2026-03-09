import { describe, expect, test } from "vitest";

import { createSimulation } from "../src/sim/simulation";
import { INITIAL_AGENTS_PER_TRIBE, INITIAL_TRIBE_COUNT } from "../src/shared/config";
import { AgentRole, AgeType, BuildingType, ResourceType } from "../src/shared/gameTypes";

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

  test("starts with limited tech and nearby wildlife pressure", () => {
    const sim = createSimulation("starting-state", { width: 768, height: 768 });
    const snapshot = sim.snapshotNow();

    expect(snapshot.tribes.every((tribe) => tribe.age === AgeType.Primitive)).toBe(true);
    expect(snapshot.tribes.every((tribe) => !tribe.techs.includes("Modern Logistics") && !tribe.techs.includes("Airfields"))).toBe(true);
    expect(snapshot.tribes.every((tribe) => tribe.techs.length <= 6)).toBe(true);
    expect(snapshot.tribes.every((tribe) => tribe.flooded === 0)).toBe(true);
    expect(snapshot.tribes.every((tribe) => tribe.contacts === 0 && tribe.enemyCount === 0 && tribe.allies === 0)).toBe(true);
    expect(snapshot.tribes.every((tribe) =>
      snapshot.animals.some((animal) => Math.abs(animal.x - tribe.capitalX) + Math.abs(animal.y - tribe.capitalY) <= 18),
    )).toBe(true);
    expect(sim.tribes.every((tribe) =>
      tribe.water >= 40 &&
      tribe.resources[ResourceType.Clay] >= 8 &&
      tribe.resources[ResourceType.StoneTools] >= 8 &&
      tribe.resources[ResourceType.BasicWeapons] >= 5 &&
      tribe.resources[ResourceType.BasicArmor] >= 4,
    )).toBe(true);
    expect(sim.tribes.every((tribe) => {
      let embarkPileTiles = 0;
      for (let dy = -10; dy <= 10; dy += 1) {
        for (let dx = -10; dx <= 10; dx += 1) {
          const x = tribe.capitalX + dx;
          const y = tribe.capitalY + dy;
          if (x < 0 || y < 0 || x >= sim.world.width || y >= sim.world.height) continue;
          const index = y * sim.world.width + x;
          const type = sim.world.resourceType[index] as ResourceType;
          const amount = sim.world.resourceAmount[index] ?? 0;
          if (
            amount > 0
            && (type === ResourceType.Wood || type === ResourceType.Stone || type === ResourceType.Clay || type === ResourceType.Grain || type === ResourceType.Berries)
          ) {
            embarkPileTiles += 1;
          }
        }
      }
      return embarkPileTiles >= 12;
    })).toBe(true);
  });

  test("primitive tribes start with a workable specialist mix and starter gear", () => {
    const sim = createSimulation("starting-roles", { width: 768, height: 768 });
    const snapshot = sim.snapshotNow();

    for (const tribe of snapshot.tribes) {
      const tribeAgents = snapshot.agents.filter((agent) => agent.tribeId === tribe.id);
      const roleCounts = new Map<number, number>();
      for (const agent of tribeAgents) {
        roleCounts.set(agent.role, (roleCounts.get(agent.role) ?? 0) + 1);
      }
      expect(roleCounts.get(AgentRole.Farmer) ?? 0).toBeGreaterThanOrEqual(3);
      expect(roleCounts.get(AgentRole.Woodcutter) ?? 0).toBeGreaterThanOrEqual(2);
      expect(roleCounts.get(AgentRole.Miner) ?? 0).toBeGreaterThanOrEqual(2);
      expect(roleCounts.get(AgentRole.Builder) ?? 0).toBeGreaterThanOrEqual(2);
      expect(roleCounts.get(AgentRole.Hauler) ?? 0).toBeGreaterThanOrEqual(2);
      expect(roleCounts.get(AgentRole.Crafter) ?? 0).toBeGreaterThanOrEqual(1);
      expect(roleCounts.get(AgentRole.Soldier) ?? 0).toBeGreaterThanOrEqual(1);
      expect(tribeAgents.every((agent) => agent.gear.weapon.length > 0 && agent.gear.armor.length > 0)).toBe(true);
    }
  });

  test("construction is staged and does not complete instantly", () => {
    const sim = createSimulation("construction-pacing", { width: 768, height: 768 });
    const initialBuildingCount = sim.buildings.length;

    for (let i = 0; i < 25; i += 1) {
      sim.tick();
    }

    const activeBuildJobs = sim.jobs.filter((job) => job.kind === "build");
    expect(activeBuildJobs.length).toBeGreaterThan(0);
    expect(sim.buildings.length).toBeLessThan(initialBuildingCount + INITIAL_TRIBE_COUNT * 3);
  });

  test("starter settlements are connected by roads", () => {
    const sim = createSimulation("starter-roads", { width: 768, height: 768 }) as any;

    expect(sim.tribes.every((tribe: any) => {
      const tribeBuildings = sim.buildings.filter((building: any) => building.tribeId === tribe.id);
      return tribeBuildings.every((building: any) => {
        const centerX = building.x + Math.floor(building.width / 2);
        const centerY = building.y + Math.floor(building.height / 2);
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (x < 0 || y < 0 || x >= sim.world.width || y >= sim.world.height) continue;
            const index = y * sim.world.width + x;
            if (sim.world.road[index] > 0 && sim.world.owner[index] === tribe.id) {
              return true;
            }
          }
        }
        return false;
      });
    })).toBe(true);
  });

  test("remains stable across extended ticks and reaches early settled progression", { timeout: 120000 }, () => {
    const sim = createSimulation("long-run", { width: 512, height: 512 });
    let lastSnapshot = sim.snapshotNow();
    for (let i = 0; i < 1800; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    expect(lastSnapshot.tribes.every((tribe) => tribe.population > 0)).toBe(true);
    expect(lastSnapshot.agents.every((agent) => agent.x >= 0 && agent.y >= 0)).toBe(true);
    expect(lastSnapshot.buildings.length).toBeGreaterThanOrEqual(INITIAL_TRIBE_COUNT * 4);
    expect(lastSnapshot.tribes.some((tribe) => {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      return tribe.age >= AgeType.Stone
        || tribeBuildings.some((building) => building.type === BuildingType.Workshop || building.type === BuildingType.Warehouse)
        || tribeBuildings.filter((building) => building.type === BuildingType.Stockpile).length >= 2;
    })).toBe(true);
    expect(lastSnapshot.tribes.every((tribe) => tribe.age <= AgeType.Bronze)).toBe(true);
    expect(lastSnapshot.tribes.every((tribe) => typeof tribe.horses === "number" && typeof tribe.boats === "number")).toBe(true);
    expect(lastSnapshot.tribes.every((tribe) => tribe.techs.length >= 3)).toBe(true);
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
      typeof tribe.contacts === "number" &&
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

  test("early game builds bootstrap infrastructure before higher-age expansion", { timeout: 20000 }, () => {
    const sim = createSimulation("bootstrap-focus", { width: 512, height: 512 });

    let lastSnapshot = sim.snapshotNow();
    for (let i = 0; i < 900; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    let farmAndLumber = 0;
    let withWater = 0;
    let noAdvancedIndustry = 0;
    for (const tribe of lastSnapshot.tribes) {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      const hasFarm = tribeBuildings.some((building) => building.type === BuildingType.Farm);
      const hasLumber = tribeBuildings.some((building) => building.type === BuildingType.LumberCamp);
      const hasCistern = tribeBuildings.some((building) => building.type === BuildingType.Cistern);
      if (hasFarm && hasLumber) farmAndLumber += 1;
      if (hasCistern || tribe.water >= 8) withWater += 1;
      if (!tribeBuildings.some((building) => building.type === BuildingType.Foundry || building.type === BuildingType.Factory || building.type === BuildingType.PowerPlant || building.type === BuildingType.Airfield)) {
        noAdvancedIndustry += 1;
      }
    }

    expect(farmAndLumber).toBeGreaterThanOrEqual(Math.ceil(lastSnapshot.tribes.length * 0.75));
    expect(withWater).toBeGreaterThanOrEqual(Math.ceil(lastSnapshot.tribes.length * 0.75));
    expect(noAdvancedIndustry).toBe(lastSnapshot.tribes.length);
    expect(lastSnapshot.tribes.every((tribe) => tribe.age <= AgeType.Stone)).toBe(true);
  });

  test("tribes keep water reserves and remain active through the opener", { timeout: 35000 }, () => {
    const sim = createSimulation("water-balance", { width: 512, height: 512 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 900; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    const watered = lastSnapshot.tribes.filter((tribe) => tribe.water >= 12).length;
    const active = lastSnapshot.tribes.filter((tribe) => tribe.activity !== "Securing water").length;
    expect(watered).toBeGreaterThanOrEqual(Math.ceil(lastSnapshot.tribes.length * 0.75));
    expect(active).toBeGreaterThanOrEqual(Math.ceil(lastSnapshot.tribes.length * 0.75));
  });

  test("field work stays visibly active beyond the first bootstrap", { timeout: 35000 }, () => {
    const sim = createSimulation("field-activity", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 1200; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    const activeFieldAgents = lastSnapshot.agents.filter((agent) =>
      agent.task === "farm"
      || agent.task === "gather"
      || agent.task === "cut_tree"
      || agent.task === "mine"
      || agent.task === "quarry"
      || agent.task === "hunt"
      || agent.task === "fish"
      || agent.task === "haul"
      || agent.task === "build",
    ).length;
    const carryingAgents = lastSnapshot.agents.filter((agent) => agent.carrying !== ResourceType.None && agent.carryingAmount > 0).length;

    expect(activeFieldAgents).toBeGreaterThanOrEqual(Math.ceil(lastSnapshot.agents.length * 0.35));
    expect(carryingAgents).toBeGreaterThanOrEqual(6);
  });

  test("tribes make first contact before wider diplomacy activates", { timeout: 30000 }, () => {
    const sim = createSimulation("discovery-flow", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    expect(lastSnapshot.tribes.every((tribe) => tribe.contacts === 0)).toBe(true);

    for (let i = 0; i < 1400; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    expect(lastSnapshot.tribes.some((tribe) => tribe.contacts > 0)).toBe(true);
  });

  test("maturing tribes add logistics districts as settlements spread", { timeout: 30000 }, () => {
    const sim = createSimulation("district-flow", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 1600; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    expect(lastSnapshot.tribes.some((tribe) => {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      const stockpiles = tribeBuildings.filter((building) => building.type === BuildingType.Stockpile).length;
      const warehouses = tribeBuildings.filter((building) => building.type === BuildingType.Warehouse).length;
      return stockpiles >= 2 || warehouses >= 1;
    })).toBe(true);
    expect(new Set(lastSnapshot.buildings.map((building) => `${building.tribeId}:${building.type}:${building.x}:${building.y}`)).size).toBe(lastSnapshot.buildings.length);
  });

  test("settlements continue expanding beyond the initial core", { timeout: 35000 }, () => {
    const sim = createSimulation("expansion-shape", { width: 512, height: 512 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 1800; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    const expanded = lastSnapshot.tribes.filter((tribe) => {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      const farBuildings = tribeBuildings.filter((building) =>
        Math.abs(building.x - tribe.capitalX) + Math.abs(building.y - tribe.capitalY) >= 10,
      ).length;
      return tribeBuildings.length >= 12 && farBuildings >= 4;
    }).length;

    expect(expanded).toBeGreaterThanOrEqual(1);
  });

  test("maturing settlements expand beyond the immediate capital cluster", { timeout: 45000 }, () => {
    const sim = createSimulation("outward-growth", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 1800; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    const expandedTribes = lastSnapshot.tribes.filter((tribe) => {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      const maxDistance = Math.max(...tribeBuildings.map((building) =>
        Math.abs(building.x + Math.floor(building.width / 2) - tribe.capitalX)
        + Math.abs(building.y + Math.floor(building.height / 2) - tribe.capitalY),
      ));
      return maxDistance >= 14 && tribeBuildings.length >= 12;
    });

    expect(expandedTribes.length).toBeGreaterThanOrEqual(Math.ceil(lastSnapshot.tribes.length * 0.25));
  });

  test("expanding settlements keep buildings attached to road influence", { timeout: 45000 }, () => {
    const sim = createSimulation("road-influence", { width: 384, height: 384 }) as any;
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 1800; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    expect(lastSnapshot.buildings.every((building: any) => {
      for (let dy = 0; dy < building.height; dy += 1) {
        for (let dx = 0; dx < building.width; dx += 1) {
          const x = building.x + dx;
          const y = building.y + dy;
          const index = y * sim.world.width + x;
          if (sim.world.owner[index] !== building.tribeId) {
            return false;
          }
        }
      }
      const centerX = building.x + Math.floor(building.width / 2);
      const centerY = building.y + Math.floor(building.height / 2);
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const x = centerX + dx;
          const y = centerY + dy;
          if (x < 0 || y < 0 || x >= sim.world.width || y >= sim.world.height) continue;
          const index = y * sim.world.width + x;
          if (sim.world.road[index] > 0 && sim.world.owner[index] === building.tribeId) {
            return true;
          }
        }
      }
      return false;
    })).toBe(true);
  });

  test("active storage hubs attract nearby industry or housing", { timeout: 30000 }, () => {
    const sim = createSimulation("district-hubs", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 2200; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    expect(lastSnapshot.tribes.some((tribe) => {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      const hubs = tribeBuildings.filter((building) =>
        (building.type === BuildingType.Warehouse || building.type === BuildingType.Stockpile)
        && building.stockAmount >= 32,
      );
      return hubs.some((hub) => tribeBuildings.some((other) =>
        other.id !== hub.id
        && (other.type === BuildingType.Workshop || other.type === BuildingType.House || other.type === BuildingType.Smithy)
        && Math.abs(other.x - hub.x) + Math.abs(other.y - hub.y) <= 10,
      ));
    })).toBe(true);
  });

  test("stable settlements keep adding second-wave extraction and logistics sites", { timeout: 70000 }, () => {
    const sim = createSimulation("second-wave-districts", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 2100; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    const expandingTribes = lastSnapshot.tribes.filter((tribe) => {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      const farms = tribeBuildings.filter((building) => building.type === BuildingType.Farm).length;
      const lumber = tribeBuildings.filter((building) => building.type === BuildingType.LumberCamp).length;
      const quarries = tribeBuildings.filter((building) => building.type === BuildingType.Quarry).length;
      const stockpiles = tribeBuildings.filter((building) => building.type === BuildingType.Stockpile).length;
      const warehouses = tribeBuildings.filter((building) => building.type === BuildingType.Warehouse).length;
      return (farms >= 2 || lumber >= 2 || quarries >= 1) && (stockpiles >= 2 || warehouses >= 1) && tribeBuildings.length >= 14;
    }).length;

    expect(expandingTribes).toBeGreaterThanOrEqual(1);
  });

  test("productive remote sites grow satellite housing or storage", { timeout: 70000 }, () => {
    const sim = createSimulation("remote-satellites", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 2200; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    const satelliteGrowth = lastSnapshot.tribes.some((tribe) => {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      const remotes = tribeBuildings.filter((building) =>
        (building.type === BuildingType.LumberCamp
          || building.type === BuildingType.Quarry
          || building.type === BuildingType.Mine
          || building.type === BuildingType.Farm
          || building.type === BuildingType.Orchard)
        && building.stockAmount >= 20,
      );
      return remotes.some((remote) => tribeBuildings.some((other) =>
        other.id !== remote.id
        && (other.type === BuildingType.House || other.type === BuildingType.Stockpile || other.type === BuildingType.Warehouse || other.type === BuildingType.Workshop)
        && Math.abs((other.x + Math.floor(other.width / 2)) - (remote.x + Math.floor(remote.width / 2)))
          + Math.abs((other.y + Math.floor(other.height / 2)) - (remote.y + Math.floor(remote.height / 2))) <= 10,
      ));
    });

    expect(satelliteGrowth).toBe(true);
  });

  test("maturing settlements process food into rations at craft sites", { timeout: 60000 }, () => {
    const sim = createSimulation("ration-processing", { width: 384, height: 384 }) as any;

    for (let i = 0; i < 2200; i += 1) {
      sim.tick();
    }

    expect(sim.buildings.some((building: any) =>
      (building.type === BuildingType.Workshop || building.type === BuildingType.Tavern || building.type === BuildingType.Warehouse)
      && (building.stock[ResourceType.Rations] ?? 0) > 0,
    )).toBe(true);
  });

  test("deep mines do not generate passive resources without active labor", () => {
    const sim = createSimulation("deep-mine-passive", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes[0];
    tribe.age = AgeType.Iron;
    const oreBefore = tribe.resources[ResourceType.Ore];
    const stoneBefore = tribe.resources[ResourceType.Stone];
    sim.placeBuilding(tribe.id, BuildingType.DeepMine, tribe.capitalX + 10, tribe.capitalY);

    for (let i = 0; i < 48; i += 1) {
      sim.tick();
    }

    expect(tribe.resources[ResourceType.Ore]).toBeLessThanOrEqual(oreBefore + 2);
    expect(tribe.resources[ResourceType.Stone]).toBeLessThanOrEqual(stoneBefore + 2);
  });

  test("active settlements accumulate visible local building stocks", { timeout: 30000 }, () => {
    const sim = createSimulation("local-stocks", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 900; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    expect(lastSnapshot.buildings.some((building) => building.stockResource !== ResourceType.None && building.stockAmount > 0)).toBe(true);
  });

  test("surplus extraction gets redistributed beyond raw source sites", { timeout: 30000 }, () => {
    const sim = createSimulation("stock-redistribution", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 1500; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    const extractorTypes = new Set([
      BuildingType.Farm,
      BuildingType.Orchard,
      BuildingType.LumberCamp,
      BuildingType.Quarry,
      BuildingType.Mine,
      BuildingType.DeepMine,
      BuildingType.FishingHut,
      BuildingType.Fishery,
    ]);
    const logisticsTypes = new Set([
      BuildingType.Stockpile,
      BuildingType.Warehouse,
      BuildingType.CapitalHall,
      BuildingType.Workshop,
      BuildingType.Smithy,
      BuildingType.Foundry,
      BuildingType.Factory,
    ]);

    expect(lastSnapshot.tribes.some((tribe) => {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      const logisticsFilled = tribeBuildings.some((building) => logisticsTypes.has(building.type) && building.stockAmount > 0);
      const extractorPeak = tribeBuildings
        .filter((building) => extractorTypes.has(building.type))
        .reduce((peak, building) => Math.max(peak, building.stockAmount), 0);
      const logisticsPeak = tribeBuildings
        .filter((building) => logisticsTypes.has(building.type))
        .reduce((peak, building) => Math.max(peak, building.stockAmount), 0);
      return logisticsFilled && logisticsPeak >= 80 && extractorPeak > 0;
    })).toBe(true);
  });

  test("stable stone-age tribes begin primitive industry before bronze", { timeout: 60000 }, () => {
    const sim = createSimulation("stone-industry", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 1800; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    expect(lastSnapshot.tribes.some((tribe) => {
      if (tribe.age < AgeType.Stone) return false;
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      return tribeBuildings.some((building) => building.type === BuildingType.Workshop || building.type === BuildingType.Mine);
    })).toBe(true);
  });

  test("stone-age proto-industry gains supporting labor roles", { timeout: 30000 }, () => {
    const sim = createSimulation("stone-labor", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 1800; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    expect(lastSnapshot.tribes.some((tribe) => {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      if (!tribeBuildings.some((building) => building.type === BuildingType.Workshop)) {
        return false;
      }
      const tribeAgents = lastSnapshot.agents.filter((agent) => agent.tribeId === tribe.id);
      const crafters = tribeAgents.filter((agent) => agent.role === AgentRole.Crafter).length;
      const miners = tribeAgents.filter((agent) => agent.role === AgentRole.Miner).length;
      const haulers = tribeAgents.filter((agent) => agent.role === AgentRole.Hauler).length;
      return crafters >= 1 && miners >= 2 && haulers >= 2;
    })).toBe(true);
  });

  test("maturing tribes surface active work statuses instead of only condition labels", { timeout: 30000 }, () => {
    const sim = createSimulation("status-clarity", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 1800; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    expect(lastSnapshot.agents.some((agent) =>
      agent.status === "Building"
      || agent.status === "Crafting"
      || agent.status === "Digging"
      || agent.status === "Cutting timber"
      || agent.status === "Working the fields"
      || agent.status.startsWith("Hauling "),
    )).toBe(true);
  });
});
