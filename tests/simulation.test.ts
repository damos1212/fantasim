import { describe, expect, test } from "vitest";

import { createSimulation } from "../src/sim/simulation";
import { INITIAL_AGENTS_PER_TRIBE, INITIAL_TRIBE_COUNT } from "../src/shared/config";
import { AgentRole, AgeType, BuildingType, RaceType, ResourceType } from "../src/shared/gameTypes";

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
      tribe.resources[ResourceType.Clay] >= 4 &&
      tribe.resources[ResourceType.Clay] <= 6 &&
      tribe.resources[ResourceType.StoneTools] >= 4 &&
      tribe.resources[ResourceType.StoneTools] <= 6 &&
      tribe.resources[ResourceType.BasicWeapons] >= 2 &&
      tribe.resources[ResourceType.BasicWeapons] <= 4 &&
      tribe.resources[ResourceType.BasicArmor] >= 1 &&
      tribe.resources[ResourceType.BasicArmor] <= 3,
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
      return embarkPileTiles >= 10;
    })).toBe(true);
  });

  test("starter halls and stockpiles begin with visible local stocks", () => {
    const sim = createSimulation("starting-local-stock", { width: 768, height: 768 }) as any;

    expect(sim.tribes.every((tribe: any) => {
      const tribeBuildings = sim.buildings.filter((building: any) => building.tribeId === tribe.id);
      const capital = tribeBuildings.find((building: any) => building.type === BuildingType.CapitalHall);
      const stockpile = tribeBuildings.find((building: any) => building.type === BuildingType.Stockpile);
      if (!capital || !stockpile) return false;
      const visibleCapitalStock = (capital.stock[ResourceType.Rations] ?? 0) + (capital.stock[ResourceType.StoneTools] ?? 0) + (capital.stock[ResourceType.BasicWeapons] ?? 0);
      const visibleStockpileStock = (stockpile.stock[ResourceType.Wood] ?? 0) + (stockpile.stock[ResourceType.Stone] ?? 0) + (stockpile.stock[ResourceType.Grain] ?? 0) + (stockpile.stock[ResourceType.Clay] ?? 0);
      return visibleCapitalStock > 0 && visibleStockpileStock > 0;
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

  test("planning construction does not instantly erase stored starter materials", () => {
    const sim = createSimulation("construction-reservations", { width: 768, height: 768 }) as any;

    for (let i = 0; i < 12; i += 1) {
      sim.tick();
    }

    expect(sim.jobs.some((job: any) => job.kind === "build" || job.kind === "craft")).toBe(true);
    expect(sim.tribes.every((tribe: any) => {
      const tribeBuildings = sim.buildings.filter((building: any) => building.tribeId === tribe.id);
      const capital = tribeBuildings.find((building: any) => building.type === BuildingType.CapitalHall);
      const stockpile = tribeBuildings.find((building: any) => building.type === BuildingType.Stockpile);
      if (!capital || !stockpile) return false;
      const visibleStored =
        (capital.stock[ResourceType.Rations] ?? 0)
        + (capital.stock[ResourceType.Wood] ?? 0)
        + (stockpile.stock[ResourceType.Wood] ?? 0)
        + (stockpile.stock[ResourceType.Stone] ?? 0);
      return visibleStored > 0;
    })).toBe(true);
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

  test("builders pave streets and mature buildings over time", { timeout: 30000 }, () => {
    const sim = createSimulation("builder-upkeep", { width: 384, height: 384 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 1400; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    const pavedTiles = (() => {
      let total = 0;
      for (let i = 0; i < sim.world.road.length; i += 1) {
        if (sim.world.road[i] >= 2) total += 1;
      }
      return total;
    })();

    expect(pavedTiles).toBeGreaterThan(0);
    expect(lastSnapshot.buildings.some((building) => building.level > 1)).toBe(true);
  });

  test("capital halls anchor branches and hall loss collapses the local settlement", () => {
    const sim = createSimulation("hall-collapse", { width: 512, height: 512 }) as any;
    const tribe = sim.tribes[0];
    const branchHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX + 18, tribe.capitalY);
    const branchStockpile = sim.placeBuilding(tribe.id, BuildingType.Stockpile, tribe.capitalX + 22, tribe.capitalY);
    const branchHouse = sim.placeBuilding(tribe.id, BuildingType.House, tribe.capitalX + 18, tribe.capitalY + 5);

    expect(sim.buildings.filter((building: any) => building.tribeId === tribe.id && building.type === BuildingType.CapitalHall).length).toBe(2);

    sim.removeBuilding(branchHall);

    expect(sim.buildings.some((building: any) => building.id === branchStockpile.id)).toBe(false);
    expect(sim.buildings.some((building: any) => building.id === branchHouse.id)).toBe(false);
    expect(sim.buildings.filter((building: any) => building.tribeId === tribe.id && building.type === BuildingType.CapitalHall).length).toBe(1);
    expect(sim.hasHeadquarters(tribe.id)).toBe(true);

    const mainHall = sim.buildings.find((building: any) => building.tribeId === tribe.id && building.type === BuildingType.CapitalHall);
    expect(mainHall).toBeTruthy();
    sim.removeBuilding(mainHall);

    expect(sim.buildings.filter((building: any) => building.tribeId === tribe.id && building.type === BuildingType.CapitalHall).length).toBe(0);
    expect(sim.hasHeadquarters(tribe.id)).toBe(false);
    expect(sim.tribes[0].capitalBuildingId).toBe(-1);
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
      typeof agent.moveToX === "number" &&
      typeof agent.moveToY === "number" &&
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
      typeof tribe.branches === "number" &&
      typeof tribe.strainedBranches === "number" &&
      typeof tribe.branchImports === "number" &&
      typeof tribe.branchExports === "number" &&
      typeof tribe.haulJobs === "number" &&
      typeof tribe.contacts === "number" &&
      typeof tribe.allies === "number" &&
      typeof tribe.tradePartners === "number" &&
      (tribe.tributeTo === null || typeof tribe.tributeTo === "number") &&
      typeof tribe.tributaries === "number" &&
      typeof tribe.delves === "number" &&
      typeof tribe.undergroundTiles === "number" &&
      typeof tribe.wagons === "number" &&
      typeof tribe.haulJobs === "number" &&
      typeof tribe.flooded === "number" &&
      typeof tribe.branches === "number" &&
      typeof tribe.strainedBranches === "number" &&
      typeof tribe.branchImports === "number" &&
      typeof tribe.branchExports === "number" &&
      typeof tribe.shortage === "string" &&
      typeof tribe.exportFocus === "string" &&
      typeof tribe.sick === "number" &&
      typeof tribe.exhausted === "number" &&
      typeof tribe.inspired === "number" &&
      typeof tribe.rulerName === "string" &&
      typeof tribe.rulerTitle === "string" &&
      typeof tribe.successionCount === "number" &&
      typeof tribe.shortage === "string" &&
      typeof tribe.exportFocus === "string",
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

  test("trade cargo follows exporter specialization and importer need", () => {
    const sim = createSimulation("trade-shaping", { width: 384, height: 384 }) as any;
    const human = sim.tribes.find((tribe: any) => tribe.race.type === RaceType.Humans);
    const dwarf = sim.tribes.find((tribe: any) => tribe.race.type === RaceType.Dwarves);

    expect(human).toBeTruthy();
    expect(dwarf).toBeTruthy();

    human.age = AgeType.Stone;
    dwarf.age = AgeType.Stone;
    human.discovered[dwarf.id] = true;
    dwarf.discovered[human.id] = true;
    human.tradePacts[dwarf.id] = true;
    dwarf.tradePacts[human.id] = true;
    human.relations[dwarf.id] = 40;
    dwarf.relations[human.id] = 40;
    human.resources[ResourceType.Grain] = 120;
    human.resources[ResourceType.Rations] = 24;
    dwarf.resources[ResourceType.Grain] = 0;
    dwarf.resources[ResourceType.Rations] = 4;

    const warehouse = sim.placeBuilding(human.id, BuildingType.Warehouse, human.capitalX + 6, human.capitalY);
    warehouse.stock[ResourceType.Grain] = 56;
    warehouse.stock[ResourceType.Planks] = 4;

    expect(sim.chooseTradeCargo(human, dwarf)).toBe(ResourceType.Grain);
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
      return maxDistance >= 14 && tribeBuildings.length >= 11;
    });

    expect(expandedTribes.length).toBeGreaterThanOrEqual(1);
  });

  test("productive mature settlements can found or actively plan branch halls", { timeout: 70000 }, () => {
    const sim = createSimulation("branch-hall-growth", { width: 512, height: 512 });
    let lastSnapshot = sim.snapshotNow();

    for (let i = 0; i < 2600; i += 1) {
      const snapshot = sim.tick();
      if (snapshot) {
        lastSnapshot = snapshot;
      }
    }

    const hasBuiltHall = lastSnapshot.tribes.some((tribe) => {
      const tribeBuildings = lastSnapshot.buildings.filter((building) => building.tribeId === tribe.id);
      return tribeBuildings.filter((building) => building.type === BuildingType.CapitalHall).length >= 2;
    });
    const hasPlannedHall = sim.jobs.some((job: any) =>
      job.kind === "build" && job.payload?.buildingType === BuildingType.CapitalHall,
    );

    expect(hasBuiltHall || hasPlannedHall).toBe(true);
  });

  test("branch halls plan local support around productive hubs", () => {
    const sim = createSimulation("branch-hall-support", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes[0];
    tribe.age = AgeType.Stone;
    const branchHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX + 18, tribe.capitalY);
    const branchCenterX = branchHall.x + Math.floor(branchHall.width / 2);
    const branchCenterY = branchHall.y + Math.floor(branchHall.height / 2);
    const lumber = sim.placeBuilding(tribe.id, BuildingType.LumberCamp, branchCenterX + 4, branchCenterY + 1);
    lumber.stock[ResourceType.Wood] = 40;

    sim.generateBranchHubPlans(tribe);

    const nearbyExistingTypes = sim.buildings
      .filter((building: any) =>
        building.tribeId === tribe.id
        && building.id !== branchHall.id
        && Math.abs((building.x + Math.floor(building.width / 2)) - branchCenterX)
          + Math.abs((building.y + Math.floor(building.height / 2)) - branchCenterY) <= 12,
      )
      .map((building: any) => building.type);
    const nearbyPlannedTypes = sim.jobs
      .filter((job: any) => job.tribeId === tribe.id && job.kind === "build")
      .map((job: any) => job.payload?.buildingType);
    const nearbyTypes = [...nearbyExistingTypes, ...nearbyPlannedTypes];

    expect(nearbyTypes.some((type: any) => type === BuildingType.Stockpile || type === BuildingType.Warehouse)).toBe(true);
    expect(nearbyTypes.some((type: any) => type === BuildingType.House)).toBe(true);
    expect(nearbyTypes.some((type: any) =>
      type === BuildingType.Cistern
      || type === BuildingType.Workshop
      || type === BuildingType.Farm
      || type === BuildingType.LumberCamp
      || type === BuildingType.Quarry,
    )).toBe(true);
  });

  test("mining branch halls pull race-specific industry support", () => {
    const sim = createSimulation("branch-mining-support", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes.find((entry: any) => entry.race.type === RaceType.Dwarves);
    expect(tribe).toBeTruthy();
    tribe.age = AgeType.Iron;
    tribe.resources[ResourceType.Wood] = Math.max(tribe.resources[ResourceType.Wood], 32);
    tribe.resources[ResourceType.Stone] = Math.max(tribe.resources[ResourceType.Stone], 28);
    tribe.resources[ResourceType.Ore] = Math.max(tribe.resources[ResourceType.Ore], 18);
    const branchHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX + 18, tribe.capitalY);
    const branchCenterX = branchHall.x + Math.floor(branchHall.width / 2);
    const branchCenterY = branchHall.y + Math.floor(branchHall.height / 2);
    const mine = sim.placeBuilding(tribe.id, BuildingType.Mine, branchCenterX + 4, branchCenterY + 1);
    mine.stock[ResourceType.Ore] = 42;

    sim.generateBranchHubPlans(tribe);

    const plannedTypes = sim.jobs
      .filter((job: any) => job.tribeId === tribe.id && job.kind === "build")
      .map((job: any) => job.payload?.buildingType);

    expect(plannedTypes.some((type: any) => type === BuildingType.Smithy || type === BuildingType.Warehouse)).toBe(true);
  });

  test("branch halls exchange scarce goods between local hubs", () => {
    const sim = createSimulation("branch-exchange", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes.find((entry: any) => entry.race.type === RaceType.Humans);

    expect(tribe).toBeTruthy();

    tribe.age = AgeType.Stone;
    const branchHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX + 18, tribe.capitalY + 10);
    const sourceWarehouse = sim.placeBuilding(tribe.id, BuildingType.Warehouse, tribe.capitalX + 6, tribe.capitalY + 2);
    const branchStockpile = sim.placeBuilding(tribe.id, BuildingType.Stockpile, branchHall.x + 4, branchHall.y);
    sim.placeBuilding(tribe.id, BuildingType.House, branchHall.x - 4, branchHall.y);
    sim.claimTerritory(tribe.id, branchHall.x + 1, branchHall.y + 1, 12);

    sourceWarehouse.stock[ResourceType.Wood] = 72;
    sourceWarehouse.stock[ResourceType.Rations] = 36;
    branchStockpile.stock[ResourceType.Wood] = 0;
    branchStockpile.stock[ResourceType.Rations] = 0;

    sim.generateBranchExchangeHauls(tribe);

    const exchangeHauls = sim.jobs.filter((job: any) => {
      if (job.tribeId !== tribe.id || job.kind !== "haul") return false;
      const payload = job.payload;
      return (
        payload.sourceBuildingId === sourceWarehouse.id
        && (payload.destBuildingId === branchStockpile.id || payload.destBuildingId === branchHall.id)
      );
    });

    expect(exchangeHauls.length).toBeGreaterThan(0);
    expect(exchangeHauls.some((job: any) =>
      job.payload.resourceType === ResourceType.Wood || job.payload.resourceType === ResourceType.Rations,
    )).toBe(true);
  });

  test("tribe summaries expose branch logistics and shortage state", () => {
    const sim = createSimulation("branch-summary", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes.find((entry: any) => entry.race.type === RaceType.Humans);

    expect(tribe).toBeTruthy();

    tribe.age = AgeType.Stone;
    tribe.resources[ResourceType.Rations] = 2;
    const branchHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX + 18, tribe.capitalY + 10);
    const sourceWarehouse = sim.placeBuilding(tribe.id, BuildingType.Warehouse, tribe.capitalX + 6, tribe.capitalY + 2);
    const branchStockpile = sim.placeBuilding(tribe.id, BuildingType.Stockpile, branchHall.x + 4, branchHall.y);
    sim.placeBuilding(tribe.id, BuildingType.House, branchHall.x - 4, branchHall.y);
    sim.claimTerritory(tribe.id, branchHall.x + 1, branchHall.y + 1, 8);

    sourceWarehouse.stock[ResourceType.Wood] = 72;
    sourceWarehouse.stock[ResourceType.Rations] = 36;
    branchStockpile.stock[ResourceType.Wood] = 0;
    branchStockpile.stock[ResourceType.Rations] = 0;

    sim.generateBranchExchangeHauls(tribe);
    const snapshot = sim.snapshotNow();
    const tribeSummary = snapshot.tribes.find((entry: any) => entry.id === tribe.id);

    expect(tribeSummary).toBeTruthy();
    expect(tribeSummary.branches).toBeGreaterThanOrEqual(1);
    expect(tribeSummary.branchImports).toBeGreaterThan(0);
    expect(tribeSummary.strainedBranches).toBeGreaterThanOrEqual(1);
    expect(typeof tribeSummary.branchExports).toBe("number");
    expect(typeof tribeSummary.haulJobs).toBe("number");
    expect(typeof tribeSummary.shortage).toBe("string");
    expect(typeof tribeSummary.exportFocus).toBe("string");
  });

  test("understocked branch halls pull self-supply buildings", () => {
    const sim = createSimulation("branch-shortage-support", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes.find((entry: any) => entry.race.type === RaceType.Humans);

    expect(tribe).toBeTruthy();

    tribe.age = AgeType.Stone;
    const branchHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX + 18, tribe.capitalY + 8);
    const branchStockpile = sim.placeBuilding(tribe.id, BuildingType.Stockpile, branchHall.x + 4, branchHall.y);
    sim.placeBuilding(tribe.id, BuildingType.House, branchHall.x - 4, branchHall.y);
    sim.placeBuilding(tribe.id, BuildingType.House, branchHall.x, branchHall.y + 5);
    sim.placeBuilding(tribe.id, BuildingType.House, branchHall.x + 5, branchHall.y + 5);
    sim.claimTerritory(tribe.id, branchHall.x + 1, branchHall.y + 1, 8);

    branchStockpile.stock[ResourceType.Rations] = 0;
    branchStockpile.stock[ResourceType.Grain] = 0;
    branchStockpile.stock[ResourceType.Wood] = 0;
    branchStockpile.stock[ResourceType.Stone] = 0;

    sim.generateBranchHubPlans(tribe);

    const plannedTypes = sim.jobs
      .filter((job: any) => job.tribeId === tribe.id && job.kind === "build")
      .map((job: any) => job.payload?.buildingType);

    expect(plannedTypes.some((type: any) =>
      type === BuildingType.Farm || type === BuildingType.LumberCamp || type === BuildingType.Quarry,
    )).toBe(true);
  });

  test("branch redistribution does not drain a weak branch below reserve", () => {
    const sim = createSimulation("branch-reserve-protection", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes.find((entry: any) => entry.race.type === RaceType.Humans);

    expect(tribe).toBeTruthy();

    tribe.age = AgeType.Stone;
    const richHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX + 22, tribe.capitalY);
    const richStore = sim.placeBuilding(tribe.id, BuildingType.Warehouse, richHall.x + 4, richHall.y);
    const poorHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX - 22, tribe.capitalY + 10);
    const poorStore = sim.placeBuilding(tribe.id, BuildingType.Warehouse, poorHall.x + 4, poorHall.y);
    const needyCore = sim.placeBuilding(tribe.id, BuildingType.Workshop, tribe.capitalX + 4, tribe.capitalY + 2);
    sim.placeBuilding(tribe.id, BuildingType.House, poorHall.x - 4, poorHall.y);
    sim.placeBuilding(tribe.id, BuildingType.House, poorHall.x, poorHall.y + 5);
    sim.claimTerritory(tribe.id, poorHall.x + 1, poorHall.y + 1, 8);
    sim.claimTerritory(tribe.id, richHall.x + 1, richHall.y + 1, 8);

    richStore.stock[ResourceType.Wood] = 90;
    poorStore.stock[ResourceType.Wood] = 10;
    needyCore.stock[ResourceType.Wood] = 0;

    const destination = sim.findRedistributionDestinationBuilding(tribe.id, poorStore, ResourceType.Wood);

    expect(destination?.id).not.toBe(needyCore.id);
  });

  test("strained branches pull sustainment hauls from rich halls", () => {
    const sim = createSimulation("branch-sustainment-hauls", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes.find((entry: any) => entry.race.type === RaceType.Humans);

    expect(tribe).toBeTruthy();

    tribe.age = AgeType.Stone;
    const sourceWarehouse = sim.placeBuilding(tribe.id, BuildingType.Warehouse, tribe.capitalX + 6, tribe.capitalY + 1);
    sourceWarehouse.stock[ResourceType.Rations] = 72;
    sourceWarehouse.stock[ResourceType.Wood] = 68;
    sourceWarehouse.stock[ResourceType.Stone] = 54;

    const branchHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX + 20, tribe.capitalY + 12);
    const branchStore = sim.placeBuilding(tribe.id, BuildingType.Stockpile, branchHall.x + 4, branchHall.y);
    sim.placeBuilding(tribe.id, BuildingType.House, branchHall.x - 4, branchHall.y);
    sim.placeBuilding(tribe.id, BuildingType.House, branchHall.x, branchHall.y + 5);
    sim.claimTerritory(tribe.id, branchHall.x + 1, branchHall.y + 1, 8);

    branchStore.stock[ResourceType.Rations] = 0;
    branchStore.stock[ResourceType.Wood] = 0;
    branchStore.stock[ResourceType.Stone] = 0;

    sim.generateBranchSustainmentHauls(tribe);

    const branchHauls = sim.jobs.filter((job: any) => {
      if (job.tribeId !== tribe.id || job.kind !== "haul") return false;
      const payload = job.payload;
      return payload.destBuildingId === branchStore.id || payload.destBuildingId === branchHall.id;
    });

    expect(branchHauls.length).toBeGreaterThan(0);
    expect(branchHauls.some((job: any) =>
      job.payload.resourceType === ResourceType.Rations
      || job.payload.resourceType === ResourceType.Wood
      || job.payload.resourceType === ResourceType.Stone,
    )).toBe(true);
  });

  test("mature branch halls carry higher recurring resource targets", () => {
    const sim = createSimulation("branch-maturity-targets", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes.find((entry: any) => entry.race.type === RaceType.Humans);

    expect(tribe).toBeTruthy();

    tribe.age = AgeType.Bronze;
    const sparseHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX + 16, tribe.capitalY + 6);
    const matureHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX - 22, tribe.capitalY + 10);
    sim.placeBuilding(tribe.id, BuildingType.Stockpile, sparseHall.x + 4, sparseHall.y);
    const matureStore = sim.placeBuilding(tribe.id, BuildingType.Stockpile, matureHall.x + 4, matureHall.y);
    const matureFarm = sim.placeBuilding(tribe.id, BuildingType.Farm, matureHall.x - 2, matureHall.y + 6);
    matureFarm.stock[ResourceType.Grain] = 44;
    sim.placeBuilding(tribe.id, BuildingType.House, matureHall.x - 4, matureHall.y);
    sim.placeBuilding(tribe.id, BuildingType.House, matureHall.x, matureHall.y + 5);
    sim.placeBuilding(tribe.id, BuildingType.House, matureHall.x + 5, matureHall.y + 4);
    matureStore.stock[ResourceType.Rations] = 28;
    matureStore.stock[ResourceType.Wood] = 24;
    matureStore.stock[ResourceType.Stone] = 20;

    const sparseFoodTarget = sim.hallLocalResourceTarget(tribe.id, sparseHall, ResourceType.Rations);
    const matureFoodTarget = sim.hallLocalResourceTarget(tribe.id, matureHall, ResourceType.Rations);
    const sparseWoodTarget = sim.hallLocalResourceTarget(tribe.id, sparseHall, ResourceType.Wood);
    const matureWoodTarget = sim.hallLocalResourceTarget(tribe.id, matureHall, ResourceType.Wood);

    expect(matureFoodTarget).toBeGreaterThan(sparseFoodTarget);
    expect(matureWoodTarget).toBeGreaterThan(sparseWoodTarget);
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

  test("mature tribes can field wagons for long-haul logistics", () => {
    const sim = createSimulation("wagon-logistics", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes[0];
    tribe.age = AgeType.Stone;
    tribe.resources[ResourceType.Livestock] = 4;
    tribe.resources[ResourceType.Wood] = 40;
    tribe.resources[ResourceType.Planks] = 16;
    sim.jobs.push({
      id: 999001,
      tribeId: tribe.id,
      kind: "haul",
      x: tribe.capitalX + 10,
      y: tribe.capitalY,
      priority: 6,
      claimedBy: null,
      payload: {
        sourceX: tribe.capitalX + 10,
        sourceY: tribe.capitalY,
        sourceBuildingId: null,
        dropX: tribe.capitalX - 10,
        dropY: tribe.capitalY,
        destBuildingId: null,
        resourceType: ResourceType.Wood,
        amount: 12,
        targetJobId: null,
      },
    });

    sim.ensureWagonsForTribe(tribe);

    const lastSnapshot = sim.snapshotNow();
    expect(lastSnapshot.tribes.some((entry: any) => entry.id === tribe.id && entry.wagons > 0)).toBe(true);
    expect(lastSnapshot.wagons.some((wagon: any) => wagon.tribeId === tribe.id)).toBe(true);
  });

  test("wagons prefer strained branch-balance hauls over trivial local hauls", () => {
    const sim = createSimulation("wagon-branch-priority", { width: 384, height: 384 }) as any;
    const tribe = sim.tribes.find((entry: any) => entry.race.type === RaceType.Humans);
    expect(tribe).toBeTruthy();

    tribe.age = AgeType.Stone;
    const home = sim.placeBuilding(tribe.id, BuildingType.Warehouse, tribe.capitalX + 5, tribe.capitalY);
    const source = sim.placeBuilding(tribe.id, BuildingType.Warehouse, tribe.capitalX + 8, tribe.capitalY + 2);
    const localDest = sim.placeBuilding(tribe.id, BuildingType.Stockpile, tribe.capitalX + 10, tribe.capitalY + 3);
    const branchHall = sim.placeBuilding(tribe.id, BuildingType.CapitalHall, tribe.capitalX + 22, tribe.capitalY + 12);
    const branchDest = sim.placeBuilding(tribe.id, BuildingType.Stockpile, branchHall.x + 4, branchHall.y);
    sim.placeBuilding(tribe.id, BuildingType.House, branchHall.x - 4, branchHall.y);
    sim.placeBuilding(tribe.id, BuildingType.House, branchHall.x, branchHall.y + 5);
    sim.claimTerritory(tribe.id, branchHall.x + 1, branchHall.y + 1, 8);

    source.stock[ResourceType.Wood] = 90;
    localDest.stock[ResourceType.Wood] = 6;
    branchDest.stock[ResourceType.Wood] = 0;

    const localCenterX = localDest.x + Math.floor(localDest.width / 2);
    const localCenterY = localDest.y + Math.floor(localDest.height / 2);
    const branchCenterX = branchDest.x + Math.floor(branchDest.width / 2);
    const branchCenterY = branchDest.y + Math.floor(branchDest.height / 2);
    const sourceCenterX = source.x + Math.floor(source.width / 2);
    const sourceCenterY = source.y + Math.floor(source.height / 2);

    const localJob = {
      id: 900001,
      tribeId: tribe.id,
      kind: "haul",
      x: sourceCenterX,
      y: sourceCenterY,
      priority: 6,
      claimedBy: null,
      payload: {
        sourceX: sourceCenterX,
        sourceY: sourceCenterY,
        sourceBuildingId: source.id,
        dropX: localCenterX,
        dropY: localCenterY,
        destBuildingId: localDest.id,
        resourceType: ResourceType.Wood,
        amount: 10,
        targetJobId: null,
      },
    };
    const branchJob = {
      id: 900002,
      tribeId: tribe.id,
      kind: "haul",
      x: sourceCenterX,
      y: sourceCenterY,
      priority: 6,
      claimedBy: null,
      payload: {
        sourceX: sourceCenterX,
        sourceY: sourceCenterY,
        sourceBuildingId: source.id,
        dropX: branchCenterX,
        dropY: branchCenterY,
        destBuildingId: branchDest.id,
        resourceType: ResourceType.Wood,
        amount: 10,
        targetJobId: null,
      },
    };
    sim.jobs.push(localJob, branchJob);

    const homeCenterX = home.x + Math.floor(home.width / 2);
    const homeCenterY = home.y + Math.floor(home.height / 2);
    const wagon = {
      id: 910001,
      tribeId: tribe.id,
      homeBuildingId: home.id,
      x: homeCenterX,
      y: homeCenterY,
      homeX: homeCenterX,
      homeY: homeCenterY,
      targetX: homeCenterX,
      targetY: homeCenterY,
      path: [],
      pathIndex: 0,
      cargoType: ResourceType.None,
      cargoAmount: 0,
      task: 0,
      targetJobId: null,
      moveCooldown: 0,
    };

    sim.assignWagonRoute(wagon, tribe, home);

    expect(wagon.targetJobId).toBe(branchJob.id);
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
