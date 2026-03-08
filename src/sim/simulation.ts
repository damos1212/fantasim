import {
  HOUSE_CAPACITY,
  INITIAL_AGENTS_PER_TRIBE,
  INITIAL_ANIMAL_HERDS,
  INITIAL_TRIBE_COUNT,
  MAX_AGENTS_PER_TRIBE,
  MAX_JOB_RADIUS,
  SEASON_TICKS,
  SIM_TICKS_PER_SECOND,
  SNAPSHOT_TICKS,
  STRATEGY_TICKS,
  TRIBE_TERRITORY_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  YEAR_TICKS,
} from "../shared/config";
import { CARDINALS, coordsOf, inBounds, indexOf, manhattan } from "../shared/grid";
import {
  AGE_NAMES,
  AgentConditionType,
  AgentRole,
  AgentSnapshot,
  AgeType,
  AnimalSnapshot,
  AnimalType,
  BoatSnapshot,
  BoatTaskType,
  CaravanSnapshot,
  CaravanTaskType,
  BUILDING_DEFS,
  BiomeType,
  BuildingSnapshot,
  BuildingType,
  DiplomacyState,
  DynamicSnapshot,
  DungeonSnapshot,
  DungeonType,
  EventSnapshot,
  FeatureType,
  LegendaryCreatureSnapshot,
  PlannedSiteSnapshot,
  LegendaryCreatureType,
  RaceDef,
  RACE_DEFS,
  RaceType,
  ResourceType,
  SeasonType,
  SiegeEngineSnapshot,
  SiegeEngineType,
  TerrainType,
  TileUpdate,
  TribeSummary,
  UndergroundFeatureType,
  UndergroundTerrainType,
  WagonSnapshot,
  WagonTaskType,
  WeatherCellSnapshot,
  WeatherKind,
} from "../shared/gameTypes";
import { chooseOne, createSeededRandom, randInt } from "../shared/rng";
import { findPath } from "./pathfinding";
import { distanceToNearestFeature, generateWorld, hasAdjacentWater, isBuildableTerrain, isWaterTerrain, scoreStartForRace, WorldData } from "./worldgen";

type TribeState = {
  id: number;
  race: RaceDef;
  name: string;
  color: number;
  age: AgeType;
  research: number;
  faith: number;
  water: number;
  resources: number[];
  morale: number;
  capitalBuildingId: number;
  capitalX: number;
  capitalY: number;
  rulerAgentId: number | null;
  successionCount: number;
  relations: number[];
  tradePacts: boolean[];
  discovered: boolean[];
  tributeTo: number | null;
  stableCount: number;
  lastFoodTick: number;
};

type BuildingState = {
  id: number;
  tribeId: number;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  stock: number[];
};

type AnimalState = {
  id: number;
  type: AnimalType;
  x: number;
  y: number;
  moveCooldown: number;
};

type BoatState = {
  id: number;
  tribeId: number;
  dockBuildingId: number;
  x: number;
  y: number;
  dockX: number;
  dockY: number;
  targetX: number;
  targetY: number;
  path: number[];
  pathIndex: number;
  cargo: number;
  task: BoatTaskType;
  moveCooldown: number;
};

type CaravanState = {
  id: number;
  tribeId: number;
  partnerTribeId: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  path: number[];
  pathIndex: number;
  cargoType: ResourceType;
  cargoAmount: number;
  task: CaravanTaskType;
  moveCooldown: number;
};

type WagonState = {
  id: number;
  tribeId: number;
  homeBuildingId: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  path: number[];
  pathIndex: number;
  cargoType: ResourceType;
  cargoAmount: number;
  task: WagonTaskType;
  targetJobId: number | null;
  moveCooldown: number;
};

type SiegeEngineState = {
  id: number;
  tribeId: number;
  type: SiegeEngineType;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  path: number[];
  pathIndex: number;
  hp: number;
  moveCooldown: number;
  task: "idle" | "march" | "bombard";
};

type WeatherCellState = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  intensity: number;
  kind: WeatherKind;
};

type EventState = {
  id: number;
  tick: number;
  kind: string;
  title: string;
  description: string;
  x: number;
  y: number;
  tribeId: number | null;
};

type CreatureState = {
  id: number;
  type: LegendaryCreatureType;
  name: string;
  x: number;
  y: number;
  hp: number;
  lairX: number;
  lairY: number;
  active: boolean;
  moveCooldown: number;
};

type DungeonState = {
  id: number;
  type: DungeonType;
  name: string;
  x: number;
  y: number;
  exploredBy: number | null;
  lootTier: number;
};

type BuildPayload = {
  buildingType: BuildingType;
  width: number;
  height: number;
  supplied: number;
  supplyNeeded: number;
  stockX: number;
  stockY: number;
};

type AttackPayload = {
  targetTribeId: number;
  targetX: number;
  targetY: number;
};

type EarthworkKind = "trench" | "canal" | "palisade" | "gate" | "stone_wall";

type EarthworkPayload = {
  kind: EarthworkKind;
};

type HaulPayload = {
  sourceX: number;
  sourceY: number;
  sourceBuildingId?: number | null;
  dropX: number;
  dropY: number;
  resourceType: ResourceType;
  amount: number;
  targetJobId: number;
};

type CraftPayload = {
  buildingId: number;
  output: ResourceType;
  amount: number;
  inputs: Partial<Record<ResourceType, number>>;
  supplied: number;
  supplyNeeded: number;
  stockX: number;
  stockY: number;
};

type ResourceJobPayload = {
  resourceType: ResourceType;
};

type AgentTask =
  | {
      kind: "gather" | "farm" | "hunt" | "fish" | "mine" | "quarry" | "cut_tree" | "tame_horse" | "tame_livestock" | "replant_tree" | "dungeon" | "delve";
      targetX: number;
      targetY: number;
      stage: "toTarget" | "return";
      resourceType: ResourceType;
      amount: number;
    }
  | {
      kind: "build";
      targetX: number;
      targetY: number;
      workLeft: number;
      payload: BuildPayload;
    }
  | {
      kind: "earthwork";
      targetX: number;
      targetY: number;
      workLeft: number;
      payload: EarthworkPayload;
    }
  | {
      kind: "haul";
      targetX: number;
      targetY: number;
      stage: "toSource" | "toDrop";
      payload: HaulPayload;
    }
  | {
      kind: "craft";
      targetX: number;
      targetY: number;
      workLeft: number;
      payload: CraftPayload;
    }
  | {
      kind: "recover";
      targetX: number;
      targetY: number;
      workLeft: number;
    }
  | {
      kind: "attack" | "patrol";
      targetX: number;
      targetY: number;
      workLeft: number;
      payload: AttackPayload;
    }
  | {
      kind: "idle";
      targetX: number;
      targetY: number;
      workLeft: number;
    };

type AgentState = {
  id: number;
  tribeId: number;
  name: string;
  title: string;
  hero: boolean;
  blessed: boolean;
  level: number;
  kills: number;
  wounds: number;
  status: string;
  condition: AgentConditionType;
  role: AgentRole;
  x: number;
  y: number;
  path: number[];
  pathIndex: number;
  task: AgentTask | null;
  health: number;
  hunger: number;
  warmth: number;
  fatigue: number;
  sickness: number;
  inspiration: number;
  morale: number;
  underground: boolean;
  carrying: ResourceType;
  carryingAmount: number;
  moveCooldown: number;
  spellCooldown: number;
  ageTicks: number;
  gear: {
    weapon: string;
    armor: string;
    trinket: string;
    power: number;
    rarity: string;
  };
};

type JobKind =
  | "gather"
  | "farm"
  | "cut_tree"
  | "quarry"
  | "mine"
  | "fish"
  | "hunt"
  | "tame_horse"
  | "tame_livestock"
  | "replant_tree"
  | "dungeon"
  | "delve"
  | "earthwork"
  | "haul"
  | "build"
  | "craft"
  | "attack"
  | "patrol";

type JobState = {
  id: number;
  tribeId: number;
  kind: JobKind;
  x: number;
  y: number;
  priority: number;
  claimedBy: number | null;
  payload?: BuildPayload | CraftPayload | AttackPayload | EarthworkPayload | HaulPayload | ResourceJobPayload;
};

const RESOURCE_SLOTS = 32;
const TECH_THRESHOLDS = [0, 320, 1400, 4200, 10500, 25000, 54000, 110000];
const AGE_YEAR_REQUIREMENTS = [0, 1, 4, 9, 17, 30, 48, 72];

const BUILDING_LOOKUP = new Map(BUILDING_DEFS.map((def) => [def.type, def]));

const TRIBE_NAMES: Record<RaceType, string[]> = {
  [RaceType.Humans]: ["Marinth", "Avel", "Ravenholt", "Calder", "Southreach"],
  [RaceType.Elves]: ["Silvar", "Lethien", "Eldergrove", "Thalorien", "Nymara"],
  [RaceType.Dwarves]: ["Kharum", "Stonewake", "Bromdun", "Ironvault", "Glimmerdeep"],
  [RaceType.Orcs]: ["Gorum", "Ashfang", "Varr", "Skarn", "Mawhold"],
  [RaceType.Goblins]: ["Snikket", "Ragroot", "Klink", "Murkbit", "Cranktooth"],
  [RaceType.Halflings]: ["Willowend", "Bramble", "Heather", "Merryfield", "Tansy"],
  [RaceType.Nomads]: ["Sahra", "Tirak", "Velan", "Kharif", "Orun"],
  [RaceType.Darkfolk]: ["Noxmere", "Cinderveil", "Vhor", "Shadeharrow", "Umberspire"],
};

const CREATURE_NAMES: Record<LegendaryCreatureType, string[]> = {
  [LegendaryCreatureType.Dragon]: ["Vermath", "Skyrend", "Aurelax"],
  [LegendaryCreatureType.SeaSerpent]: ["Thalassor", "Deepcoil", "Mirewave"],
  [LegendaryCreatureType.ForestSpirit]: ["Lethbloom", "Myrrasil", "Greenwhisper"],
  [LegendaryCreatureType.AshTitan]: ["Cindermaw", "Vulkrag", "Emberthane"],
};

const AGENT_NAMES: Record<RaceType, string[]> = {
  [RaceType.Humans]: ["Edric", "Mira", "Tomas", "Elin", "Vera", "Harlan", "Iris"],
  [RaceType.Elves]: ["Aeris", "Sylen", "Liora", "Theren", "Nuala", "Vaelis", "Ithil"],
  [RaceType.Dwarves]: ["Borin", "Helga", "Durim", "Kara", "Bruni", "Marn", "Odrin"],
  [RaceType.Orcs]: ["Gor", "Magra", "Thok", "Urza", "Krag", "Vor", "Rasha"],
  [RaceType.Goblins]: ["Skiv", "Nib", "Rakka", "Tink", "Mog", "Scrit", "Bixa"],
  [RaceType.Halflings]: ["Poppy", "Milo", "Tessa", "Rowan", "Wren", "Perrin", "Hazel"],
  [RaceType.Nomads]: ["Sahir", "Ayla", "Rami", "Nadim", "Leila", "Korin", "Yara"],
  [RaceType.Darkfolk]: ["Veyr", "Nyx", "Sable", "Morth", "Ivara", "Thren", "Cairn"],
};

const DUNGEON_NAMES: Record<DungeonType, string[]> = {
  [DungeonType.Cave]: ["Frostfang Cave", "Whispering Cavern", "Howling Hollow"],
  [DungeonType.Ruin]: ["Sunken Bastion", "Old Crown Ruins", "Shatterhall"],
  [DungeonType.Crypt]: ["Veil Crypt", "Ashen Tomb", "Kingsrest Vault"],
  [DungeonType.DeepDelve]: ["Blackreach Delve", "Titan Shaft", "Emberdeep"],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resourceArray(): number[] {
  return new Array(RESOURCE_SLOTS).fill(0);
}

function gearForRole(role: AgentRole, age: AgeType, race: RaceType): AgentState["gear"] {
  const rarityScale = ["Common", "Sturdy", "Rare", "Epic", "Legendary", "Mythic", "Relic", "Ascendant"];
  const tier = Math.min(age, rarityScale.length - 1);
  const raceTag = RaceType[race];
  const weaponByRole: Record<AgentRole, string> = {
    [AgentRole.Worker]: "Utility Knife",
    [AgentRole.Farmer]: "Sickle",
    [AgentRole.Woodcutter]: "Axe",
    [AgentRole.Miner]: "Pickaxe",
    [AgentRole.Builder]: "Hammer",
    [AgentRole.Hauler]: "Hook Pole",
    [AgentRole.Fisher]: "Harpoon",
    [AgentRole.Crafter]: "Forge Tongs",
    [AgentRole.Scholar]: age >= AgeType.Iron ? "Rune Codex" : "Wax Tablet",
    [AgentRole.Soldier]:
      race === RaceType.Elves ? (age >= AgeType.Modern ? "Starshard Bow" : age >= AgeType.Industrial ? "Sunrail Bow" : age >= AgeType.Medieval ? "Fire Bow" : "Bow")
      : race === RaceType.Darkfolk ? (age >= AgeType.Modern ? "Nightglass Recurve" : age >= AgeType.Industrial ? "Nightcoil Bow" : age >= AgeType.Medieval ? "Fire Bow" : "Shadow Bow")
      : race === RaceType.Dwarves ? (age >= AgeType.Modern ? "Rail Carbine" : age >= AgeType.Industrial ? "Thunder Carbine" : age >= AgeType.Gunpowder ? "Thunder Rifle" : age >= AgeType.Iron ? "Iron War Axe" : "War Axe")
      : race === RaceType.Orcs ? (age >= AgeType.Modern ? "Siege Cleaver" : age >= AgeType.Iron ? "Iron Cleaver" : "Cleaver")
      : race === RaceType.Goblins ? (age >= AgeType.Modern ? "Burst Carbine" : age >= AgeType.Industrial ? "Volley Crankgun" : age >= AgeType.Gunpowder ? "Spark Tubes" : age >= AgeType.Bronze ? "Javelin" : "Club")
      : race === RaceType.Halflings ? (age >= AgeType.Modern ? "Snap Bow" : "Short Bow")
      : race === RaceType.Nomads ? (age >= AgeType.Modern ? "Scout Carbine" : "Horse Bow")
      : age >= AgeType.Modern ? "Battle Rifle" : age >= AgeType.Industrial ? "Repeater Rifle" : age >= AgeType.Gunpowder ? "Arquebus" : age >= AgeType.Iron ? "Longbow" : age >= AgeType.Bronze ? "Bronze Spear" : "Club",
    [AgentRole.Rider]:
      race === RaceType.Nomads ? (age >= AgeType.Modern ? "Storm Carbine" : age >= AgeType.Industrial ? "Repeater Bow" : "Horse Bow")
      : age >= AgeType.Modern ? "Scout Carbine"
      : age >= AgeType.Industrial ? "Dragoon Carbine"
      : age >= AgeType.Gunpowder ? "Pistol Lance"
      : age >= AgeType.Medieval ? "Lance"
      : "Spear",
    [AgentRole.Mage]:
      age >= AgeType.Modern ? (race === RaceType.Darkfolk ? "Umbral Prism" : "Arc Prism")
      : age >= AgeType.Industrial ? (race === RaceType.Darkfolk ? "Void Prism" : "Solar Rod")
      : age >= AgeType.Gunpowder ? (race === RaceType.Darkfolk ? "Void Staff" : "Sunfire Staff")
      : age >= AgeType.Medieval ? "Star Staff"
      : age >= AgeType.Iron ? "Rune Staff"
      : "Charm Wand",
  };
  const armorByAge = ["Cloth", "Hide", "Bronze Mail", "Iron Mail", "Knight Plate", "Brigandine Coat", "Steel Harness", "Field Plate"];
  const trinket = race === RaceType.Elves || race === RaceType.Darkfolk
    ? age >= AgeType.Iron ? "Rune Focus" : "Spirit Charm"
    : race === RaceType.Dwarves
      ? "Stone Sigil"
      : "Clan Token";
  return {
    weapon: `${raceTag} ${weaponByRole[role]}`,
    armor: role === AgentRole.Mage ? (tier >= 3 ? "Runed Robes" : "Mystic Cloak") : role === AgentRole.Scholar ? "Scholar Robes" : (armorByAge[tier] ?? "Cloth"),
    trinket,
    power: 8 + tier * 4 + (role === AgentRole.Soldier || role === AgentRole.Rider ? 8 : role === AgentRole.Mage ? 10 : role === AgentRole.Scholar ? 4 : 0),
    rarity: rarityScale[tier] ?? "Common",
  };
}

function agentNameForRace(random: () => number, race: RaceType): string {
  return chooseOne(random, AGENT_NAMES[race]);
}

function improveGear(gear: AgentState["gear"], source: string): AgentState["gear"] {
  const rarities = ["Common", "Sturdy", "Rare", "Epic", "Legendary"];
  const nextRarity = rarities[Math.min(rarities.length - 1, rarities.indexOf(gear.rarity) + 1)] ?? gear.rarity;
  return {
    weapon: `${source} ${gear.weapon}`,
    armor: gear.armor === "Cloth" ? "Hide Vest" : gear.armor,
    trinket: `${source} Charm`,
    power: gear.power + 6,
    rarity: nextRarity,
  };
}

function titleForAgent(agent: AgentState, race: RaceType): string {
  if (agent.hero && agent.role === AgentRole.Mage) {
    return agent.blessed ? (race === RaceType.Darkfolk ? "Anointed Archwitch" : "Anointed Archmage") : (race === RaceType.Darkfolk ? "Archwitch" : "Archmage");
  }
  if (agent.hero && agent.role === AgentRole.Scholar) {
    return agent.blessed ? "Blessed Loremaster" : "Loremaster";
  }
  if (agent.hero) {
    const base = agent.role === AgentRole.Rider ? "Champion Rider" : "Champion";
    return agent.blessed ? `Blessed ${base}` : base;
  }
  if (agent.role === AgentRole.Mage) return "Mage";
  if (agent.role === AgentRole.Scholar) return "Scholar";
  if (agent.level >= 4 && (agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider)) return "Veteran";
  return "";
}

function varyColor(color: number, offset: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const bias = ((offset % 5) - 2) * 8;
  const nr = clamp(r + bias, 0, 255);
  const ng = clamp(g - Math.floor(bias * 0.4), 0, 255);
  const nb = clamp(b + Math.floor(bias * 0.6), 0, 255);
  return (nr << 16) | (ng << 8) | nb;
}

function getBuildingDef(type: BuildingType) {
  return BUILDING_LOOKUP.get(type)!;
}

function diplomacyStateFromScore(score: number): DiplomacyState {
  if (score > 50) return DiplomacyState.Alliance;
  if (score > 20) return DiplomacyState.Friendly;
  if (score > -15) return DiplomacyState.Neutral;
  if (score > -40) return DiplomacyState.Suspicious;
  if (score > -70) return DiplomacyState.Hostile;
  return DiplomacyState.War;
}

function buildingColorStrength(type: BuildingType): number {
  switch (type) {
    case BuildingType.CapitalHall:
    case BuildingType.Castle:
      return 3;
    case BuildingType.Barracks:
    case BuildingType.Armory:
    case BuildingType.Smithy:
    case BuildingType.Dock:
    case BuildingType.Warehouse:
    case BuildingType.Cistern:
    case BuildingType.School:
    case BuildingType.Fishery:
    case BuildingType.Shrine:
    case BuildingType.Tavern:
    case BuildingType.Infirmary:
    case BuildingType.MageTower:
    case BuildingType.ArcaneSanctum:
    case BuildingType.Foundry:
    case BuildingType.Factory:
    case BuildingType.RailDepot:
    case BuildingType.PowerPlant:
    case BuildingType.Airfield:
    case BuildingType.MountainHall:
    case BuildingType.DeepMine:
    case BuildingType.TunnelEntrance:
      return 2;
    default:
      return 1;
  }
}

function buildingProvidesHousing(type: BuildingType): number {
  if (type === BuildingType.House) return HOUSE_CAPACITY;
  if (type === BuildingType.MountainHall) return HOUSE_CAPACITY + 2;
  if (type === BuildingType.CapitalHall) return 6;
  if (type === BuildingType.Castle) return 10;
  return 0;
}

function buildingCenter(building: BuildingState): { x: number; y: number } {
  return {
    x: building.x + Math.floor(building.width / 2),
    y: building.y + Math.floor(building.height / 2),
  };
}

function buildingWorkTicks(type: BuildingType): number {
  const def = getBuildingDef(type);
  const footprint = def.size[0] * def.size[1];
  const costWeight = Object.values(def.cost).reduce((sum, value) => sum + (value ?? 0), 0);
  return Math.max(48, Math.round(40 + footprint * 4.8 + costWeight * 0.9));
}

export class Simulation {
  readonly seed: string;
  readonly random: () => number;
  readonly world: WorldData;
  readonly tribes: TribeState[] = [];
  readonly agents: AgentState[] = [];
  readonly buildings: BuildingState[] = [];
  readonly animals: AnimalState[] = [];
  readonly boats: BoatState[] = [];
  readonly wagons: WagonState[] = [];
  readonly caravans: CaravanState[] = [];
  readonly siegeEngines: SiegeEngineState[] = [];
  readonly weatherCells: WeatherCellState[] = [];
  readonly events: EventState[] = [];
  readonly creatures: CreatureState[] = [];
  readonly dungeons: DungeonState[] = [];
  readonly jobs: JobState[] = [];
  readonly dirtyTiles = new Set<number>();
  readonly activeWetTiles = new Set<number>();
  cachedBuildingsByTribe: BuildingState[][] = [];
  cachedAgentsByTribe: AgentState[][] = [];
  cachedBuildingCountsByTribe: Uint16Array[] = [];
  cachedPopulationByTribe = new Uint16Array(0);
  summaryRevision = 0;
  summaryCacheRevision = -1;

  tickCount = 0;
  currentYear = 0;
  season = SeasonType.Spring;
  nextJobId = 1;
  nextAgentId = 1;
  nextBuildingId = 1;
  nextAnimalId = 1;
  nextBoatId = 1;
  nextWagonId = 1;
  nextCaravanId = 1;
  nextSiegeEngineId = 1;
  nextWeatherId = 1;
  nextEventId = 1;
  nextCreatureId = 1;
  nextDungeonId = 1;
  readonly width: number;
  readonly height: number;

  constructor(seed: string, width = WORLD_WIDTH, height = WORLD_HEIGHT) {
    this.seed = seed;
    this.random = createSeededRandom(seed);
    this.width = width;
    this.height = height;
    this.world = generateWorld(seed, width, height);
    this.seedTribes();
    this.seedAnimals();
    this.seedWeather();
    this.seedLegendaryCreatures();
    this.seedDungeons();
    this.assignInitialRoles();
  }

  getInitialMessage() {
    return {
      type: "world-init" as const,
      world: {
        width: this.world.width,
        height: this.world.height,
        elevation: this.world.elevation,
        terrain: this.world.terrain,
        biome: this.world.biome,
        feature: this.world.feature,
        fertility: this.world.fertility,
        temperature: this.world.temperature,
        moisture: this.world.moisture,
        surfaceWater: this.world.surfaceWater,
        undergroundTerrain: this.world.undergroundTerrain,
        undergroundFeature: this.world.undergroundFeature,
        undergroundResourceType: this.world.undergroundResourceType,
        undergroundResourceAmount: this.world.undergroundResourceAmount,
      },
      tribes: this.serializeTribes(),
    };
  }

  snapshotNow(): DynamicSnapshot {
    return this.createSnapshot();
  }

  tick(): DynamicSnapshot | null {
    this.tickCount += 1;
    this.currentYear = Math.floor(this.tickCount / YEAR_TICKS);
    this.season = Math.floor((this.tickCount % YEAR_TICKS) / SEASON_TICKS) as SeasonType;

    if (this.tickCount % STRATEGY_TICKS === 1) {
      this.runTribeStrategy();
    }

    this.updateWeather();
    this.updateSurfaceWater();
    this.updateWaterInfrastructure();
    this.updateAnimals();
    this.updateBoats();
    this.updateWagons();
    this.updateCaravans();
    this.updateTribute();
    this.updateAllianceAid();
    this.updateSiegeEngines();
    this.updateLegendaryCreatures();
    this.updateAgents();
    this.consumeAndGrow();
    this.progressResearch();

    if (this.tickCount % SNAPSHOT_TICKS === 0) {
      return this.createSnapshot();
    }
    return null;
  }

  private seedTribes(): void {
    const used: { x: number; y: number }[] = [];
    const selectedRaces = Array.from({ length: INITIAL_TRIBE_COUNT }, (_, index) => RACE_DEFS[index % RACE_DEFS.length]!);

    for (let tribeId = 0; tribeId < selectedRaces.length; tribeId += 1) {
      const race = selectedRaces[tribeId]!;
      let best = this.world.candidateStarts[0]!;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const candidate of this.world.candidateStarts.slice(0, 180)) {
        if (used.some((entry) => manhattan(entry.x, entry.y, candidate.x, candidate.y) < 180)) {
          continue;
        }
        const score = scoreStartForRace(this.world, race, candidate.x, candidate.y);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
      used.push({ x: best.x, y: best.y });

      const raceCycle = Math.floor(tribeId / RACE_DEFS.length) + 1;
      const baseName = chooseOne(this.random, TRIBE_NAMES[race.type]);
      const name = selectedRaces.filter((entry) => entry.type === race.type).length > 1 ? `${baseName} ${raceCycle}` : baseName;
      const capital = this.placeBuilding(tribeId, BuildingType.CapitalHall, best.x, best.y);
      const stockpile = this.placeBuilding(tribeId, BuildingType.Stockpile, best.x + 4, best.y);
      this.placeBuilding(tribeId, BuildingType.House, best.x - 4, best.y);
      this.placeBuilding(tribeId, BuildingType.House, best.x, best.y + 4);
      this.placeBuilding(tribeId, BuildingType.House, best.x + 4, best.y + 4);
      this.placeBuilding(tribeId, BuildingType.House, best.x - 4, best.y + 4);
      this.placeBuilding(tribeId, BuildingType.House, best.x + 8, best.y);

      const tribe: TribeState = {
        id: tribeId,
        race,
        name,
        color: varyColor(race.color, tribeId),
        age: AgeType.Primitive,
        research: 0,
        faith: 0,
        water: 72,
        resources: resourceArray(),
        morale: 82,
        capitalBuildingId: capital.id,
        capitalX: best.x,
        capitalY: best.y,
        rulerAgentId: null,
        successionCount: 0,
        relations: new Array(INITIAL_TRIBE_COUNT).fill(0),
        tradePacts: new Array(INITIAL_TRIBE_COUNT).fill(false),
        discovered: new Array(INITIAL_TRIBE_COUNT).fill(false),
        tributeTo: null,
        stableCount: 0,
        lastFoodTick: 0,
      };
      tribe.discovered[tribeId] = true;

      tribe.resources[ResourceType.Wood] = 32;
      tribe.resources[ResourceType.Stone] = 22;
      tribe.resources[ResourceType.Grain] = 8;
      tribe.resources[ResourceType.Clay] = 8;
      tribe.resources[ResourceType.Rations] = 28;
      tribe.resources[ResourceType.Berries] = 8;
      tribe.resources[ResourceType.Meat] = 4;
      tribe.resources[ResourceType.StoneTools] = 8;
      tribe.resources[ResourceType.BasicWeapons] = 5;
      tribe.resources[ResourceType.BasicArmor] = 4;

      this.tribes.push(tribe);

      for (let i = 0; i < INITIAL_AGENTS_PER_TRIBE; i += 1) {
        const offsetX = randInt(this.random, -3, 3);
        const offsetY = randInt(this.random, -3, 3);
        this.agents.push({
          id: this.nextAgentId++,
          tribeId,
          name: agentNameForRace(this.random, race.type),
          title: "",
          hero: false,
          blessed: false,
          level: 1,
          kills: 0,
          wounds: 0,
          status: "Ready",
          condition: AgentConditionType.Steady,
          role: AgentRole.Worker,
          x: best.x + offsetX,
          y: best.y + offsetY,
          path: [],
          pathIndex: 0,
          task: null,
          health: 100,
          hunger: randInt(this.random, 0, 15),
          warmth: 100,
          fatigue: randInt(this.random, 4, 18),
          sickness: 0,
          inspiration: randInt(this.random, 0, 12),
          morale: 80 + randInt(this.random, -8, 8),
          underground: false,
          carrying: ResourceType.None,
          carryingAmount: 0,
          moveCooldown: 0,
          spellCooldown: 0,
          ageTicks: randInt(this.random, 0, YEAR_TICKS * 3),
          gear: gearForRole(AgentRole.Worker, AgeType.Primitive, race.type),
        });
      }

      this.claimTerritory(tribeId, best.x, best.y, TRIBE_TERRITORY_RADIUS);
      this.ensureBootstrapFeaturesNearStart(tribe);
      this.seedStarterStockyard(tribe, stockpile);

      if ((race.type === RaceType.Dwarves || race.type === RaceType.Darkfolk) && this.random() > 0.3) {
        const hallDef = getBuildingDef(BuildingType.MountainHall);
        const hallSite = this.findBuildingSiteForSeed(tribeId, hallDef);
        if (hallSite) {
          this.placeBuilding(tribeId, BuildingType.MountainHall, hallSite.x, hallSite.y);
        }
      }

      this.ensureRuler(tribe);
    }

    for (let i = 0; i < this.tribes.length; i += 1) {
      for (let j = 0; j < this.tribes.length; j += 1) {
        if (i === j) {
          this.tribes[i]!.relations[j] = 100;
        } else {
          const raceDiff = this.tribes[i]!.race.type === this.tribes[j]!.race.type ? 15 : 0;
          this.tribes[i]!.relations[j] = clamp((raceDiff + (this.random() - 0.5) * 40) | 0, -45, 35);
        }
      }
    }
  }

  private ensureBootstrapFeaturesNearStart(tribe: TribeState): void {
    const placeFeature = (predicate: (terrain: TerrainType) => boolean, feature: FeatureType, resourceType: ResourceType, amount: number, preferredRadius = 10): boolean => {
      for (let radius = 2; radius <= preferredRadius; radius += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            const x = tribe.capitalX + dx;
            const y = tribe.capitalY + dy;
            if (!inBounds(x, y, this.world.width, this.world.height)) continue;
            const index = indexOf(x, y, this.world.width);
            const terrain = this.world.terrain[index] as TerrainType;
            if (!predicate(terrain)) continue;
            if (this.world.buildingByTile[index] >= 0) continue;
            if (this.world.feature[index] !== FeatureType.None && this.world.feature[index] !== FeatureType.BerryPatch) continue;
            this.world.feature[index] = feature;
            this.world.resourceType[index] = resourceType;
            this.world.resourceAmount[index] = amount;
            return true;
          }
        }
      }
      return false;
    };

    if (distanceToNearestFeature(this.world, tribe.capitalX, tribe.capitalY, (feature) => feature === FeatureType.Trees, 10) > 5) {
      placeFeature(
        (terrain) => terrain === TerrainType.Grass || terrain === TerrainType.ForestFloor || terrain === TerrainType.Snow || terrain === TerrainType.Desert,
        FeatureType.Trees,
        ResourceType.Wood,
        110,
      );
    }
    if (distanceToNearestFeature(this.world, tribe.capitalX, tribe.capitalY, (feature) => feature === FeatureType.StoneOutcrop, 10) > 6) {
      placeFeature(
        (terrain) => terrain === TerrainType.Rocky || terrain === TerrainType.Grass || terrain === TerrainType.ForestFloor || terrain === TerrainType.Snow || terrain === TerrainType.Desert,
        FeatureType.StoneOutcrop,
        ResourceType.Stone,
        95,
      );
    }
    if (distanceToNearestFeature(this.world, tribe.capitalX, tribe.capitalY, (feature) => feature === FeatureType.ClayDeposit, 10) > 6) {
      placeFeature(
        (terrain) => terrain === TerrainType.Grass || terrain === TerrainType.ForestFloor || terrain === TerrainType.Marsh || terrain === TerrainType.Beach || terrain === TerrainType.Snow,
        FeatureType.ClayDeposit,
        ResourceType.Clay,
        82,
      );
    }
    if (distanceToNearestFeature(this.world, tribe.capitalX, tribe.capitalY, (feature) => feature === FeatureType.BerryPatch, 8) > 5) {
      placeFeature(
        (terrain) => terrain === TerrainType.Grass || terrain === TerrainType.ForestFloor || terrain === TerrainType.Snow,
        FeatureType.BerryPatch,
        ResourceType.Berries,
        78,
        8,
      );
    }
  }

  private seedStarterStockyard(tribe: TribeState, stockpile: BuildingState): void {
    const candidates = [
      { x: stockpile.x + stockpile.width + 3, y: stockpile.y + 2 },
      { x: stockpile.x + 1, y: stockpile.y + stockpile.height + 3 },
      { x: stockpile.x - 3, y: stockpile.y + 2 },
      { x: stockpile.x + 1, y: stockpile.y - 3 },
      { x: tribe.capitalX + 6, y: tribe.capitalY + 4 },
    ];

    let bestCenter = candidates[0]!;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      let score = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const x = candidate.x + dx;
          const y = candidate.y + dy;
          if (!inBounds(x, y, this.world.width, this.world.height)) {
            score -= 20;
            continue;
          }
          const index = indexOf(x, y, this.world.width);
          const terrain = this.world.terrain[index] as TerrainType;
          if (this.world.buildingByTile[index] >= 0) {
            score -= 25;
            continue;
          }
          if (terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow || terrain === TerrainType.River || terrain === TerrainType.Lava || terrain === TerrainType.Mountain) {
            score -= 18;
            continue;
          }
          score += terrain === TerrainType.Grass || terrain === TerrainType.ForestFloor || terrain === TerrainType.Farmland ? 5 : 2;
          score -= manhattan(stockpile.x, stockpile.y, x, y) * 0.08;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCenter = candidate;
      }
    }

    const layout: ResourceType[][] = [
      [ResourceType.Wood, ResourceType.Wood, ResourceType.Stone, ResourceType.Stone, ResourceType.Wood],
      [ResourceType.Wood, ResourceType.Berries, ResourceType.Berries, ResourceType.Stone, ResourceType.Clay],
      [ResourceType.Stone, ResourceType.Berries, ResourceType.Grain, ResourceType.Berries, ResourceType.Stone],
      [ResourceType.Wood, ResourceType.Berries, ResourceType.Berries, ResourceType.Stone, ResourceType.Clay],
      [ResourceType.Wood, ResourceType.Wood, ResourceType.Stone, ResourceType.Stone, ResourceType.Wood],
    ];

    for (let row = 0; row < layout.length; row += 1) {
      for (let col = 0; col < layout[row]!.length; col += 1) {
        const x = bestCenter.x + col - 2;
        const y = bestCenter.y + row - 2;
        if (!inBounds(x, y, this.world.width, this.world.height)) continue;
        const index = indexOf(x, y, this.world.width);
        if (this.world.buildingByTile[index] >= 0) continue;
        const terrain = this.world.terrain[index] as TerrainType;
        if (terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow || terrain === TerrainType.River || terrain === TerrainType.Lava || terrain === TerrainType.Mountain) continue;

        const resourceType = layout[row]![col]!;
        this.world.feature[index] = FeatureType.None;
        this.world.resourceType[index] = resourceType;
        this.world.resourceAmount[index] = resourceType === ResourceType.Wood ? 28
          : resourceType === ResourceType.Stone ? 20
          : resourceType === ResourceType.Clay ? 14
          : resourceType === ResourceType.Grain ? 18
          : 16;
      }
    }
  }

  private seedAnimals(): void {
    const animalTypes = [AnimalType.Deer, AnimalType.Boar, AnimalType.Horse, AnimalType.Sheep, AnimalType.Goat];
    for (const tribe of this.tribes) {
      const localHerds: AnimalType[] = [AnimalType.Deer, AnimalType.Sheep, AnimalType.Goat];
      if (tribe.race.type === RaceType.Nomads || tribe.race.type === RaceType.Humans) {
        localHerds.push(AnimalType.Horse);
      }
      if (tribe.race.type === RaceType.Orcs) {
        localHerds.push(AnimalType.Boar);
      }
      for (const type of localHerds) {
        const originX = clamp(tribe.capitalX + randInt(this.random, -12, 12), 1, this.world.width - 2);
        const originY = clamp(tribe.capitalY + randInt(this.random, -12, 12), 1, this.world.height - 2);
        this.animals.push({
          id: this.nextAnimalId++,
          type,
          x: originX,
          y: originY,
          moveCooldown: randInt(this.random, 0, 7),
        });
      }
    }

    const roamingHerdCount = Math.max(0, INITIAL_ANIMAL_HERDS - this.animals.length);
    for (let i = 0; i < roamingHerdCount; i += 1) {
      const candidate = chooseOne(this.random, this.world.candidateStarts);
      const type = chooseOne(this.random, animalTypes);
      this.animals.push({
        id: this.nextAnimalId++,
        type,
        x: clamp(candidate.x + randInt(this.random, -18, 18), 1, this.world.width - 2),
        y: clamp(candidate.y + randInt(this.random, -18, 18), 1, this.world.height - 2),
        moveCooldown: randInt(this.random, 0, 7),
      });
    }
  }

  private seedWeather(): void {
    const patterns: WeatherKind[] = [WeatherKind.Clear, WeatherKind.Fog, WeatherKind.Rain, WeatherKind.Clear, WeatherKind.Rain, WeatherKind.Fog];
    for (let i = 0; i < 6; i += 1) {
      const candidate = chooseOne(this.random, this.world.candidateStarts);
      const kind = patterns[i % patterns.length]!;
      this.weatherCells.push({
        id: this.nextWeatherId++,
        x: candidate.x,
        y: candidate.y,
        dx: randInt(this.random, -1, 1) || 1,
        dy: randInt(this.random, -1, 1),
        radius: randInt(this.random, 12, 24),
        intensity: randInt(this.random, 28, 58),
        kind,
      });
    }
  }

  private seedLegendaryCreatures(): void {
    const plans: Array<{ type: LegendaryCreatureType; biomeMatch: (biome: BiomeType, terrain: TerrainType) => boolean }> = [
      { type: LegendaryCreatureType.Dragon, biomeMatch: (biome, terrain) => biome === BiomeType.Alpine || terrain === TerrainType.Mountain },
      { type: LegendaryCreatureType.SeaSerpent, biomeMatch: (_biome, terrain) => isWaterTerrain(terrain) },
      { type: LegendaryCreatureType.ForestSpirit, biomeMatch: (biome) => biome === BiomeType.DeepForest || biome === BiomeType.SnowyForest },
      { type: LegendaryCreatureType.AshTitan, biomeMatch: (biome) => biome === BiomeType.AshWaste || biome === BiomeType.VolcanicHighland },
    ];

    for (const plan of plans) {
      const lair = this.findBiomeLocation(plan.biomeMatch);
      if (!lair) continue;
      const name = chooseOne(this.random, CREATURE_NAMES[plan.type]);
      this.creatures.push({
        id: this.nextCreatureId++,
        type: plan.type,
        name,
        x: lair.x,
        y: lair.y,
        hp: 180,
        lairX: lair.x,
        lairY: lair.y,
        active: false,
        moveCooldown: randInt(this.random, 0, 8),
      });
      this.pushEvent({
        kind: "legendary-lair",
        title: `${name} stirs`,
        description: `${name} has claimed a remote lair in the wilds.`,
        x: lair.x,
        y: lair.y,
        tribeId: null,
      });
    }
  }

  private seedDungeons(): void {
    const plans: Array<{ type: DungeonType; match: (biome: BiomeType, terrain: TerrainType) => boolean }> = [
      { type: DungeonType.Cave, match: (_biome, terrain) => terrain === TerrainType.Mountain || terrain === TerrainType.Rocky },
      { type: DungeonType.Ruin, match: (biome) => biome === BiomeType.TemperatePlains || biome === BiomeType.Scrubland },
      { type: DungeonType.Crypt, match: (biome) => biome === BiomeType.AshWaste || biome === BiomeType.Tundra },
      { type: DungeonType.DeepDelve, match: (biome, terrain) => biome === BiomeType.Alpine || terrain === TerrainType.Mountain },
    ];

    for (let i = 0; i < 18; i += 1) {
      const plan = plans[i % plans.length]!;
      const site = this.findBiomeLocation(plan.match);
      if (!site) continue;
      this.dungeons.push({
        id: this.nextDungeonId++,
        type: plan.type,
        name: chooseOne(this.random, DUNGEON_NAMES[plan.type]),
        x: site.x,
        y: site.y,
        exploredBy: null,
        lootTier: randInt(this.random, 1, 4),
      });
    }
  }

  private assignInitialRoles(): void {
    for (const tribe of this.tribes) {
      this.assignRolesForTribe(tribe);
    }
  }

  private assignRolesForTribe(tribe: TribeState): void {
    const tribeAgents = [...this.agentsForTribe(tribe.id)];
    const hostility = this.meanHostility(tribe);
    const primitive = tribe.age === AgeType.Primitive;
    const bootstrap = this.isBootstrapPhase(tribe);
    const desiredSoldiers = clamp(Math.floor(tribeAgents.length * (0.12 + tribe.race.militaryBias * 0.08 + hostility * 0.002)), primitive ? 1 : 2, 18);
    const desiredFarmers = clamp(Math.floor(tribeAgents.length * (primitive ? 0.24 : 0.18) * tribe.race.foodBias), primitive ? 4 : 3, 18);
    const desiredWoodcutters = clamp(Math.floor(tribeAgents.length * (primitive ? 0.16 : 0.14)), primitive ? 3 : 2, 12);
    const desiredMiners = tribe.age >= AgeType.Bronze
      ? clamp(Math.floor(tribeAgents.length * 0.1 * tribe.race.buildBias + this.buildingCount(tribe.id, BuildingType.DeepMine) * 0.8), 2, 12)
      : primitive ? 3 : 0;
    const desiredFishers = this.hasBuilt(tribe.id, BuildingType.Dock) || this.hasBuilt(tribe.id, BuildingType.Fishery) ? 4 + this.buildingCount(tribe.id, BuildingType.Fishery) : 0;
    const desiredCrafters = tribe.age >= AgeType.Bronze ? clamp(Math.floor(tribeAgents.length * (this.hasBuilt(tribe.id, BuildingType.Armory) ? 0.1 : 0.08)), 1, 10) : primitive ? 1 : 0;
    const desiredScholars = tribe.age >= AgeType.Bronze && (this.hasBuilt(tribe.id, BuildingType.Workshop) || this.hasBuilt(tribe.id, BuildingType.Castle) || this.hasBuilt(tribe.id, BuildingType.MageTower) || this.hasBuilt(tribe.id, BuildingType.ArcaneSanctum) || this.hasBuilt(tribe.id, BuildingType.School))
      ? clamp(Math.floor(tribeAgents.length * (this.hasBuilt(tribe.id, BuildingType.School) ? 0.08 : 0.04)), 1, 5)
      : 0;
    const desiredBuilders = clamp(Math.floor(tribeAgents.length * (primitive ? 0.14 : 0.12) + tribe.race.buildBias * 2), primitive ? 3 : 2, 10);
    const desiredHaulers = clamp(Math.floor(tribeAgents.length * (this.hasBuilt(tribe.id, BuildingType.Warehouse) ? 0.11 : 0.08) + this.jobs.filter((job) => job.tribeId === tribe.id && (job.kind === "build" || job.kind === "haul")).length * 0.05), primitive ? 2 : 1, 10);
    const canUseMagic = (tribe.race.type === RaceType.Elves || tribe.race.type === RaceType.Darkfolk) && tribe.age >= AgeType.Iron;
    const desiredMages = canUseMagic
      ? clamp(Math.floor(tribeAgents.length * (this.hasBuilt(tribe.id, BuildingType.ArcaneSanctum) ? 0.16 : this.hasBuilt(tribe.id, BuildingType.MageTower) ? 0.1 : 0.06)), 1, this.hasBuilt(tribe.id, BuildingType.ArcaneSanctum) ? 9 : this.hasBuilt(tribe.id, BuildingType.MageTower) ? 6 : 4)
      : 0;

    const rolePlan: AgentRole[] = [];
    if (!primitive || !bootstrap) {
      rolePlan.push(...new Array(desiredSoldiers).fill(AgentRole.Soldier));
    } else {
      rolePlan.push(AgentRole.Soldier);
    }
    rolePlan.push(...new Array(desiredMages).fill(AgentRole.Mage));
    rolePlan.push(...new Array(desiredFarmers).fill(AgentRole.Farmer));
    rolePlan.push(...new Array(desiredWoodcutters).fill(AgentRole.Woodcutter));
    rolePlan.push(...new Array(desiredMiners).fill(AgentRole.Miner));
    rolePlan.push(...new Array(desiredFishers).fill(AgentRole.Fisher));
    rolePlan.push(...new Array(desiredCrafters).fill(AgentRole.Crafter));
    rolePlan.push(...new Array(desiredScholars).fill(AgentRole.Scholar));
    rolePlan.push(...new Array(desiredBuilders).fill(AgentRole.Builder));
    rolePlan.push(...new Array(desiredHaulers).fill(AgentRole.Hauler));

    while (rolePlan.length < tribeAgents.length) {
      rolePlan.push(AgentRole.Worker);
    }

    tribeAgents.sort((a, b) => (b.hero ? 1000 : 0) + b.level * 10 + b.kills - ((a.hero ? 1000 : 0) + a.level * 10 + a.kills));
    for (let i = 0; i < tribeAgents.length; i += 1) {
      tribeAgents[i]!.role = rolePlan[i] ?? AgentRole.Worker;
      if (tribe.age >= AgeType.Medieval && tribe.stableCount > 0 && tribe.resources[ResourceType.Horses] > 0 && i < 2) {
        tribeAgents[i]!.role = AgentRole.Rider;
      }
      tribeAgents[i]!.gear = gearForRole(tribeAgents[i]!.role, tribe.age, tribe.race.type);
      if (tribeAgents[i]!.hero) {
        tribeAgents[i]!.gear = improveGear(tribeAgents[i]!.gear, tribe.race.type === RaceType.Darkfolk || tribe.race.type === RaceType.Elves ? "Elder" : "Champion");
      }
      tribeAgents[i]!.title = titleForAgent(tribeAgents[i]!, tribe.race.type);
    }
  }

  private meanHostility(tribe: TribeState): number {
    let total = 0;
    let count = 0;
    for (let i = 0; i < tribe.relations.length; i += 1) {
      if (i === tribe.id) continue;
      if (!tribe.discovered[i]) continue;
      total += -tribe.relations[i]!;
      count += 1;
    }
    return count > 0 ? total / count : 0;
  }

  private tribeStrategicPower(tribe: TribeState): number {
    const population = this.populationOf(tribe.id);
    const soldiers = this.agentsForTribe(tribe.id).filter((agent) => agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider || agent.role === AgentRole.Mage).length;
    const siege = this.siegeEngines.filter((engine) => engine.tribeId === tribe.id).length;
    return population + soldiers * 2.5 + siege * 4 + tribe.age * 10 + tribe.resources[ResourceType.MetalWeapons] * 0.2 + tribe.resources[ResourceType.MetalArmor] * 0.18;
  }

  private tradePartnerCount(tribeId: number): number {
    return this.tribes[tribeId]!.tradePacts.filter((value, index) => index !== tribeId && value).length;
  }

  private tributaryCount(tribeId: number): number {
    return this.tribes.filter((other) => other.id !== tribeId && other.tributeTo === tribeId).length;
  }

  private contactCount(tribe: TribeState): number {
    return tribe.discovered.filter((known, index) => index !== tribe.id && known).length;
  }

  private updateAnimals(): void {
    for (const animal of this.animals) {
      animal.moveCooldown -= 1;
      if (animal.moveCooldown > 0) {
        continue;
      }
      animal.moveCooldown = randInt(this.random, 1, 5);
      const [dx, dy] = chooseOne(this.random, [...CARDINALS, [0, 0]] as const);
      const nx = animal.x + dx;
      const ny = animal.y + dy;
      if (!inBounds(nx, ny, this.world.width, this.world.height)) {
        continue;
      }
      const terrain = this.world.terrain[indexOf(nx, ny, this.world.width)];
      if (isWaterTerrain(terrain) || terrain === TerrainType.Lava) {
        continue;
      }
      animal.x = nx;
      animal.y = ny;
    }
  }

  private updateBoats(): void {
    for (let index = this.boats.length - 1; index >= 0; index -= 1) {
      const boat = this.boats[index]!;
      const tribe = this.tribes[boat.tribeId];
      const dock = this.buildings.find((building) => building.id === boat.dockBuildingId);
      if (!tribe || !dock) {
        this.boats.splice(index, 1);
        continue;
      }

      if (boat.moveCooldown > 0) {
        boat.moveCooldown -= 1;
      } else if (boat.path.length > 1 && boat.pathIndex < boat.path.length - 1) {
        boat.pathIndex += 1;
        const { x, y } = coordsOf(boat.path[boat.pathIndex]!, this.world.width);
        boat.x = x;
        boat.y = y;
        boat.moveCooldown = 0;
      }

      if (boat.task === BoatTaskType.Idle) {
        this.assignBoatRoute(boat, dock);
        continue;
      }

      const atTarget = boat.x === boat.targetX && boat.y === boat.targetY;
      if (!atTarget) {
        continue;
      }

      if (boat.task === BoatTaskType.ToFish) {
        const gathered = this.harvestBoatFish(boat.x, boat.y);
        boat.cargo = gathered;
        boat.task = BoatTaskType.ReturnToDock;
        boat.targetX = boat.dockX;
        boat.targetY = boat.dockY;
        boat.path = findPath(this.world, boat.x, boat.y, boat.targetX, boat.targetY, "water", 160);
        boat.pathIndex = 0;
        continue;
      }

      if (boat.task === BoatTaskType.ReturnToDock) {
        tribe.resources[ResourceType.Fish] += boat.cargo;
        tribe.resources[ResourceType.Rations] += Math.ceil(boat.cargo * 1.1);
        boat.cargo = 0;
        boat.task = BoatTaskType.Idle;
      }
    }
  }

  private updateWagons(): void {
    for (let index = this.wagons.length - 1; index >= 0; index -= 1) {
      const wagon = this.wagons[index]!;
      const tribe = this.tribes[wagon.tribeId];
      const home = this.buildings.find((building) => building.id === wagon.homeBuildingId);
      if (!tribe || !home) {
        this.releaseWagonJob(wagon);
        this.wagons.splice(index, 1);
        continue;
      }

      if (wagon.moveCooldown > 0) {
        wagon.moveCooldown -= 1;
      } else if (wagon.path.length > 1 && wagon.pathIndex < wagon.path.length - 1) {
        wagon.pathIndex += 1;
        const { x, y } = coordsOf(wagon.path[wagon.pathIndex]!, this.world.width);
        wagon.x = x;
        wagon.y = y;
        wagon.moveCooldown = this.world.road[indexOf(x, y, this.world.width)] > 0 ? 0 : 1;
      }

      if (wagon.task === WagonTaskType.Idle) {
        this.assignWagonRoute(wagon, tribe, home);
        continue;
      }

      const haulJob = wagon.targetJobId !== null
        ? this.jobs.find((job) => job.id === wagon.targetJobId && job.kind === "haul")
        : null;
      if (!haulJob || haulJob.claimedBy !== this.wagonClaimId(wagon.id)) {
        wagon.task = WagonTaskType.Idle;
        wagon.targetJobId = null;
        wagon.cargoType = ResourceType.None;
        wagon.cargoAmount = 0;
        wagon.targetX = wagon.homeX;
        wagon.targetY = wagon.homeY;
        wagon.path = [];
        wagon.pathIndex = 0;
        continue;
      }

      const atTarget = wagon.x === wagon.targetX && wagon.y === wagon.targetY;
      if (!atTarget) {
        continue;
      }

      if (wagon.task === WagonTaskType.ToSource) {
        const payload = haulJob.payload as HaulPayload;
        wagon.cargoType = payload.resourceType;
        wagon.cargoAmount = payload.amount;
        wagon.task = WagonTaskType.ToDrop;
        wagon.targetX = payload.dropX;
        wagon.targetY = payload.dropY;
        wagon.path = findPath(this.world, wagon.x, wagon.y, wagon.targetX, wagon.targetY);
        wagon.pathIndex = 0;
        continue;
      }

      const payload = haulJob.payload as HaulPayload;
      const buildJob = this.jobs.find((job) => job.id === payload.targetJobId && (job.kind === "build" || job.kind === "craft"));
      if (buildJob?.kind === "build") {
        (buildJob.payload as BuildPayload).supplied += 1;
      } else if (buildJob?.kind === "craft") {
        (buildJob.payload as CraftPayload).supplied += 1;
      }
      this.jobs.splice(this.jobs.indexOf(haulJob), 1);
      wagon.task = WagonTaskType.Idle;
      wagon.targetJobId = null;
      wagon.cargoType = ResourceType.None;
      wagon.cargoAmount = 0;
      wagon.targetX = wagon.homeX;
      wagon.targetY = wagon.homeY;
      wagon.path = findPath(this.world, wagon.x, wagon.y, wagon.homeX, wagon.homeY);
      wagon.pathIndex = 0;
    }
  }

  private wagonClaimId(wagonId: number): number {
    return -100000 - wagonId;
  }

  private releaseWagonJob(wagon: WagonState): void {
    if (wagon.targetJobId === null) return;
    const job = this.jobs.find((entry) => entry.id === wagon.targetJobId && entry.kind === "haul");
    if (job && job.claimedBy === this.wagonClaimId(wagon.id)) {
      job.claimedBy = null;
    }
  }

  private assignWagonRoute(wagon: WagonState, tribe: TribeState, home: BuildingState): void {
    const haulJobs = this.jobs
      .filter((job) => job.tribeId === tribe.id && job.kind === "haul" && job.claimedBy === null)
      .sort((a, b) =>
        (manhattan(a.x, a.y, (a.payload as HaulPayload).dropX, (a.payload as HaulPayload).dropY) + manhattan(wagon.x, wagon.y, a.x, a.y))
        - (manhattan(b.x, b.y, (b.payload as HaulPayload).dropX, (b.payload as HaulPayload).dropY) + manhattan(wagon.x, wagon.y, b.x, b.y)),
      );
    const candidate = haulJobs.find((job) => manhattan(job.x, job.y, (job.payload as HaulPayload).dropX, (job.payload as HaulPayload).dropY) >= 4)
      ?? haulJobs[0];
    if (!candidate) {
      wagon.targetX = wagon.homeX;
      wagon.targetY = wagon.homeY;
      if (wagon.x !== wagon.homeX || wagon.y !== wagon.homeY) {
        wagon.path = findPath(this.world, wagon.x, wagon.y, wagon.homeX, wagon.homeY);
        wagon.pathIndex = 0;
      }
      return;
    }
    candidate.claimedBy = this.wagonClaimId(wagon.id);
    wagon.targetJobId = candidate.id;
    wagon.task = WagonTaskType.ToSource;
    wagon.targetX = (candidate.payload as HaulPayload).sourceX;
    wagon.targetY = (candidate.payload as HaulPayload).sourceY;
    wagon.path = findPath(this.world, wagon.x, wagon.y, wagon.targetX, wagon.targetY);
    wagon.pathIndex = 0;
    if (wagon.path.length <= 1 && (wagon.x !== wagon.targetX || wagon.y !== wagon.targetY)) {
      candidate.claimedBy = null;
      wagon.targetJobId = null;
      wagon.task = WagonTaskType.Idle;
      wagon.targetX = home.x;
      wagon.targetY = home.y;
      wagon.path = [];
    }
  }

  private updateCaravans(): void {
    for (let index = this.caravans.length - 1; index >= 0; index -= 1) {
      const caravan = this.caravans[index]!;
      const tribe = this.tribes[caravan.tribeId];
      const partner = this.tribes[caravan.partnerTribeId];
      if (!tribe || !partner) {
        this.caravans.splice(index, 1);
        continue;
      }
      if (!tribe.discovered[partner.id] || !tribe.tradePacts[partner.id] || diplomacyStateFromScore(tribe.relations[partner.id]!) < DiplomacyState.Neutral) {
        this.caravans.splice(index, 1);
        continue;
      }

      if (caravan.moveCooldown > 0) {
        caravan.moveCooldown -= 1;
      } else if (caravan.path.length > 1 && caravan.pathIndex < caravan.path.length - 1) {
        caravan.pathIndex += 1;
        const { x, y } = coordsOf(caravan.path[caravan.pathIndex]!, this.world.width);
        caravan.x = x;
        caravan.y = y;
        caravan.moveCooldown = this.world.road[indexOf(x, y, this.world.width)] > 0 ? 0 : 1;
      }

      const atTarget = caravan.x === caravan.targetX && caravan.y === caravan.targetY;
      if (!atTarget) {
        continue;
      }

      if (caravan.task === CaravanTaskType.ToPartner) {
        partner.resources[caravan.cargoType] += caravan.cargoAmount;
        if (caravan.cargoType === ResourceType.Fish || caravan.cargoType === ResourceType.Grain || caravan.cargoType === ResourceType.Rations) {
          partner.resources[ResourceType.Rations] += Math.ceil(caravan.cargoAmount * 0.4);
        }
        tribe.relations[partner.id] = clamp(tribe.relations[partner.id]! + 2, -100, 100);
        partner.relations[tribe.id] = clamp(partner.relations[tribe.id]! + 2, -100, 100);
        const returnCargoType = this.chooseTradeCargo(partner, tribe);
        const returnCargoAmount = this.chooseTradeCargoAmount(partner, tribe, returnCargoType);
        if (partner.resources[returnCargoType] < returnCargoAmount) {
          caravan.cargoType = ResourceType.Rations;
          caravan.cargoAmount = 4;
        } else {
          partner.resources[returnCargoType] -= returnCargoAmount;
          caravan.cargoType = returnCargoType;
          caravan.cargoAmount = returnCargoAmount;
        }
        caravan.task = CaravanTaskType.ReturnHome;
        caravan.targetX = caravan.homeX;
        caravan.targetY = caravan.homeY;
        caravan.path = findPath(this.world, caravan.x, caravan.y, caravan.targetX, caravan.targetY);
        caravan.pathIndex = 0;
        if (this.tickCount % 24 === 0) {
          this.pushEvent({
            kind: "trade",
            title: `${tribe.name} trades with ${partner.name}`,
            description: `${tribe.name} exchanged goods with ${partner.name}.`,
            x: caravan.x,
            y: caravan.y,
            tribeId: tribe.id,
          });
        }
      } else {
        tribe.resources[caravan.cargoType] += caravan.cargoAmount;
        if (caravan.cargoType === ResourceType.Fish || caravan.cargoType === ResourceType.Grain || caravan.cargoType === ResourceType.Rations) {
          tribe.resources[ResourceType.Rations] += Math.ceil(caravan.cargoAmount * 0.4);
        }
        caravan.task = CaravanTaskType.ToPartner;
        caravan.targetX = partner.capitalX;
        caravan.targetY = partner.capitalY;
        caravan.path = findPath(this.world, caravan.x, caravan.y, caravan.targetX, caravan.targetY);
        caravan.pathIndex = 0;
        const outboundCargoType = this.chooseTradeCargo(tribe, partner);
        const outboundCargoAmount = this.chooseTradeCargoAmount(tribe, partner, outboundCargoType);
        if (tribe.resources[outboundCargoType] >= outboundCargoAmount) {
          tribe.resources[outboundCargoType] -= outboundCargoAmount;
          caravan.cargoType = outboundCargoType;
          caravan.cargoAmount = outboundCargoAmount;
        } else {
          caravan.cargoType = ResourceType.Rations;
          caravan.cargoAmount = Math.min(4, tribe.resources[ResourceType.Rations]);
          tribe.resources[ResourceType.Rations] = Math.max(0, tribe.resources[ResourceType.Rations] - caravan.cargoAmount);
        }
      }
    }
  }

  private updateTribute(): void {
    if (this.tickCount % (SIM_TICKS_PER_SECOND * 14) !== 0) {
      return;
    }

    for (const tribe of this.tribes) {
      if (tribe.tributeTo === null) continue;
      const overlord = this.tribes[tribe.tributeTo];
      if (!overlord) {
        tribe.tributeTo = null;
        continue;
      }
      const candidates = [
        ResourceType.Rations,
        ResourceType.Wood,
        ResourceType.Stone,
        ResourceType.Ore,
      ];
      const resourceType = candidates.find((type) => tribe.resources[type] >= (type === ResourceType.Rations ? 18 : 12)) ?? null;
      if (resourceType === null) {
        tribe.relations[overlord.id] = clamp(tribe.relations[overlord.id]! - 3, -100, 100);
        overlord.relations[tribe.id] = clamp(overlord.relations[tribe.id]! - 1, -100, 100);
        continue;
      }

      const amount = resourceType === ResourceType.Rations ? 10 : resourceType === ResourceType.Ore ? 6 : 8;
      tribe.resources[resourceType] = Math.max(0, tribe.resources[resourceType] - amount);
      overlord.resources[resourceType] += amount;
      tribe.relations[overlord.id] = clamp(tribe.relations[overlord.id]! - 1, -100, 100);
      overlord.relations[tribe.id] = clamp(overlord.relations[tribe.id]! + 1, -100, 100);
      this.pushEvent({
        kind: "tribute-paid",
        title: `${tribe.name} pays tribute to ${overlord.name}`,
        description: `${tribe.name} sends ${ResourceType[resourceType].toLowerCase()} to ${overlord.name} to avoid harsher pressure.`,
        x: tribe.capitalX,
        y: tribe.capitalY,
        tribeId: overlord.id,
      });
    }
  }

  private updateAllianceAid(): void {
    if (this.tickCount % (SIM_TICKS_PER_SECOND * 18) !== 0) {
      return;
    }

    for (const tribe of this.tribes) {
      const needsAid = tribe.resources[ResourceType.Rations] < this.populationOf(tribe.id) * 2.5 || tribe.water < Math.max(10, this.populationOf(tribe.id) * 0.4);
      if (!needsAid) continue;
      const allies = this.tribes.filter((other) =>
        other.id !== tribe.id &&
        diplomacyStateFromScore(tribe.relations[other.id]!) === DiplomacyState.Alliance &&
        other.resources[ResourceType.Rations] > this.populationOf(other.id) * 4 &&
        other.water > Math.max(14, this.populationOf(other.id) * 0.75),
      );
      const ally = allies.sort((a, b) => manhattan(tribe.capitalX, tribe.capitalY, a.capitalX, a.capitalY) - manhattan(tribe.capitalX, tribe.capitalY, b.capitalX, b.capitalY))[0];
      if (!ally) continue;

      const airlift = this.buildingCount(ally.id, BuildingType.Airfield) > 0 || this.buildingCount(tribe.id, BuildingType.Airfield) > 0;
      const rationAid = Math.min(airlift ? 28 : 18, Math.max(airlift ? 10 : 6, Math.floor(this.populationOf(tribe.id) * (airlift ? 0.42 : 0.3))));
      const waterAid = Math.min(airlift ? 22 : 14, Math.max(airlift ? 8 : 4, Math.floor(this.populationOf(tribe.id) * (airlift ? 0.3 : 0.22))));
      ally.resources[ResourceType.Rations] -= rationAid;
      tribe.resources[ResourceType.Rations] += rationAid;
      ally.water = Math.max(0, ally.water - waterAid);
      tribe.water += waterAid;
      tribe.relations[ally.id] = clamp(tribe.relations[ally.id]! + (airlift ? 3 : 2), -100, 100);
      ally.relations[tribe.id] = clamp(ally.relations[tribe.id]! + (airlift ? 3 : 2), -100, 100);
      this.pushEvent({
        kind: "alliance-aid",
        title: `${ally.name} ${airlift ? "airlifts" : "sends"} aid to ${tribe.name}`,
        description: `${ally.name} has ${airlift ? "airlifted" : "sent"} food and water to support ${tribe.name} through hardship.`,
        x: tribe.capitalX,
        y: tribe.capitalY,
        tribeId: ally.id,
      });
    }
  }

  private updateSiegeEngines(): void {
    for (let index = this.siegeEngines.length - 1; index >= 0; index -= 1) {
      const engine = this.siegeEngines[index]!;
      const tribe = this.tribes[engine.tribeId];
      if (!tribe || engine.hp <= 0) {
        this.siegeEngines.splice(index, 1);
        continue;
      }

      const enemies = this.tribes
        .filter((other) => other.id !== tribe.id && diplomacyStateFromScore(tribe.relations[other.id]!) >= DiplomacyState.Hostile)
        .sort((a, b) => manhattan(engine.x, engine.y, a.capitalX, a.capitalY) - manhattan(engine.x, engine.y, b.capitalX, b.capitalY));
      const enemy = enemies[0];
      if (!enemy) {
        engine.task = "idle";
        continue;
      }

      engine.targetX = enemy.capitalX;
      engine.targetY = enemy.capitalY;
      const bombardRange =
        engine.type === SiegeEngineType.Trebuchet ? 9
        : engine.type === SiegeEngineType.Ballista ? 7
        : engine.type === SiegeEngineType.Cannon ? 8
        : engine.type === SiegeEngineType.Mortar ? 10
        : engine.type === SiegeEngineType.Tank ? 6
        : engine.type === SiegeEngineType.Zeppelin ? 11
        : engine.type === SiegeEngineType.SiegeTower ? 2
        : 3;
      const distance = manhattan(engine.x, engine.y, engine.targetX, engine.targetY);
      if (distance <= bombardRange) {
        engine.task = "bombard";
        if (engine.moveCooldown > 0) {
          engine.moveCooldown -= 1;
        } else {
          const strikeBuilding = this.buildings.find((building) => building.tribeId === enemy.id && manhattan(building.x, building.y, engine.targetX, engine.targetY) <= 4);
          if (strikeBuilding) {
            strikeBuilding.hp -=
              engine.type === SiegeEngineType.Trebuchet ? 20
              : engine.type === SiegeEngineType.Ballista ? 14
              : engine.type === SiegeEngineType.Cannon ? 24
              : engine.type === SiegeEngineType.Mortar ? 28
              : engine.type === SiegeEngineType.Tank ? 30
              : engine.type === SiegeEngineType.Zeppelin ? 26
              : engine.type === SiegeEngineType.SiegeTower ? 10
              : 12;
            if (strikeBuilding.hp <= 0) {
              this.removeBuilding(strikeBuilding);
            }
          }
          const defenders = this.agents.filter((agent) => agent.tribeId === enemy.id && manhattan(agent.x, agent.y, engine.targetX, engine.targetY) <= 4);
          if (defenders.length > 0) {
            this.applyDamage(
              chooseOne(this.random, defenders),
              engine.type === SiegeEngineType.Trebuchet ? 10
              : engine.type === SiegeEngineType.Ballista ? 8
              : engine.type === SiegeEngineType.Cannon ? 12
              : engine.type === SiegeEngineType.Mortar ? 15
              : engine.type === SiegeEngineType.Tank ? 18
              : engine.type === SiegeEngineType.Zeppelin ? 14
              : 6,
            );
          }
          engine.moveCooldown =
            engine.type === SiegeEngineType.Trebuchet ? 8
            : engine.type === SiegeEngineType.Ballista ? 6
            : engine.type === SiegeEngineType.Cannon ? 7
            : engine.type === SiegeEngineType.Mortar ? 9
            : engine.type === SiegeEngineType.Tank ? 5
            : engine.type === SiegeEngineType.Zeppelin ? 4
            : 5;
          if (this.tickCount % 18 === 0) {
            this.pushEvent({
              kind: "siege-engine",
              title: `${tribe.name} deploys ${SiegeEngineType[engine.type]}`,
              description: `${tribe.name} is bombarding ${enemy.name} with a ${SiegeEngineType[engine.type].toLowerCase()}.`,
              x: engine.x,
              y: engine.y,
              tribeId: tribe.id,
            });
          }
        }
        continue;
      }

      engine.task = "march";
      if (engine.type === SiegeEngineType.Zeppelin) {
        if (engine.moveCooldown > 0) {
          engine.moveCooldown -= 1;
        } else {
          if (engine.x < engine.targetX) engine.x += 1;
          else if (engine.x > engine.targetX) engine.x -= 1;
          if (engine.y < engine.targetY) engine.y += 1;
          else if (engine.y > engine.targetY) engine.y -= 1;
          engine.moveCooldown = 1;
        }
        continue;
      }
      if (engine.path.length <= 1 || engine.pathIndex >= engine.path.length - 1 || this.tickCount % 10 === 0) {
        const approachX = enemy.capitalX + randInt(this.random, -bombardRange, bombardRange);
        const approachY = enemy.capitalY + randInt(this.random, -bombardRange, bombardRange);
        engine.path = findPath(this.world, engine.x, engine.y, clamp(approachX, 1, this.world.width - 2), clamp(approachY, 1, this.world.height - 2));
        engine.pathIndex = 0;
      }
      if (engine.moveCooldown > 0) {
        engine.moveCooldown -= 1;
      } else if (engine.path.length > 1 && engine.pathIndex < engine.path.length - 1) {
        engine.pathIndex += 1;
        const { x, y } = coordsOf(engine.path[engine.pathIndex]!, this.world.width);
        engine.x = x;
        engine.y = y;
        engine.moveCooldown = engine.type === SiegeEngineType.Tank ? 1 : 2;
      }
    }
  }

  private updateWeather(): void {
    for (const cell of this.weatherCells) {
      if (this.tickCount % 8 === 0) {
        cell.x = clamp(cell.x + cell.dx, 0, this.world.width - 1);
        cell.y = clamp(cell.y + cell.dy, 0, this.world.height - 1);
        if (cell.x <= 0 || cell.x >= this.world.width - 1) cell.dx *= -1;
        if (cell.y <= 0 || cell.y >= this.world.height - 1) cell.dy *= -1;
        if (this.random() > 0.96) {
          cell.kind = this.pickWeatherKindForTile(cell.x, cell.y);
        }
      }
    }

    if (this.tickCount % (YEAR_TICKS / 6) === 0) {
      const candidate = chooseOne(this.random, this.weatherCells);
      candidate.intensity = randInt(this.random, 60, 100);
      candidate.radius = randInt(this.random, 24, 60);
      candidate.kind = this.pickWeatherKindForTile(candidate.x, candidate.y);
      this.pushEvent({
        kind: "weather-front",
        title: `${WeatherKind[candidate.kind]} front`,
        description: `A ${WeatherKind[candidate.kind].toLowerCase()} front is moving across the region.`,
        x: candidate.x,
        y: candidate.y,
        tribeId: null,
      });
    }
  }

  private addSurfaceWater(index: number, amount: number): void {
    const terrain = this.world.terrain[index] as TerrainType;
    if (isWaterTerrain(terrain) || terrain === TerrainType.Lava) {
      return;
    }
    const next = clamp(this.world.surfaceWater[index]! + amount, 0, 255);
    if (next === this.world.surfaceWater[index]) return;
    this.world.surfaceWater[index] = next;
    if (next > 0) {
      this.activeWetTiles.add(index);
    } else {
      this.activeWetTiles.delete(index);
    }
    this.markDirty(index);
  }

  private removeSurfaceWater(index: number, amount: number): void {
    const terrain = this.world.terrain[index] as TerrainType;
    if (isWaterTerrain(terrain) || terrain === TerrainType.Lava) {
      return;
    }
    const next = clamp(this.world.surfaceWater[index]! - amount, 0, 255);
    if (next === this.world.surfaceWater[index]) return;
    this.world.surfaceWater[index] = next;
    if (next > 0) {
      this.activeWetTiles.add(index);
    } else {
      this.activeWetTiles.delete(index);
    }
    this.markDirty(index);
  }

  private updateSurfaceWater(): void {
    const startupWaterDampener = this.tickCount < YEAR_TICKS / 8 ? 0.35 : this.tickCount < YEAR_TICKS / 4 ? 0.6 : 1;
    if (this.tickCount % 2 === 0) {
      for (const cell of this.weatherCells) {
        if (!(cell.kind === WeatherKind.Rain || cell.kind === WeatherKind.Storm || cell.kind === WeatherKind.Blizzard)) continue;
        const intensity =
          cell.kind === WeatherKind.Storm ? 12
          : cell.kind === WeatherKind.Blizzard ? 7
          : 8;
        const step = cell.radius > 18 ? 3 : 2;
        for (let y = Math.max(1, cell.y - cell.radius); y <= Math.min(this.world.height - 2, cell.y + cell.radius); y += step) {
          for (let x = Math.max(1, cell.x - cell.radius); x <= Math.min(this.world.width - 2, cell.x + cell.radius); x += step) {
            if (Math.hypot(x - cell.x, y - cell.y) > cell.radius) continue;
            const index = indexOf(x, y, this.world.width);
            const terrain = this.world.terrain[index] as TerrainType;
            if (!isBuildableTerrain(terrain) && terrain !== TerrainType.Marsh && terrain !== TerrainType.Farmland && terrain !== TerrainType.Rocky) continue;
            const deposit =
              intensity
              + (terrain === TerrainType.Marsh ? 4 : 0)
              + (this.world.feature[index] === FeatureType.IrrigationCanal ? 6 : 0)
              + (this.world.feature[index] === FeatureType.Trench ? 4 : 0)
              - Math.max(0, Math.floor((this.world.elevation[index]! - 120) / 32));
            const adjustedDeposit = Math.floor(deposit * startupWaterDampener);
            if (adjustedDeposit > 0) {
              this.addSurfaceWater(index, adjustedDeposit);
            }
          }
        }
      }
    }

    const limit = 1800;
    const toProcess: number[] = [];
    for (const index of this.activeWetTiles) {
      toProcess.push(index);
      if (toProcess.length >= limit) break;
    }

    for (const index of toProcess) {
      const terrain = this.world.terrain[index] as TerrainType;
      const feature = this.world.feature[index] as FeatureType;
      if (isWaterTerrain(terrain) || terrain === TerrainType.Lava) {
        if (this.world.surfaceWater[index] !== 0) {
          this.world.surfaceWater[index] = 0;
          this.markDirty(index);
        }
        this.activeWetTiles.delete(index);
        continue;
      }

      const x = index % this.world.width;
      const y = Math.floor(index / this.world.width);
      const floor =
        terrain === TerrainType.Marsh ? 10
        : feature === FeatureType.IrrigationCanal ? 4
        : feature === FeatureType.Trench ? 2
        : 0;
      let amount = this.world.surfaceWater[index]!;
      const evaporation =
        this.season === SeasonType.Summer ? 3
        : this.season === SeasonType.Winter ? 1
        : 2;
      amount = Math.max(floor, amount - evaporation);

      let lowestIndex = -1;
      let lowestScore = this.world.elevation[index]! + amount * 0.1;
      for (const [dx, dy] of CARDINALS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, this.world.width, this.world.height)) continue;
        const nearIndex = indexOf(nx, ny, this.world.width);
        const nearTerrain = this.world.terrain[nearIndex] as TerrainType;
        if (nearTerrain === TerrainType.Lava) continue;
        const score =
          isWaterTerrain(nearTerrain) ? -100
          : this.world.elevation[nearIndex]! + this.world.surfaceWater[nearIndex]! * 0.12 - (this.world.feature[nearIndex] === FeatureType.Trench ? 4 : 0) - (this.world.feature[nearIndex] === FeatureType.IrrigationCanal ? 6 : 0);
        if (score < lowestScore) {
          lowestScore = score;
          lowestIndex = nearIndex;
        }
      }

      if (lowestIndex >= 0 && amount > floor + 3) {
        const targetTerrain = this.world.terrain[lowestIndex] as TerrainType;
        const transfer = Math.min(14, Math.max(3, Math.floor((amount - floor) * 0.35)));
        amount = Math.max(floor, amount - transfer);
        if (!isWaterTerrain(targetTerrain)) {
          this.addSurfaceWater(lowestIndex, transfer);
        }
      }

      if (this.world.surfaceWater[index] !== amount) {
        this.world.surfaceWater[index] = amount;
        this.markDirty(index);
      }
      if (amount <= floor) {
        if (amount === 0 || floor === 0) {
          this.activeWetTiles.delete(index);
        }
      } else {
        this.activeWetTiles.add(index);
      }
    }
  }

  private updateWaterInfrastructure(): void {
    if (this.tickCount % SIM_TICKS_PER_SECOND !== 0) {
      return;
    }

    for (const tribe of this.tribes) {
      const population = this.populationOf(tribe.id);
      const capacity = this.waterCapacityForTribe(tribe.id, population);
      const tribeBuildings = this.buildingsForTribe(tribe.id);
      const cisterns = tribeBuildings.filter((building) => building.type === BuildingType.Cistern);
      const farms = tribeBuildings.filter((building) => building.type === BuildingType.Farm || building.type === BuildingType.Orchard);
      if (cisterns.length === 0 && farms.length === 0) {
        continue;
      }

      let absorbed = 0;
      let released = 0;
      let overflowed = 0;
      const weather = this.weatherAt(tribe.capitalX, tribe.capitalY);

      for (const cistern of cisterns) {
        const center = buildingCenter(cistern);
        let free = Math.max(0, capacity - (tribe.water + absorbed));

        for (let dy = -2; dy <= 2 && free > 0; dy += 1) {
          for (let dx = -2; dx <= 2 && free > 0; dx += 1) {
            const x = center.x + dx;
            const y = center.y + dy;
            if (!inBounds(x, y, this.world.width, this.world.height)) continue;
            const index = indexOf(x, y, this.world.width);
            const feature = this.world.feature[index] as FeatureType;
            const baseline =
              this.world.terrain[index] === TerrainType.Marsh ? 10
              : feature === FeatureType.IrrigationCanal ? 4
              : feature === FeatureType.Trench ? 2
              : 0;
            const available = Math.max(0, this.world.surfaceWater[index]! - baseline);
            if (available <= 0) continue;
            const taken = Math.min(free, available, feature === FeatureType.IrrigationCanal ? 8 : 5);
            if (taken <= 0) continue;
            this.removeSurfaceWater(index, taken);
            absorbed += taken;
            free -= taken;
          }
        }

        if (free > 0 && hasAdjacentWater(this.world, center.x, center.y, 5)) {
          const intake = Math.min(free, weather === WeatherKind.Storm ? 6 : weather === WeatherKind.Rain ? 4 : 3);
          absorbed += intake;
          free -= intake;
        }

        if (free > 0 && (weather === WeatherKind.Rain || weather === WeatherKind.Storm || weather === WeatherKind.Blizzard)) {
          const roofCatch = Math.min(free, weather === WeatherKind.Storm ? 5 : weather === WeatherKind.Blizzard ? 2 : 3);
          absorbed += roofCatch;
        }
      }

      if (absorbed > 0) {
        tribe.water = clamp(tribe.water + absorbed, 0, capacity);
      }

      for (const farm of farms) {
        const center = buildingCenter(farm);
        const cisternNear = this.nearestBuildingDistance(tribe.id, BuildingType.Cistern, center.x, center.y) <= 10;
        let connectedWetCanal = false;
        const waterworkTargets: number[] = [];
        for (let dy = -1; dy <= farm.height; dy += 1) {
          for (let dx = -1; dx <= farm.width; dx += 1) {
            const x = farm.x + dx;
            const y = farm.y + dy;
            if (!inBounds(x, y, this.world.width, this.world.height)) continue;
            const index = indexOf(x, y, this.world.width);
            const feature = this.world.feature[index] as FeatureType;
            if (feature === FeatureType.IrrigationCanal || feature === FeatureType.Trench) {
              waterworkTargets.push(index);
              if (this.world.surfaceWater[index]! >= (feature === FeatureType.IrrigationCanal ? 18 : 10)) {
                connectedWetCanal = true;
              }
            }
          }
        }

        if ((cisternNear || connectedWetCanal) && tribe.water > Math.max(8, population * 0.22)) {
          for (let dy = 0; dy < farm.height; dy += 1) {
            for (let dx = 0; dx < farm.width; dx += 1) {
              const index = indexOf(farm.x + dx, farm.y + dy, this.world.width);
              const depth = this.world.surfaceWater[index]!;
              if (depth >= 18) continue;
              const add = Math.min(6, 18 - depth);
              if (add <= 0) continue;
              this.addSurfaceWater(index, add);
              tribe.water = Math.max(0, tribe.water - Math.ceil(add * 0.35));
              released += add;
            }
          }
        }

        for (const index of waterworkTargets) {
          const feature = this.world.feature[index] as FeatureType;
          const target = feature === FeatureType.IrrigationCanal ? 22 : 12;
          const depth = this.world.surfaceWater[index]!;
          if (depth >= target) continue;
          if (hasAdjacentWater(this.world, index % this.world.width, Math.floor(index / this.world.width), 4)) {
            this.addSurfaceWater(index, target - depth);
            continue;
          }
          if ((cisternNear || connectedWetCanal) && tribe.water > Math.max(6, population * 0.12)) {
            const added = Math.min(target - depth, 5);
            this.addSurfaceWater(index, added);
            tribe.water = Math.max(0, tribe.water - Math.ceil(added * 0.45));
            released += added;
          }
        }
      }

      if (tribe.water > capacity * 0.88 && (weather === WeatherKind.Storm || weather === WeatherKind.Rain)) {
        for (const cistern of cisterns) {
          const center = buildingCenter(cistern);
          for (let dy = -2; dy <= 2; dy += 1) {
            for (let dx = -2; dx <= 2; dx += 1) {
              const x = center.x + dx;
              const y = center.y + dy;
              if (!inBounds(x, y, this.world.width, this.world.height)) continue;
              const index = indexOf(x, y, this.world.width);
              const feature = this.world.feature[index] as FeatureType;
              if (feature === FeatureType.IrrigationCanal || feature === FeatureType.Trench || this.world.terrain[index] === TerrainType.Farmland) {
                this.addSurfaceWater(index, feature === FeatureType.IrrigationCanal ? 8 : 5);
                overflowed += 1;
              }
            }
          }
        }
      }

      if (released >= 20 && this.tickCount % (SIM_TICKS_PER_SECOND * 24) === 0) {
        this.pushEvent({
          kind: "irrigation-release",
          title: `${tribe.name} runs its waterworks`,
          description: `${tribe.name} is pushing stored water through canals and fields to keep crops alive.`,
          x: tribe.capitalX,
          y: tribe.capitalY,
          tribeId: tribe.id,
        });
      }

      if (overflowed >= 6 && this.tickCount % (SIM_TICKS_PER_SECOND * 24) === 0) {
        this.pushEvent({
          kind: "spillway",
          title: `${tribe.name} opens overflow channels`,
          description: `${tribe.name} is shedding excess water through trenches and canals after heavy weather.`,
          x: tribe.capitalX,
          y: tribe.capitalY,
          tribeId: tribe.id,
        });
      }
    }
  }

  private carveUndergroundAccess(building: BuildingState): void {
    if (building.type !== BuildingType.MountainHall && building.type !== BuildingType.TunnelEntrance && building.type !== BuildingType.DeepMine) {
      return;
    }

    const center = buildingCenter(building);
    const radius = building.type === BuildingType.MountainHall ? 1 : building.type === BuildingType.DeepMine ? 2 : 1;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = center.x + dx;
        const y = center.y + dy;
        if (!inBounds(x, y, this.world.width, this.world.height)) continue;
        if (Math.abs(dx) + Math.abs(dy) > radius + (building.type === BuildingType.DeepMine ? 1 : 0)) continue;
        const index = indexOf(x, y, this.world.width);
        const underground = this.world.undergroundTerrain[index] as UndergroundTerrainType;
        if (underground === UndergroundTerrainType.Magma || underground === UndergroundTerrainType.UndergroundRiver) continue;
        if (underground !== UndergroundTerrainType.Tunnel) {
          this.world.undergroundTerrain[index] = UndergroundTerrainType.Tunnel;
          this.markDirty(index);
        }
      }
    }
  }

  private chooseUndergroundExcavationTarget(site: BuildingState): number | null {
    const center = buildingCenter(site);
    let bestIndex: number | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let dy = -6; dy <= 6; dy += 1) {
      for (let dx = -6; dx <= 6; dx += 1) {
        const x = center.x + dx;
        const y = center.y + dy;
        if (!inBounds(x, y, this.world.width, this.world.height)) continue;
        const index = indexOf(x, y, this.world.width);
        const underground = this.world.undergroundTerrain[index] as UndergroundTerrainType;
        if (underground === UndergroundTerrainType.Tunnel) continue;

        let adjacentTunnel = manhattan(center.x, center.y, x, y) <= 1;
        for (const [sx, sy] of CARDINALS) {
          const nx = x + sx;
          const ny = y + sy;
          if (!inBounds(nx, ny, this.world.width, this.world.height)) continue;
          if (this.world.undergroundTerrain[indexOf(nx, ny, this.world.width)] === UndergroundTerrainType.Tunnel) {
            adjacentTunnel = true;
            break;
          }
        }
        if (!adjacentTunnel) continue;

        const feature = this.world.undergroundFeature[index] as UndergroundFeatureType;
        const resourceAmount = this.world.undergroundResourceAmount[index] ?? 0;
        const score =
          (underground === UndergroundTerrainType.Ruins ? 42 : underground === UndergroundTerrainType.Cavern ? 28 : underground === UndergroundTerrainType.SolidRock ? 12 : underground === UndergroundTerrainType.UndergroundRiver ? 6 : -8)
          + (feature === UndergroundFeatureType.OreSeam ? 35 : feature === UndergroundFeatureType.AncientRemains ? 24 : feature === UndergroundFeatureType.CrystalCluster ? 18 : feature === UndergroundFeatureType.MushroomGrove ? 14 : feature === UndergroundFeatureType.RootTangle ? 10 : 0)
          + resourceAmount * 0.05
          - manhattan(center.x, center.y, x, y) * 1.8;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
    }
    return bestIndex;
  }

  private excavatedUndergroundTilesForTribe(tribeId: number): number {
    const seen = new Set<number>();
    const sites = this.buildingsForTribe(tribeId).filter((building) =>
      (building.type === BuildingType.MountainHall || building.type === BuildingType.TunnelEntrance || building.type === BuildingType.DeepMine),
    );
    for (const site of sites) {
      const center = buildingCenter(site);
      const radius = site.type === BuildingType.DeepMine ? 8 : 6;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const x = center.x + dx;
          const y = center.y + dy;
          if (!inBounds(x, y, this.world.width, this.world.height)) continue;
          const index = indexOf(x, y, this.world.width);
          const underground = this.world.undergroundTerrain[index] as UndergroundTerrainType;
          if (underground === UndergroundTerrainType.Tunnel || underground === UndergroundTerrainType.Cavern || underground === UndergroundTerrainType.Ruins) {
            seen.add(index);
          }
        }
      }
    }
    return seen.size;
  }

  private excavateUnderground(site: BuildingState, tribe: TribeState, agent: AgentState): { resourceType: ResourceType; amount: number } | null {
    const target = this.chooseUndergroundExcavationTarget(site);
    if (target === null) {
      return null;
    }

    const x = target % this.world.width;
    const y = Math.floor(target / this.world.width);
    const underground = this.world.undergroundTerrain[target] as UndergroundTerrainType;
    const feature = this.world.undergroundFeature[target] as UndergroundFeatureType;

    if (underground === UndergroundTerrainType.Magma) {
      this.applyDamage(agent, 18);
      this.pushEvent({
        kind: "magma-breach",
        title: `${tribe.name} opens a magma seam`,
        description: `${agent.name} struck heat and fire in the deep works, forcing the delvers back.`,
        x,
        y,
        tribeId: tribe.id,
      });
      return { resourceType: ResourceType.Stone, amount: 1 };
    }

    if (underground === UndergroundTerrainType.UndergroundRiver) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const sx = site.x + dx;
          const sy = site.y + dy;
          if (!inBounds(sx, sy, this.world.width, this.world.height)) continue;
          this.addSurfaceWater(indexOf(sx, sy, this.world.width), 14);
        }
      }
      tribe.water += 4;
      this.pushEvent({
        kind: "spring",
        title: `${tribe.name} breaks into an underground spring`,
        description: `${agent.name} found running water under the settlement and the cisterns begin to refill.`,
        x,
        y,
        tribeId: tribe.id,
      });
      return { resourceType: ResourceType.Stone, amount: 2 };
    }

    if (underground !== UndergroundTerrainType.Tunnel) {
      this.world.undergroundTerrain[target] = UndergroundTerrainType.Tunnel;
    }

    let resourceType = this.world.undergroundResourceType[target] as ResourceType;
    let amount = 0;
    if (resourceType !== ResourceType.None && this.world.undergroundResourceAmount[target] > 0) {
      const available = this.world.undergroundResourceAmount[target]!;
      amount = Math.min(available, feature === UndergroundFeatureType.OreSeam ? randInt(this.random, 5, 11) : feature === UndergroundFeatureType.MushroomGrove ? randInt(this.random, 3, 7) : randInt(this.random, 2, 6));
      this.world.undergroundResourceAmount[target] = Math.max(0, available - amount);
      if (this.world.undergroundResourceAmount[target] === 0) {
        this.world.undergroundResourceType[target] = ResourceType.None;
        this.world.undergroundFeature[target] = UndergroundFeatureType.None;
      }
    } else {
      resourceType = underground === UndergroundTerrainType.Ruins ? ResourceType.Stone : ResourceType.Ore;
      amount = underground === UndergroundTerrainType.Ruins ? randInt(this.random, 2, 4) : randInt(this.random, 2, 5);
    }

    tribe.research += underground === UndergroundTerrainType.Ruins ? 5 : underground === UndergroundTerrainType.Cavern ? 3 : 2;
    if (feature === UndergroundFeatureType.CrystalCluster) {
      tribe.faith += 2;
      tribe.research += 3;
    }
    if (feature === UndergroundFeatureType.AncientRemains && this.random() > 0.72) {
      agent.gear = improveGear(agent.gear, "Underdeep");
      agent.level = clamp(agent.level + 1, 1, 9);
      agent.title = titleForAgent(agent, tribe.race.type);
      tribe.resources[ResourceType.BasicArmor] += 1;
    }
    if (underground === UndergroundTerrainType.Cavern && this.random() > 0.82) {
      this.pushEvent({
        kind: "cavern-opened",
        title: `${tribe.name} opens a new cavern`,
        description: `${agent.name} broke into a larger underground chamber beneath ${tribe.name}.`,
        x,
        y,
        tribeId: tribe.id,
      });
    }

    this.markDirty(target);
    return { resourceType, amount };
  }

  private pickWeatherKindForTile(x: number, y: number): WeatherKind {
    const index = indexOf(x, y, this.world.width);
    const biome = this.world.biome[index] as BiomeType;
    if (biome === BiomeType.Tundra || biome === BiomeType.Alpine || biome === BiomeType.SnowyForest) return this.random() > 0.35 ? WeatherKind.Blizzard : WeatherKind.Fog;
    if (biome === BiomeType.Desert || biome === BiomeType.Scrubland) return this.random() > 0.4 ? WeatherKind.Heatwave : WeatherKind.Clear;
    if (biome === BiomeType.AshWaste || biome === BiomeType.VolcanicHighland) return WeatherKind.AshStorm;
    if (biome === BiomeType.Marshland || biome === BiomeType.Coastline || biome === BiomeType.Archipelago) return this.random() > 0.5 ? WeatherKind.Storm : WeatherKind.Rain;
    return this.random() > 0.6 ? WeatherKind.Rain : WeatherKind.Fog;
  }

  private weatherAt(x: number, y: number): WeatherKind {
    let strongest: WeatherCellState | null = null;
    let best = 0;
    for (const cell of this.weatherCells) {
      const distance = Math.hypot(cell.x - x, cell.y - y);
      if (distance > cell.radius) continue;
      const influence = cell.intensity - distance;
      if (influence > best) {
        best = influence;
        strongest = cell;
      }
    }
    return strongest?.kind ?? WeatherKind.Clear;
  }

  private updateLegendaryCreatures(): void {
    for (const creature of this.creatures) {
      creature.moveCooldown -= 1;
      const nearestTribe = this.findNearestTribe(creature.x, creature.y);
      if (this.currentYear >= 3 && nearestTribe && manhattan(nearestTribe.capitalX, nearestTribe.capitalY, creature.lairX, creature.lairY) < 140 && this.random() > 0.992) {
        creature.active = true;
        this.pushEvent({
          kind: "legendary-awakening",
          title: `${creature.name} awakens`,
          description: `${creature.name} has left its lair and threatens nearby settlements.`,
          x: creature.x,
          y: creature.y,
          tribeId: nearestTribe.id,
        });
      }

      if (creature.moveCooldown > 0) {
        continue;
      }
      creature.moveCooldown = randInt(this.random, 1, 3);

      if (!creature.active) {
        const [dx, dy] = chooseOne(this.random, [...CARDINALS, [0, 0]] as const);
        const nx = clamp(creature.lairX + dx, 0, this.world.width - 1);
        const ny = clamp(creature.lairY + dy, 0, this.world.height - 1);
        creature.x = nx;
        creature.y = ny;
        continue;
      }

      const tribe = this.findNearestTribe(creature.x, creature.y);
      if (!tribe) continue;
      const stepX = Math.sign(tribe.capitalX - creature.x);
      const stepY = Math.sign(tribe.capitalY - creature.y);
      creature.x = clamp(creature.x + stepX, 0, this.world.width - 1);
      creature.y = clamp(creature.y + stepY, 0, this.world.height - 1);

      if (manhattan(creature.x, creature.y, tribe.capitalX, tribe.capitalY) <= 5) {
        this.strikeLegendaryCreature(creature, tribe.id);
        if (this.random() > 0.88) {
          creature.active = false;
          creature.x = creature.lairX;
          creature.y = creature.lairY;
        }
      }
    }
  }

  private strikeLegendaryCreature(creature: CreatureState, tribeId: number): void {
    const building = this.buildings.find((entry) => entry.tribeId === tribeId && manhattan(entry.x, entry.y, creature.x, creature.y) <= 3);
    if (building) {
      building.hp -= 18;
      if (building.hp <= 0) {
        this.removeBuilding(building);
      }
    }

    const victim = this.agents.find((agent) => agent.tribeId === tribeId && manhattan(agent.x, agent.y, creature.x, creature.y) <= 4);
    if (victim) {
      this.applyDamage(victim, 24);
    }

    if (this.tickCount % 20 === 0) {
      this.pushEvent({
        kind: "legendary-raid",
        title: `${creature.name} attacks`,
        description: `${creature.name} is ravaging the lands of ${this.tribes[tribeId]!.name}.`,
        x: creature.x,
        y: creature.y,
        tribeId,
      });
    }
  }

  private updateAgents(): void {
    for (const agent of this.agents) {
      const tribe = this.tribes[agent.tribeId]!;
      const localWeather = this.weatherAt(agent.x, agent.y);
      const terrain = this.world.terrain[indexOf(agent.x, agent.y, this.world.width)]!;
      const taskKind = agent.task?.kind;
      const activeTask = taskKind && taskKind !== "idle" && taskKind !== "recover";
      const strenuousTask = taskKind === "attack" || taskKind === "patrol" || taskKind === "build" || taskKind === "earthwork" || taskKind === "haul" || taskKind === "delve" || taskKind === "dungeon" || taskKind === "mine" || taskKind === "quarry";
      agent.ageTicks += 1;
      agent.spellCooldown = Math.max(0, agent.spellCooldown - 1);
      const ageYears = Math.floor(agent.ageTicks / YEAR_TICKS) + 18;
      agent.hunger += this.season === SeasonType.Winter ? 0.18 : 0.12;
      agent.warmth -= this.season === SeasonType.Winter ? 0.24 : 0.06;
      if (localWeather === WeatherKind.Blizzard) {
        agent.warmth -= 0.22;
      } else if (localWeather === WeatherKind.Storm || localWeather === WeatherKind.Rain) {
        agent.warmth -= 0.08;
      } else if (localWeather === WeatherKind.Heatwave) {
        agent.hunger += 0.08;
      }
      agent.fatigue = clamp(
        agent.fatigue
          + (activeTask ? (strenuousTask ? 0.34 : 0.22) : -0.52)
          + (localWeather === WeatherKind.Heatwave ? 0.14 : localWeather === WeatherKind.Blizzard ? 0.1 : localWeather === WeatherKind.Storm ? 0.06 : 0)
          + (agent.hunger > 68 ? 0.08 : 0)
          + (agent.wounds > 0 ? agent.wounds * 0.04 : 0)
          - (tribe.morale > 78 ? 0.04 : 0),
        0,
        100,
      );
      const reliefSites =
        this.buildingCount(tribe.id, BuildingType.Infirmary) +
        this.buildingCount(tribe.id, BuildingType.Tavern) +
        this.buildingCount(tribe.id, BuildingType.Shrine);
      agent.sickness = clamp(
        agent.sickness
          + (terrain === TerrainType.Marsh ? 0.18 : 0)
          + (localWeather === WeatherKind.AshStorm ? 0.16 : localWeather === WeatherKind.Blizzard ? 0.08 : 0)
          + (agent.warmth < 28 ? 0.12 : 0)
          + (agent.hunger > 76 ? 0.08 : 0)
          + (agent.wounds > 0 ? 0.03 * agent.wounds : 0)
          + (taskKind === "delve" ? 0.16 : taskKind === "dungeon" ? 0.08 : 0)
          - (taskKind === "recover" ? 0.54 : !activeTask ? 0.22 : 0.08)
          - reliefSites * 0.02
          - ((agent.hero || agent.blessed) ? 0.05 : 0),
        0,
        100,
      );
      agent.inspiration = clamp(
        agent.inspiration
          + (tribe.morale > 78 ? 0.18 : tribe.morale > 68 ? 0.08 : -0.08)
          + this.buildingCount(tribe.id, BuildingType.Tavern) * 0.03
          + this.buildingCount(tribe.id, BuildingType.Shrine) * 0.025
          + ((agent.hero || agent.blessed) ? 0.08 : 0)
          + (tribe.rulerAgentId === agent.id ? 0.06 : 0)
          - (agent.wounds > 0 ? 0.1 : 0)
          - (agent.sickness > 40 ? 0.12 : 0)
          - (localWeather === WeatherKind.AshStorm ? 0.08 : 0),
        0,
        100,
      );
      if (agent.hunger > 95) {
        agent.health -= 0.7;
      }
      if (agent.warmth < 20) {
        agent.health -= 0.35;
      }
      if (agent.sickness > 78) {
        agent.health -= 0.45;
      }
      if (agent.fatigue > 92) {
        agent.health -= 0.14;
      }
      if (agent.health <= 0) {
        agent.health = 0;
        continue;
      }
      if (ageYears > 72 && this.random() > 0.997) {
        agent.health = 0;
        this.pushEvent({
          kind: "old-age",
          title: `${agent.name} dies of old age`,
          description: `${agent.name} of ${tribe.name} passed away after a long life.`,
          x: agent.x,
          y: agent.y,
          tribeId: tribe.id,
        });
        continue;
      }
      if (agent.hunger > 55 && tribe.resources[ResourceType.Rations] > 0) {
        tribe.resources[ResourceType.Rations] -= 1;
        agent.hunger = Math.max(0, agent.hunger - 32);
        tribe.lastFoodTick = this.tickCount;
      }
      if (agent.warmth < 65) {
        agent.warmth = Math.min(100, agent.warmth + 0.18);
      }
      agent.condition = this.deriveCondition(agent);
      if (
        (agent.health < 28 || agent.wounds >= 4 || agent.sickness >= 68 || agent.fatigue >= 88)
        && agent.task
        && agent.task.kind !== "recover"
      ) {
        this.finishTask(agent);
      }
      if (!agent.task || agent.task.kind === "idle") {
        agent.health = Math.min(100, agent.health + (agent.hero ? 0.18 : 0.08));
        if (agent.wounds > 0 && this.tickCount % (SIM_TICKS_PER_SECOND * 8) === 0) {
          agent.wounds -= 1;
        }
      }

      if (agent.moveCooldown > 0) {
        agent.moveCooldown -= 1;
      } else if (agent.path.length > 1 && agent.pathIndex < agent.path.length - 1) {
        agent.pathIndex += 1;
        const { x, y } = coordsOf(agent.path[agent.pathIndex]!, this.world.width);
        agent.x = x;
        agent.y = y;
        const tileIndex = indexOf(x, y, this.world.width);
        agent.moveCooldown =
          agent.wounds >= 2 || agent.fatigue >= 72 || agent.sickness >= 58 ? 1
          : agent.role === AgentRole.Rider && agent.fatigue < 62 ? 0
          : this.world.road[tileIndex] > 0 ? 0
          : 1;
      }

      if (!agent.task) {
        agent.task = this.claimTask(agent, tribe);
      }
      agent.underground = Boolean(agent.task && agent.task.kind === "delve");
      agent.status = this.describeAgentStatus(agent, localWeather);
      if (agent.task) {
        this.processTask(agent, tribe);
      }
    }

    this.removeDeadAgents();
  }

  private removeDeadAgents(): void {
    let removedAny = false;
    for (let i = this.agents.length - 1; i >= 0; i -= 1) {
      if (this.agents[i]!.health > 0) {
        continue;
      }
      const agent = this.agents[i]!;
      const tribe = this.tribes[agent.tribeId];
      this.jobs.forEach((job) => {
        if (job.claimedBy === agent.id) {
          job.claimedBy = null;
        }
      });
      this.agents.splice(i, 1);
      removedAny = true;
      if (tribe?.rulerAgentId === agent.id) {
        tribe.rulerAgentId = null;
        tribe.morale = Math.max(20, tribe.morale - 8);
        this.pushEvent({
          kind: "ruler-death",
          title: `${agent.name} of ${tribe.name} has fallen`,
          description: `${agent.name}, ruler of ${tribe.name}, is dead and the tribe is choosing a successor.`,
          x: agent.x,
          y: agent.y,
          tribeId: tribe.id,
        });
        this.ensureRuler(tribe);
      }
    }
    if (removedAny) {
      this.invalidateSummaryCaches();
    }
  }

  private describeAgentStatus(agent: AgentState, weather: WeatherKind): string {
    if (agent.health < 30) return "Near death";
    if (agent.wounds >= 3) return "Badly wounded";
    if (agent.condition === AgentConditionType.Feverish) return "Burning with fever";
    if (agent.condition === AgentConditionType.Sick) return "Sickly";
    if (agent.condition === AgentConditionType.Exhausted) return "Spent and exhausted";
    if (agent.condition === AgentConditionType.Weary) return "Travel-worn";
    if (agent.condition === AgentConditionType.Cold) return "Shivering";
    if (agent.condition === AgentConditionType.Hungry) return "Hungry";
    if (agent.condition === AgentConditionType.Inspired && (!agent.task || agent.task.kind === "idle")) return "Inspired";
    if (weather === WeatherKind.Blizzard) return "Sheltering from blizzard";
    if (weather === WeatherKind.AshStorm) return "Crossing ash storm";
    if (!agent.task || agent.task.kind === "idle") return "Idle patrol";
    if (agent.task.kind === "recover") return "Recovering";
    if (agent.task.kind === "build") return "Building";
    if (agent.task.kind === "earthwork") return "Digging earthworks";
    if (agent.task.kind === "haul") return `Hauling ${ResourceType[agent.task.payload.resourceType]}`;
    if (agent.task.kind === "craft") return agent.role === AgentRole.Scholar ? "Researching" : "Crafting";
    if (agent.task.kind === "attack") return agent.role === AgentRole.Mage ? "Casting into battle" : "Fighting";
    if (agent.task.kind === "patrol") return "Patrolling";
    if (agent.task.kind === "hunt") return "Hunting";
    if (agent.task.kind === "farm") return "Working the fields";
    if (agent.task.kind === "dungeon") return "Exploring ruins";
    if (agent.task.kind === "delve") return "Working the deep tunnels";
    if (agent.task.kind === "tame_horse" || agent.task.kind === "tame_livestock") return "Herding";
    if (agent.task.kind === "cut_tree") return "Cutting timber";
    if (agent.task.kind === "mine" || agent.task.kind === "quarry") return "Digging";
    if (agent.task.kind === "fish") return "Fishing";
    return "Working";
  }

  private maybePromoteHero(tribe: TribeState): void {
    if (tribe.age < AgeType.Iron) return;
    const heroes = this.agentsForTribe(tribe.id).filter((agent) => agent.hero);
    const maxHeroes = tribe.age >= AgeType.Medieval ? 2 : 1;
    if (heroes.length >= maxHeroes) return;

    const candidate = this.agents
      .filter((agent) => agent.tribeId === tribe.id && !agent.hero && (agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider || agent.role === AgentRole.Mage))
      .sort((a, b) => b.level - a.level || b.kills - a.kills || b.health - a.health)[0];
    if (!candidate) return;
    if (candidate.level < 2 && this.populationOf(tribe.id) < 26) return;

    candidate.hero = true;
    candidate.level = Math.max(candidate.level, 3);
    candidate.health = Math.min(100, candidate.health + 20);
    candidate.gear = improveGear(improveGear(candidate.gear, "Heroic"), tribe.race.type === RaceType.Darkfolk || tribe.race.type === RaceType.Elves ? "Ancient" : "Royal");
    candidate.title = titleForAgent(candidate, tribe.race.type);
    this.pushEvent({
      kind: "hero-rise",
      title: `${candidate.name} rises in ${tribe.name}`,
      description: `${candidate.name} has become a ${candidate.title || "hero"} of ${tribe.name}.`,
      x: candidate.x,
      y: candidate.y,
      tribeId: tribe.id,
    });
    this.ensureRuler(tribe);
  }

  private ensureRuler(tribe: TribeState): void {
    const current = tribe.rulerAgentId !== null ? this.agents.find((agent) => agent.id === tribe.rulerAgentId) : null;
    if (current) {
      return;
    }
    const candidate = [...this.agentsForTribe(tribe.id)]
      .sort((a, b) =>
        Number(b.hero || b.blessed) - Number(a.hero || a.blessed) ||
        b.level - a.level ||
        b.kills - a.kills ||
        b.ageTicks - a.ageTicks,
      )[0];
    if (!candidate) {
      tribe.rulerAgentId = null;
      return;
    }
    tribe.rulerAgentId = candidate.id;
    tribe.successionCount += 1;
    if (!candidate.hero) {
      candidate.hero = true;
      candidate.level = Math.max(candidate.level, 3);
      candidate.health = Math.min(100, candidate.health + 10);
      candidate.gear = improveGear(candidate.gear, tribe.race.type === RaceType.Darkfolk || tribe.race.type === RaceType.Elves ? "Crowned" : "Royal");
      candidate.title = titleForAgent(candidate, tribe.race.type);
    }
    if (tribe.successionCount > 1) {
      tribe.morale = Math.max(18, tribe.morale - 8);
      tribe.faith = Math.max(0, tribe.faith - 12);
    }
    const rulerTitle = this.rulerTitleForTribe(tribe);
    this.pushEvent({
      kind: tribe.successionCount > 1 ? "succession" : "coronation",
      title: `${candidate.name} becomes ${rulerTitle} of ${tribe.name}`,
      description: `${candidate.name} now leads ${tribe.name} as ${rulerTitle}.`,
      x: candidate.x,
      y: candidate.y,
      tribeId: tribe.id,
    });
  }

  private rulerTitleForTribe(tribe: TribeState): string {
    return tribe.race.type === RaceType.Dwarves ? "High Thane"
      : tribe.race.type === RaceType.Elves ? "Star Regent"
      : tribe.race.type === RaceType.Darkfolk ? "Night Regent"
      : tribe.race.type === RaceType.Orcs ? "War King"
      : tribe.race.type === RaceType.Goblins ? "Boss King"
      : tribe.race.type === RaceType.Halflings ? "Hearthlord"
      : tribe.race.type === RaceType.Nomads ? "Steppe Khan"
      : "King";
  }

  private needsRecovery(agent: AgentState): boolean {
    return agent.health <= 58 || agent.wounds >= 2 || agent.sickness >= 54 || agent.fatigue >= 82;
  }

  private deriveCondition(agent: AgentState): AgentConditionType {
    if (agent.sickness >= 72) return AgentConditionType.Feverish;
    if (agent.sickness >= 44) return AgentConditionType.Sick;
    if (agent.fatigue >= 82) return AgentConditionType.Exhausted;
    if (agent.fatigue >= 56) return AgentConditionType.Weary;
    if (agent.warmth < 28) return AgentConditionType.Cold;
    if (agent.hunger > 72) return AgentConditionType.Hungry;
    if (agent.inspiration >= 48) return AgentConditionType.Inspired;
    return AgentConditionType.Steady;
  }

  private taskWorkRate(agent: AgentState, tribe: TribeState): number {
    let rate = 1;
    if (agent.condition === AgentConditionType.Inspired) rate += 0.28;
    if (agent.condition === AgentConditionType.Weary) rate -= 0.18;
    if (agent.condition === AgentConditionType.Exhausted) rate -= 0.35;
    if (agent.condition === AgentConditionType.Sick) rate -= 0.22;
    if (agent.condition === AgentConditionType.Feverish) rate -= 0.38;
    if (agent.hero) rate += 0.08;
    if (agent.role === AgentRole.Builder || agent.role === AgentRole.Miner || agent.role === AgentRole.Woodcutter || agent.role === AgentRole.Crafter || agent.role === AgentRole.Farmer) {
      rate += this.toolWorkBonusForTribe(tribe);
    }
    rate += tribe.race.buildBias * 0.04;
    return clamp(rate, 0.45, 1.5);
  }

  private toolWorkBonusForTribe(tribe: TribeState): number {
    if (tribe.resources[ResourceType.IronTools] > 0) return 0.22;
    if (tribe.resources[ResourceType.BronzeTools] > 0) return 0.14;
    if (tribe.resources[ResourceType.StoneTools] > 0) return 0.07;
    return -0.18;
  }

  private consumeToolDurability(tribe: TribeState, kind: AgentTask["kind"]): void {
    const chance =
      kind === "build" || kind === "earthwork" || kind === "craft" ? 0.38
      : kind === "mine" || kind === "quarry" ? 0.34
      : kind === "cut_tree" ? 0.28
      : kind === "gather" || kind === "hunt" || kind === "fish" || kind === "replant_tree" ? 0.18
      : 0;
    if (chance <= 0 || this.random() > chance) {
      return;
    }
    if (tribe.resources[ResourceType.IronTools] > 0) {
      tribe.resources[ResourceType.IronTools] -= 1;
      return;
    }
    if (tribe.resources[ResourceType.BronzeTools] > 0) {
      tribe.resources[ResourceType.BronzeTools] -= 1;
      return;
    }
    if (tribe.resources[ResourceType.StoneTools] > 0) {
      tribe.resources[ResourceType.StoneTools] -= 1;
    }
  }

  private conditionCountsForTribe(tribeId: number): { sick: number; exhausted: number; inspired: number } {
    let sick = 0;
    let exhausted = 0;
    let inspired = 0;
    for (const agent of this.agentsForTribe(tribeId)) {
      if (agent.condition === AgentConditionType.Sick || agent.condition === AgentConditionType.Feverish) sick += 1;
      if (agent.condition === AgentConditionType.Exhausted) exhausted += 1;
      if (agent.condition === AgentConditionType.Inspired) inspired += 1;
    }
    return { sick, exhausted, inspired };
  }

  private claimTask(agent: AgentState, tribe: TribeState): AgentTask | null {
    const recoverySite = this.findRecoverySite(tribe, agent);
    if (recoverySite) {
      agent.path = findPath(this.world, agent.x, agent.y, recoverySite.x, recoverySite.y);
      agent.pathIndex = 0;
      return {
        kind: "recover",
        targetX: recoverySite.x,
        targetY: recoverySite.y,
        workLeft: 16,
      };
    }

    const jobs = this.jobs
      .filter((job) => job.tribeId === tribe.id && job.claimedBy === null)
      .sort((a, b) => {
        const urgencyA = this.jobUrgencyScore(agent, tribe, a);
        const urgencyB = this.jobUrgencyScore(agent, tribe, b);
        const distanceA = manhattan(agent.x, agent.y, a.x, a.y);
        const distanceB = manhattan(agent.x, agent.y, b.x, b.y);
        return urgencyB - urgencyA || b.priority - a.priority || distanceA - distanceB;
      });

    for (const job of jobs) {
      if (!this.roleMatches(agent.role, job.kind)) {
        continue;
      }
      if (job.kind === "build" && (job.payload as BuildPayload).supplied < (job.payload as BuildPayload).supplyNeeded) {
        continue;
      }
      if (job.kind === "craft" && (job.payload as CraftPayload).supplied < (job.payload as CraftPayload).supplyNeeded) {
        continue;
      }
      const path = findPath(this.world, agent.x, agent.y, job.x, job.y);
      if (agent.x !== job.x || agent.y !== job.y) {
        const unreachable = path.length === 0 || (path.length === 1 && path[0] === indexOf(agent.x, agent.y, this.world.width));
        if (unreachable) {
          continue;
        }
      }
      job.claimedBy = agent.id;
      agent.path = path;
      agent.pathIndex = 0;
      switch (job.kind) {
        case "haul":
          return {
            kind: "haul",
            targetX: job.x,
            targetY: job.y,
            stage: "toSource",
            payload: job.payload as HaulPayload,
          };
        case "build":
          return {
            kind: "build",
            targetX: job.x,
            targetY: job.y,
            workLeft: buildingWorkTicks((job.payload as BuildPayload).buildingType),
            payload: job.payload as BuildPayload,
          };
        case "earthwork":
          return {
            kind: "earthwork",
            targetX: job.x,
            targetY: job.y,
            workLeft: 8,
            payload: job.payload as EarthworkPayload,
          };
        case "craft":
          return {
            kind: "craft",
            targetX: job.x,
            targetY: job.y,
            workLeft: 10,
            payload: job.payload as CraftPayload,
          };
        case "attack":
        case "patrol":
          return {
            kind: job.kind,
            targetX: job.x,
            targetY: job.y,
            workLeft: 10,
            payload: job.payload as AttackPayload,
          };
        default:
          {
            const resourcePayload = job.payload as ResourceJobPayload | undefined;
          return {
            kind: job.kind,
            targetX: job.x,
            targetY: job.y,
            stage: "toTarget",
            resourceType: resourcePayload?.resourceType ?? this.resourceForJob(job.kind),
            amount: 0,
          };
          }
      }
    }

    const idleX = clamp(tribe.capitalX + randInt(this.random, -5, 5), 1, this.world.width - 2);
    const idleY = clamp(tribe.capitalY + randInt(this.random, -5, 5), 1, this.world.height - 2);
    agent.path = findPath(this.world, agent.x, agent.y, idleX, idleY);
    agent.pathIndex = 0;
    return {
      kind: "idle",
      targetX: idleX,
      targetY: idleY,
      workLeft: randInt(this.random, 4, 12),
    };
  }

  private jobUrgencyScore(agent: AgentState, tribe: TribeState, job: JobState): number {
    const population = this.populationOf(tribe.id);
    const foodNeed = population * (tribe.age >= AgeType.Bronze ? 6 : 5);
    const lowFood = tribe.resources[ResourceType.Rations] < foodNeed * 1.15;
    const lowWater = tribe.water < Math.max(16, population * 0.55);
    const lowWood = tribe.resources[ResourceType.Wood] < 52;
    const lowStone = tribe.resources[ResourceType.Stone] < 24;
    const missingBootstrap =
      !this.hasBuilt(tribe.id, BuildingType.Farm)
      || !this.hasBuilt(tribe.id, BuildingType.LumberCamp)
      || !this.hasBuilt(tribe.id, BuildingType.Cistern)
      || (!this.hasBuilt(tribe.id, BuildingType.Quarry) && tribe.resources[ResourceType.Stone] < 36);

    let score = job.priority * 10;

    if (job.kind === "gather" || job.kind === "farm" || job.kind === "hunt" || job.kind === "fish") {
      score += lowFood ? 80 : 12;
    }
    if (job.kind === "cut_tree") {
      score += lowWood ? 72 : 10;
    }
    if (job.kind === "quarry") {
      score += missingBootstrap || lowStone ? 68 : 8;
    }
    if (job.kind === "mine") {
      score += missingBootstrap ? -30 : lowStone ? 6 : 12;
    }
    if (job.kind === "earthwork") {
      score += missingBootstrap ? -80 : 0;
    }
    if (job.kind === "craft") {
      score += missingBootstrap ? -36 : 6;
      const payload = job.payload as CraftPayload;
      if (payload.output === ResourceType.StoneTools || payload.output === ResourceType.BronzeTools || payload.output === ResourceType.IronTools || payload.output === ResourceType.Rations) {
        score += 24;
      }
    }
    if (job.kind === "build") {
      const payload = job.payload as BuildPayload;
      const type = payload.buildingType;
      if (type === BuildingType.Farm) score += lowFood || !this.hasBuilt(tribe.id, BuildingType.Farm) ? 88 : 12;
      if (type === BuildingType.Cistern) score += lowWater || !this.hasBuilt(tribe.id, BuildingType.Cistern) ? 92 : 10;
      if (type === BuildingType.LumberCamp) score += lowWood || !this.hasBuilt(tribe.id, BuildingType.LumberCamp) ? 88 : 8;
      if (type === BuildingType.Stockpile) score += !this.hasBuilt(tribe.id, BuildingType.Stockpile) ? 78 : 6;
      if (type === BuildingType.Quarry) score += lowStone || !this.hasBuilt(tribe.id, BuildingType.Quarry) ? 82 : 5;
      if (type === BuildingType.House) score += this.computeHousing(tribe.id) < population + 2 ? 44 : 4;
      if (type === BuildingType.Warehouse) score += missingBootstrap ? -20 : 18;
      if (type === BuildingType.Shrine || type === BuildingType.Tavern || type === BuildingType.Watchtower) score += missingBootstrap ? -44 : 0;
      if (type === BuildingType.Barracks || type === BuildingType.Armory || type === BuildingType.Castle) score += missingBootstrap ? -56 : 0;
    }
    if (job.kind === "haul") {
      const payload = job.payload as HaulPayload;
      const targetJob = this.jobs.find((entry) => entry.id === payload.targetJobId);
      if (targetJob) {
        score += this.jobUrgencyScore(agent, tribe, targetJob) * 0.7;
      } else {
        score += 8;
      }
    }

    if ((agent.role === AgentRole.Builder || agent.role === AgentRole.Hauler) && missingBootstrap) {
      score += 8;
    }

    return score;
  }

  private roleMatches(role: AgentRole, kind: JobKind): boolean {
    if (kind === "build") return role === AgentRole.Builder || role === AgentRole.Worker;
    if (kind === "earthwork") return role === AgentRole.Builder || role === AgentRole.Worker;
    if (kind === "haul") return role === AgentRole.Hauler || role === AgentRole.Worker;
    if (kind === "craft") return role === AgentRole.Crafter || role === AgentRole.Scholar || role === AgentRole.Worker || role === AgentRole.Builder;
    if (kind === "attack" || kind === "patrol") return role === AgentRole.Soldier || role === AgentRole.Rider || role === AgentRole.Mage;
    if (kind === "dungeon") return role === AgentRole.Soldier || role === AgentRole.Rider || role === AgentRole.Mage;
    if (kind === "delve") return role === AgentRole.Miner || role === AgentRole.Soldier || role === AgentRole.Mage || role === AgentRole.Scholar || role === AgentRole.Worker;
    if (kind === "fish") return role === AgentRole.Fisher || role === AgentRole.Worker;
    if (kind === "mine" || kind === "quarry") return role === AgentRole.Miner || role === AgentRole.Worker;
    if (kind === "cut_tree") return role === AgentRole.Woodcutter || role === AgentRole.Worker;
    if (kind === "replant_tree") return role === AgentRole.Farmer || role === AgentRole.Worker;
    if (kind === "farm") return role === AgentRole.Farmer || role === AgentRole.Worker;
    if (kind === "gather" || kind === "hunt" || kind === "tame_horse" || kind === "tame_livestock") return role !== AgentRole.Soldier;
    return true;
  }

  private resourceForJob(kind: JobKind): ResourceType {
    switch (kind) {
      case "cut_tree":
        return ResourceType.Wood;
      case "quarry":
        return ResourceType.Stone;
      case "mine":
        return ResourceType.Ore;
      case "farm":
        return ResourceType.Grain;
      case "fish":
        return ResourceType.Fish;
      case "hunt":
        return ResourceType.Meat;
      case "tame_horse":
        return ResourceType.Horses;
      case "tame_livestock":
        return ResourceType.Livestock;
      case "dungeon":
        return ResourceType.MetalWeapons;
      case "delve":
        return ResourceType.Ore;
      case "replant_tree":
        return ResourceType.Wood;
      default:
        return ResourceType.Berries;
    }
  }

  private processTask(agent: AgentState, tribe: TribeState): void {
    const task = agent.task!;
    const atTarget = agent.x === task.targetX && agent.y === task.targetY;
    const workRate = this.taskWorkRate(agent, tribe);

    if ((task.kind === "gather" || task.kind === "farm" || task.kind === "cut_tree" || task.kind === "quarry" || task.kind === "mine" || task.kind === "fish" || task.kind === "hunt" || task.kind === "tame_horse" || task.kind === "tame_livestock" || task.kind === "replant_tree" || task.kind === "dungeon" || task.kind === "delve")) {
      if (task.stage === "toTarget" && !atTarget) {
        return;
      }
      if (task.stage === "toTarget") {
        const gathered = this.performResourceTask(tribe, agent, task);
        if (!gathered) {
          this.finishTask(agent);
          return;
        }
        const storageSite = this.findResourceDropSite(tribe.id, agent.x, agent.y, task.resourceType);
        task.stage = "return";
        task.targetX = storageSite.x;
        task.targetY = storageSite.y;
        agent.path = findPath(this.world, agent.x, agent.y, task.targetX, task.targetY);
        agent.pathIndex = 0;
        return;
      }

      if (!atTarget) {
        return;
      }

      const dropBuilding = this.findResourceDropBuilding(tribe.id, agent.x, agent.y, agent.carrying);
      this.addBuildingStock(dropBuilding, agent.carrying, agent.carryingAmount);
      tribe.resources[agent.carrying] += agent.carryingAmount;
      if (agent.carrying === ResourceType.Fish || agent.carrying === ResourceType.Berries || agent.carrying === ResourceType.Meat || agent.carrying === ResourceType.Grain) {
        tribe.resources[ResourceType.Rations] += Math.ceil(agent.carryingAmount * 0.45);
      }
      this.consumeToolDurability(tribe, task.kind);
      agent.carrying = ResourceType.None;
      agent.carryingAmount = 0;
      this.finishTask(agent);
      return;
    }

    if (task.kind === "haul") {
      if (task.stage === "toSource" && !atTarget) {
        return;
      }
      if (task.stage === "toSource") {
        const sourceBuilding = task.payload.sourceBuildingId != null
          ? this.buildings.find((entry) => entry.id === task.payload.sourceBuildingId) ?? null
          : this.findStockedSourceBuilding(tribe.id, task.payload.sourceX, task.payload.sourceY, task.payload.resourceType);
        const withdrawn = this.withdrawBuildingStock(sourceBuilding, task.payload.resourceType, task.payload.amount);
        agent.carrying = task.payload.resourceType;
        agent.carryingAmount = withdrawn > 0 ? withdrawn : task.payload.amount;
        task.stage = "toDrop";
        task.targetX = task.payload.dropX;
        task.targetY = task.payload.dropY;
        agent.path = findPath(this.world, agent.x, agent.y, task.targetX, task.targetY);
        agent.pathIndex = 0;
        return;
      }
      if (!atTarget) {
        return;
      }
      const buildJob = this.jobs.find((job) => job.id === task.payload.targetJobId && (job.kind === "build" || job.kind === "craft"));
      if (buildJob?.kind === "build") {
        const payload = buildJob.payload as BuildPayload;
        payload.supplied += 1;
      } else if (buildJob?.kind === "craft") {
        const payload = buildJob.payload as CraftPayload;
        payload.supplied += 1;
      }
      agent.carrying = ResourceType.None;
      agent.carryingAmount = 0;
      this.finishTask(agent);
      return;
    }

    if (task.kind === "build") {
      if (!atTarget) {
        return;
      }
      task.workLeft -= workRate + tribe.race.buildBias * 0.3;
      if (task.workLeft <= 0) {
        this.completeBuildingTask(tribe, task.payload, task.targetX, task.targetY);
        this.consumeToolDurability(tribe, task.kind);
        this.finishTask(agent);
      }
      return;
    }

    if (task.kind === "earthwork") {
      if (!atTarget) {
        return;
      }
      task.workLeft -= workRate + tribe.race.buildBias * 0.25;
      if (task.workLeft <= 0) {
        this.completeEarthworkTask(tribe, task.payload, task.targetX, task.targetY);
        this.consumeToolDurability(tribe, task.kind);
        this.finishTask(agent);
      }
      return;
    }

    if (task.kind === "craft") {
      if (!atTarget) {
        return;
      }
      task.workLeft -= workRate;
      if (task.workLeft <= 0) {
        this.completeCraftTask(tribe, task.payload);
        this.consumeToolDurability(tribe, task.kind);
        this.finishTask(agent);
      }
      return;
    }

    if (task.kind === "recover") {
      if (!atTarget) {
        return;
      }
      const atInfirmary = this.buildingsForTribe(tribe.id).some((building) =>
        (building.type === BuildingType.Infirmary || building.type === BuildingType.Castle || building.type === BuildingType.CapitalHall) &&
        task.targetX >= building.x &&
        task.targetX < building.x + building.width &&
        task.targetY >= building.y &&
        task.targetY < building.y + building.height,
      );
      agent.health = Math.min(100, agent.health + (atInfirmary ? 1.9 : 1.1));
      agent.fatigue = Math.max(0, agent.fatigue - (atInfirmary ? 1.5 : 1));
      agent.sickness = Math.max(0, agent.sickness - (atInfirmary ? 1.2 : 0.6));
      agent.inspiration = Math.min(100, agent.inspiration + (atInfirmary ? 0.25 : 0.12));
      if (agent.wounds > 0 && this.tickCount % (atInfirmary ? 4 : 8) === 0) {
        agent.wounds -= 1;
      }
      task.workLeft -= 0.8 + workRate * 0.45;
      if ((agent.health >= 92 && agent.wounds === 0 && agent.sickness < 28 && agent.fatigue < 36) || task.workLeft <= 0) {
        this.finishTask(agent);
      }
      return;
    }

    if (task.kind === "attack" || task.kind === "patrol") {
      if ((task.kind === "attack" && (agent.health < 52 || agent.wounds > 2 || tribe.morale < 40)) || (task.kind === "patrol" && agent.health < 40)) {
        this.finishTask(agent);
        return;
      }
      if (!atTarget) {
        return;
      }
      const friendlyStrength = this.agents.filter((entry) => entry.tribeId === tribe.id && manhattan(entry.x, entry.y, task.targetX, task.targetY) <= 3).length;
      const enemyStrength = this.agents.filter((entry) => entry.tribeId === task.payload.targetTribeId && manhattan(entry.x, entry.y, task.targetX, task.targetY) <= 3).length;
      const targetTribe = this.tribes[task.payload.targetTribeId];
      if (task.kind === "patrol" && targetTribe && !tribe.discovered[targetTribe.id] && manhattan(agent.x, agent.y, targetTribe.capitalX, targetTribe.capitalY) <= this.contactRadiusForTribe(tribe) + 10) {
        this.markDiscovery(tribe, targetTribe);
      }
      if (task.kind === "attack" && enemyStrength > friendlyStrength * 1.5 && agent.health < 72) {
        this.finishTask(agent);
        return;
      }
      task.workLeft -= workRate;
      if (task.kind === "attack") {
        this.resolveAttack(tribe, task.payload.targetTribeId, task.targetX, task.targetY);
      }
      if (task.workLeft <= 0) {
        this.finishTask(agent);
      }
      return;
    }

    if (task.kind === "idle") {
      if (!atTarget) {
        return;
      }
      task.workLeft -= 1;
      if (task.workLeft <= 0) {
        this.finishTask(agent);
      }
    }
  }

  private finishTask(agent: AgentState): void {
    const job = this.jobs.find((entry) => entry.claimedBy === agent.id);
    if (job) {
      this.jobs.splice(this.jobs.indexOf(job), 1);
    }
    agent.task = null;
    agent.path = [];
    agent.pathIndex = 0;
    agent.underground = false;
  }

  private findRecoverySite(tribe: TribeState, agent: AgentState): { x: number; y: number } | null {
    if (!this.needsRecovery(agent)) {
      return null;
    }
    const candidates = this.buildingsForTribe(tribe.id)
      .filter((building) =>
        (
          building.type === BuildingType.Infirmary ||
          building.type === BuildingType.Castle ||
          building.type === BuildingType.CapitalHall ||
          (agent.fatigue >= 72 && building.type === BuildingType.Tavern) ||
          (agent.sickness >= 50 && building.type === BuildingType.Shrine)
        ),
      )
      .sort((a, b) => manhattan(agent.x, agent.y, a.x, a.y) - manhattan(agent.x, agent.y, b.x, b.y));
    const site = candidates[0];
    return site ? buildingCenter(site) : { x: tribe.capitalX, y: tribe.capitalY };
  }

  private storageAffinityScore(tribeId: number, building: BuildingState, resourceType: ResourceType): number {
    const center = buildingCenter(building);
    let score = building.type === BuildingType.Warehouse ? 26 : building.type === BuildingType.Stockpile ? 18 : 10;
    if (resourceType === ResourceType.None) {
      return score;
    }

    if (resourceType === ResourceType.Rations || resourceType === ResourceType.Grain || resourceType === ResourceType.Berries || resourceType === ResourceType.Fish || resourceType === ResourceType.Meat) {
      score += this.nearbyBuildingCount(tribeId, BuildingType.Farm, center.x, center.y, 10) * 6;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Orchard, center.x, center.y, 10) * 5;
      score += this.nearbyBuildingCount(tribeId, BuildingType.FishingHut, center.x, center.y, 12) * 5;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Fishery, center.x, center.y, 12) * 6;
      score += this.nearbyBuildingCount(tribeId, BuildingType.House, center.x, center.y, 10) * 2;
      return score;
    }

    if (resourceType === ResourceType.Wood || resourceType === ResourceType.Planks || resourceType === ResourceType.Charcoal) {
      score += this.nearbyBuildingCount(tribeId, BuildingType.LumberCamp, center.x, center.y, 12) * 7;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Workshop, center.x, center.y, 10) * 6;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Foundry, center.x, center.y, 10) * 5;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Factory, center.x, center.y, 10) * 6;
      return score;
    }

    if (resourceType === ResourceType.Stone || resourceType === ResourceType.Clay || resourceType === ResourceType.Ore || resourceType === ResourceType.Bricks) {
      score += this.nearbyBuildingCount(tribeId, BuildingType.Quarry, center.x, center.y, 12) * 7;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Mine, center.x, center.y, 12) * 7;
      score += this.nearbyBuildingCount(tribeId, BuildingType.DeepMine, center.x, center.y, 12) * 8;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Foundry, center.x, center.y, 10) * 5;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Factory, center.x, center.y, 10) * 6;
      return score;
    }

    if (
      resourceType === ResourceType.StoneTools
      || resourceType === ResourceType.BronzeTools
      || resourceType === ResourceType.IronTools
      || resourceType === ResourceType.BasicWeapons
      || resourceType === ResourceType.MetalWeapons
      || resourceType === ResourceType.BasicArmor
      || resourceType === ResourceType.MetalArmor
    ) {
      score += this.nearbyBuildingCount(tribeId, BuildingType.Workshop, center.x, center.y, 10) * 4;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Smithy, center.x, center.y, 10) * 7;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Armory, center.x, center.y, 10) * 8;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Barracks, center.x, center.y, 10) * 5;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Factory, center.x, center.y, 10) * 6;
      return score;
    }

    if (resourceType === ResourceType.Horses || resourceType === ResourceType.Livestock || resourceType === ResourceType.Hides) {
      score += this.nearbyBuildingCount(tribeId, BuildingType.Stable, center.x, center.y, 12) * 8;
      score += this.nearbyBuildingCount(tribeId, BuildingType.Farm, center.x, center.y, 12) * 4;
      return score;
    }

    return score;
  }

  private findNearestStorageSite(tribeId: number, originX: number, originY: number, resourceType: ResourceType = ResourceType.None): { x: number; y: number } {
    const candidates = this.buildingsForTribe(tribeId)
      .filter((building) =>
        (building.type === BuildingType.Warehouse || building.type === BuildingType.Stockpile || building.type === BuildingType.CapitalHall),
      )
      .sort((a, b) => {
        const centerA = buildingCenter(a);
        const centerB = buildingCenter(b);
        const scoreA = this.storageAffinityScore(tribeId, a, resourceType) - manhattan(originX, originY, centerA.x, centerA.y) * 1.4;
        const scoreB = this.storageAffinityScore(tribeId, b, resourceType) - manhattan(originX, originY, centerB.x, centerB.y) * 1.4;
        return scoreB - scoreA;
      });
    const site = candidates[0];
    return site ? buildingCenter(site) : { x: this.tribes[tribeId]!.capitalX, y: this.tribes[tribeId]!.capitalY };
  }

  private findResourceDropSite(tribeId: number, originX: number, originY: number, resourceType: ResourceType): { x: number; y: number } {
    const preferredTypes =
      resourceType === ResourceType.Wood
        ? [BuildingType.LumberCamp, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
        : resourceType === ResourceType.Stone || resourceType === ResourceType.Clay
          ? [BuildingType.Quarry, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
          : resourceType === ResourceType.Ore
            ? [BuildingType.DeepMine, BuildingType.Mine, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
            : resourceType === ResourceType.Fish
              ? [BuildingType.Fishery, BuildingType.FishingHut, BuildingType.Dock, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
              : resourceType === ResourceType.Berries || resourceType === ResourceType.Grain || resourceType === ResourceType.Meat || resourceType === ResourceType.Rations
                ? [BuildingType.Farm, BuildingType.Orchard, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
                : resourceType === ResourceType.Horses || resourceType === ResourceType.Livestock || resourceType === ResourceType.Hides
                  ? [BuildingType.Stable, BuildingType.Farm, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
                  : [BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall];
    const candidates = this.buildingsForTribe(tribeId)
      .filter((building) => preferredTypes.includes(building.type))
      .sort((a, b) => {
        const centerA = buildingCenter(a);
        const centerB = buildingCenter(b);
        const typeBiasA = Math.max(0, 10 - preferredTypes.indexOf(a.type) * 2);
        const typeBiasB = Math.max(0, 10 - preferredTypes.indexOf(b.type) * 2);
        return (
          (typeBiasB * 8 - manhattan(originX, originY, centerB.x, centerB.y) * 1.35)
          - (typeBiasA * 8 - manhattan(originX, originY, centerA.x, centerA.y) * 1.35)
        );
      });
    const site = candidates[0];
    return site ? buildingCenter(site) : this.findNearestStorageSite(tribeId, originX, originY, resourceType);
  }

  private findResourceDropBuilding(tribeId: number, originX: number, originY: number, resourceType: ResourceType): BuildingState | null {
    const preferredTypes = this.sourceBuildingTypesForResource(resourceType);
    const candidates = this.buildingsForTribe(tribeId)
      .filter((building) => preferredTypes.includes(building.type))
      .sort((a, b) => {
        const centerA = buildingCenter(a);
        const centerB = buildingCenter(b);
        const typeBiasA = Math.max(0, 10 - preferredTypes.indexOf(a.type) * 2);
        const typeBiasB = Math.max(0, 10 - preferredTypes.indexOf(b.type) * 2);
        return (
          (typeBiasB * 8 - manhattan(originX, originY, centerB.x, centerB.y) * 1.35)
          - (typeBiasA * 8 - manhattan(originX, originY, centerA.x, centerA.y) * 1.35)
        );
      });
    return candidates[0] ?? null;
  }

  private addBuildingStock(building: BuildingState | null, resourceType: ResourceType, amount: number): void {
    if (!building || resourceType === ResourceType.None || amount <= 0) {
      return;
    }
    building.stock[resourceType] = (building.stock[resourceType] ?? 0) + amount;
  }

  private topStoredResource(building: BuildingState): { resourceType: ResourceType; amount: number } {
    let bestType = ResourceType.None;
    let bestAmount = 0;
    for (let resource = 0; resource < building.stock.length; resource += 1) {
      const amount = building.stock[resource] ?? 0;
      if (amount > bestAmount) {
        bestAmount = amount;
        bestType = resource as ResourceType;
      }
    }
    return { resourceType: bestType, amount: bestAmount };
  }

  private sourceBuildingTypesForResource(resourceType: ResourceType): BuildingType[] {
    return resourceType === ResourceType.Wood || resourceType === ResourceType.Planks || resourceType === ResourceType.Charcoal
      ? [BuildingType.LumberCamp, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
      : resourceType === ResourceType.Stone || resourceType === ResourceType.Clay || resourceType === ResourceType.Bricks
        ? [BuildingType.Quarry, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
        : resourceType === ResourceType.Ore
          ? [BuildingType.DeepMine, BuildingType.Mine, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
          : resourceType === ResourceType.Fish
            ? [BuildingType.Fishery, BuildingType.FishingHut, BuildingType.Dock, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
            : resourceType === ResourceType.Berries || resourceType === ResourceType.Grain || resourceType === ResourceType.Meat || resourceType === ResourceType.Rations
              ? [BuildingType.Farm, BuildingType.Orchard, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
              : resourceType === ResourceType.Horses || resourceType === ResourceType.Livestock || resourceType === ResourceType.Hides
                ? [BuildingType.Stable, BuildingType.Farm, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
                : [BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall];
  }

  private findStockedSourceBuilding(tribeId: number, originX: number, originY: number, resourceType: ResourceType): BuildingState | null {
    const preferredTypes = this.sourceBuildingTypesForResource(resourceType);
    const candidates = this.buildingsForTribe(tribeId)
      .filter((building) => preferredTypes.includes(building.type))
      .sort((a, b) => {
        const centerA = buildingCenter(a);
        const centerB = buildingCenter(b);
        const stockA = a.stock[resourceType] ?? 0;
        const stockB = b.stock[resourceType] ?? 0;
        const typeBiasA = Math.max(0, 10 - preferredTypes.indexOf(a.type) * 2);
        const typeBiasB = Math.max(0, 10 - preferredTypes.indexOf(b.type) * 2);
        return (
          (stockB * 0.45 + typeBiasB * 6 - manhattan(originX, originY, centerB.x, centerB.y) * 1.2)
          - (stockA * 0.45 + typeBiasA * 6 - manhattan(originX, originY, centerA.x, centerA.y) * 1.2)
        );
      });
    return candidates[0] ?? null;
  }

  private withdrawBuildingStock(building: BuildingState | null, resourceType: ResourceType, amount: number): number {
    if (!building || resourceType === ResourceType.None || amount <= 0) {
      return 0;
    }
    const available = building.stock[resourceType] ?? 0;
    const withdrawn = Math.min(available, amount);
    if (withdrawn > 0) {
      building.stock[resourceType] = available - withdrawn;
    }
    return withdrawn;
  }

  private performResourceTask(
    tribe: TribeState,
    agent: AgentState,
    task: Extract<AgentTask, { kind: "gather" | "farm" | "cut_tree" | "quarry" | "mine" | "fish" | "hunt" | "tame_horse" | "tame_livestock" | "replant_tree" | "dungeon" | "delve" }>,
  ): boolean {
    const targetIndex = indexOf(task.targetX, task.targetY, this.world.width);
    if (task.kind === "replant_tree") {
      if (this.world.feature[targetIndex] === FeatureType.None && this.world.terrain[targetIndex] === TerrainType.ForestFloor) {
        this.world.feature[targetIndex] = FeatureType.Trees;
        this.world.resourceType[targetIndex] = ResourceType.Wood;
        this.world.resourceAmount[targetIndex] = 100;
        this.markDirty(targetIndex);
      }
      agent.carrying = ResourceType.None;
      agent.carryingAmount = 0;
      return true;
    }

      if (task.kind === "hunt") {
      const animal = this.animals.find((entry) => entry.x === task.targetX && entry.y === task.targetY);
      if (!animal) {
        return false;
      }
      tribe.resources[ResourceType.Hides] += 1;
      agent.carrying = ResourceType.Meat;
      agent.carryingAmount = animal.type === AnimalType.Boar ? 7 : animal.type === AnimalType.Goat ? 4 : 5;
      agent.level = clamp(agent.level + 1, 1, 9);
      agent.title = titleForAgent(agent, tribe.race.type);
      this.animals.splice(this.animals.indexOf(animal), 1);
      return true;
    }

    if (task.kind === "tame_horse") {
      const animal = this.animals.find((entry) => entry.x === task.targetX && entry.y === task.targetY && entry.type === AnimalType.Horse);
      if (!animal) {
        return false;
      }
      this.animals.splice(this.animals.indexOf(animal), 1);
      agent.carrying = ResourceType.Horses;
      agent.carryingAmount = 1;
      return true;
    }

    if (task.kind === "tame_livestock") {
      const animal = this.animals.find((entry) =>
        entry.x === task.targetX &&
        entry.y === task.targetY &&
        (entry.type === AnimalType.Sheep || entry.type === AnimalType.Goat),
      );
      if (!animal) {
        return false;
      }
      this.animals.splice(this.animals.indexOf(animal), 1);
      agent.carrying = ResourceType.Livestock;
      agent.carryingAmount = 1;
      return true;
    }

    if (task.kind === "dungeon") {
      const dungeon = this.dungeons.find((entry) => entry.x === task.targetX && entry.y === task.targetY);
      if (!dungeon) {
        return false;
      }
      dungeon.exploredBy = tribe.id;
      agent.gear = improveGear(agent.gear, dungeon.type === DungeonType.DeepDelve ? "Relic" : "Dungeon");
      agent.level = clamp(agent.level + dungeon.lootTier, 1, 9);
      agent.title = titleForAgent(agent, tribe.race.type);
      tribe.resources[ResourceType.BasicWeapons] += dungeon.lootTier;
      tribe.resources[ResourceType.BasicArmor] += Math.max(1, dungeon.lootTier - 1);
      if (dungeon.lootTier >= 3) {
        tribe.resources[ResourceType.MetalWeapons] += 1;
      }
      agent.carrying = ResourceType.BasicWeapons;
      agent.carryingAmount = dungeon.lootTier;
      this.pushEvent({
        kind: "dungeon-loot",
        title: `${agent.name} returned from ${dungeon.name}`,
        description: `${agent.name} explored ${dungeon.name} and brought back better gear.`,
        x: dungeon.x,
        y: dungeon.y,
        tribeId: tribe.id,
      });
      return true;
    }

    if (task.kind === "delve") {
      const site = this.buildingsForTribe(tribe.id).find((building) =>
        (building.type === BuildingType.TunnelEntrance || building.type === BuildingType.DeepMine) &&
        task.targetX >= building.x &&
        task.targetX < building.x + building.width &&
        task.targetY >= building.y &&
        task.targetY < building.y + building.height,
      );
      if (!site) {
        return false;
      }

      const deepSite = site.type === BuildingType.DeepMine;
      const hazardRoll = this.random();
      const risk = Math.max(0.03, (deepSite ? 0.2 : 0.12) - tribe.race.buildBias * 0.025 - (agent.role === AgentRole.Mage ? 0.015 : 0) - (agent.hero ? 0.035 : 0));
      if (hazardRoll < risk) {
        const collapsed = this.applyDamage(agent, deepSite ? 28 : 18);
        tribe.resources[ResourceType.Stone] += deepSite ? 1 : 0;
        this.pushEvent({
          kind: "cave-in",
          title: `${agent.name} is caught in a collapse`,
          description: `${agent.name} of ${tribe.name} was hit by a cave-in while working ${deepSite ? "a deep mine" : "the tunnel works"}.`,
          x: site.x,
          y: site.y,
          tribeId: tribe.id,
        });
        return !collapsed;
      }

      if (hazardRoll < risk + (deepSite ? 0.08 : 0.06)) {
        this.applyDamage(agent, deepSite ? 14 : 10);
        agent.wounds = clamp(agent.wounds + 1, 0, 5);
        tribe.resources[ResourceType.Ore] += deepSite ? 1 : 0;
        this.pushEvent({
          kind: "underbeast",
          title: `${tribe.name} fights beneath the earth`,
          description: `${agent.name} ran into hostile things in the dark and staggered back with wounds.`,
          x: site.x,
          y: site.y,
          tribeId: tribe.id,
        });
      }

      const relicRoll = this.random();
      if (relicRoll > 0.9) {
        agent.gear = improveGear(agent.gear, deepSite ? "Delver" : "Tunnel");
        agent.level = clamp(agent.level + (deepSite ? 2 : 1), 1, 9);
        agent.title = titleForAgent(agent, tribe.race.type);
        tribe.resources[ResourceType.MetalWeapons] += deepSite ? 1 : 0;
        tribe.resources[ResourceType.BasicArmor] += 1;
        tribe.research += deepSite ? 10 : 6;
        if (tribe.race.type === RaceType.Elves || tribe.race.type === RaceType.Darkfolk) {
          tribe.faith += 3;
        }
        agent.carrying = deepSite ? ResourceType.MetalWeapons : ResourceType.BasicArmor;
        agent.carryingAmount = 1;
        this.pushEvent({
          kind: "delve-find",
          title: `${agent.name} returns with a deep relic`,
          description: `${agent.name} found ancient craft beneath ${tribe.name} and returned with prized gear.`,
          x: site.x,
          y: site.y,
          tribeId: tribe.id,
        });
        return true;
      }

      const excavation = this.excavateUnderground(site, tribe, agent);
      tribe.research += (deepSite ? 3.5 : 2) + (agent.role === AgentRole.Scholar ? 1.5 : 0);
      if ((tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Darkfolk) && this.random() > 0.78) {
        tribe.resources[ResourceType.Clay] += 1;
      }
      agent.carrying = excavation?.resourceType ?? (deepSite || this.random() > 0.45 ? ResourceType.Ore : ResourceType.Stone);
      agent.carryingAmount = excavation?.amount ?? (agent.carrying === ResourceType.Ore ? randInt(this.random, 5, 10) : randInt(this.random, 2, 5));
      if (deepSite && this.random() > 0.7) {
        tribe.resources[ResourceType.Stone] += 1;
      }
      return true;
    }

    if (task.kind === "farm") {
      const site = this.buildings.find((building) =>
        building.tribeId === tribe.id &&
        (building.type === BuildingType.Farm || building.type === BuildingType.Orchard) &&
        task.targetX >= building.x &&
        task.targetX < building.x + building.width &&
        task.targetY >= building.y &&
        task.targetY < building.y + building.height,
      );
      if (!site) {
        return false;
      }
      let nearbyPlots = 0;
      for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const x = task.targetX + dx;
          const y = task.targetY + dy;
          if (!inBounds(x, y, this.world.width, this.world.height)) continue;
          const index = indexOf(x, y, this.world.width);
          if (this.world.terrain[index] === TerrainType.Farmland) {
            nearbyPlots += 1;
          }
        }
      }
      const waterSupport = Math.floor(this.surfaceWaterFarmSupportForTribe(tribe.id) * 0.45);
      const flooded = this.floodedFarmCountForTribe(tribe.id);
      const orchard = site.type === BuildingType.Orchard;
      let harvest = orchard ? 4 : 6;
      harvest += Math.min(4, Math.floor(nearbyPlots / 10));
      harvest += waterSupport;
      if (this.season === SeasonType.Winter) {
        harvest = orchard ? 1 : Math.max(2, harvest - 3);
      }
      if (flooded > 0) {
        harvest = Math.max(1, harvest - Math.min(3, flooded));
      }
      const efficiency =
        agent.condition === AgentConditionType.Inspired ? 1.2
        : agent.condition === AgentConditionType.Exhausted ? 0.72
        : agent.condition === AgentConditionType.Feverish ? 0.6
        : agent.condition === AgentConditionType.Sick ? 0.78
        : agent.condition === AgentConditionType.Weary ? 0.88
        : 1;
      harvest = Math.max(1, Math.floor(harvest * efficiency));
      tribe.research += this.researchFromFieldWork("gather", tribe) * 0.8;
      agent.carrying = orchard ? ResourceType.Berries : ResourceType.Grain;
      agent.carryingAmount = harvest;
      return true;
    }

    const available = this.world.resourceAmount[targetIndex];
    if (available <= 0 && task.kind !== "fish") {
      return false;
    }

    let harvest = 0;
    switch (task.kind) {
      case "cut_tree":
        harvest = Math.min(12, available);
        break;
      case "quarry":
        harvest = Math.min(10, available);
        break;
      case "mine":
        harvest = Math.min(9, available);
        break;
      case "fish":
        harvest = 8;
        break;
      default:
        harvest = Math.min(7, available);
    }
    const efficiency =
      agent.condition === AgentConditionType.Inspired ? 1.2
      : agent.condition === AgentConditionType.Exhausted ? 0.72
      : agent.condition === AgentConditionType.Feverish ? 0.6
      : agent.condition === AgentConditionType.Sick ? 0.78
      : agent.condition === AgentConditionType.Weary ? 0.88
      : 1;
    harvest = Math.max(1, Math.floor(harvest * efficiency));

    if (task.kind !== "fish") {
      this.world.resourceAmount[targetIndex] = Math.max(0, available - harvest);
      if (this.world.resourceAmount[targetIndex] === 0) {
        this.world.feature[targetIndex] = FeatureType.None;
        this.world.resourceType[targetIndex] = ResourceType.None;
        if (this.world.terrain[targetIndex] === TerrainType.ForestFloor) {
          this.world.terrain[targetIndex] = TerrainType.Grass;
        }
      }
      this.markDirty(targetIndex);
    }

    tribe.research += this.researchFromFieldWork(task.kind, tribe);
    agent.carrying = task.resourceType;
    agent.carryingAmount = harvest;
    return true;
  }

  private completeBuildingTask(tribe: TribeState, payload: BuildPayload, x: number, y: number): void {
    this.placeBuilding(tribe.id, payload.buildingType, x, y);
    tribe.research += this.researchFromConstruction(payload.buildingType);
    this.pushEvent({
      kind: "construction",
      title: `${tribe.name} built ${BuildingType[payload.buildingType]}`,
      description: `${tribe.name} completed a ${BuildingType[payload.buildingType]} near its territory.`,
      x,
      y,
      tribeId: tribe.id,
    });
  }

  private completeEarthworkTask(tribe: TribeState, payload: EarthworkPayload, x: number, y: number): void {
    if (!inBounds(x, y, this.world.width, this.world.height)) {
      return;
    }
    const index = indexOf(x, y, this.world.width);
    if (this.world.buildingByTile[index] >= 0) {
      return;
    }
    const terrain = this.world.terrain[index];
    if (terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow || terrain === TerrainType.River || terrain === TerrainType.Lava || terrain === TerrainType.Mountain) {
      return;
    }

    if (payload.kind === "trench") {
      this.world.feature[index] = FeatureType.Trench;
      this.addSurfaceWater(index, hasAdjacentWater(this.world, x, y, 3) ? 18 : 6);
    } else if (payload.kind === "canal") {
      this.world.feature[index] = FeatureType.IrrigationCanal;
      this.world.moisture[index] = clamp(this.world.moisture[index]! + 20, 0, 255);
      this.world.fertility[index] = clamp(this.world.fertility[index]! + 16, 0, 255);
      this.addSurfaceWater(index, hasAdjacentWater(this.world, x, y, 8) ? 40 : 18);
      for (const [dx, dy] of CARDINALS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, this.world.width, this.world.height)) continue;
        const nearIndex = indexOf(nx, ny, this.world.width);
        this.world.moisture[nearIndex] = clamp(this.world.moisture[nearIndex]! + 8, 0, 255);
        this.world.fertility[nearIndex] = clamp(this.world.fertility[nearIndex]! + 6, 0, 255);
        if (this.world.terrain[nearIndex] === TerrainType.Farmland || this.world.terrain[nearIndex] === TerrainType.Grass) {
          this.addSurfaceWater(nearIndex, 10);
        }
      }
    } else if (payload.kind === "palisade") {
      this.world.feature[index] = FeatureType.Palisade;
    } else if (payload.kind === "gate") {
      this.world.feature[index] = FeatureType.Gate;
      this.world.road[index] = Math.max(this.world.road[index]!, 1);
    } else if (payload.kind === "stone_wall") {
      this.world.feature[index] = FeatureType.StoneWall;
    }

    this.markDirty(index);
    if (this.tickCount % 18 === 0) {
      const label =
        payload.kind === "trench" ? "trenches" :
        payload.kind === "canal" ? "canals" :
        payload.kind === "palisade" ? "palisades" :
        payload.kind === "gate" ? "gates" : "stone walls";
      this.pushEvent({
        kind: "earthwork",
        title: `${tribe.name} builds ${label}`,
        description: `${tribe.name} is improving its land with ${label}.`,
        x,
        y,
        tribeId: tribe.id,
      });
    }
  }

  private completeCraftTask(tribe: TribeState, payload: CraftPayload): void {
    const building = this.buildings.find((entry) => entry.id === payload.buildingId);
    const poweredIndustry = this.buildingCount(tribe.id, BuildingType.PowerPlant) > 0 && (building?.type === BuildingType.Factory || building?.type === BuildingType.Foundry || building?.type === BuildingType.Armory);
    const directModernSite = building?.type === BuildingType.PowerPlant ? 1.35 : building?.type === BuildingType.Airfield ? 1.15 : poweredIndustry ? 1.2 : 1;
    const craftedAmount = Math.max(1, Math.floor(payload.amount * directModernSite));
    tribe.resources[payload.output] += craftedAmount;
    this.addBuildingStock(building ?? null, payload.output, craftedAmount);
  }

  private applyDamage(target: AgentState, amount: number): boolean {
    target.health -= amount;
    if (amount >= 8 && this.random() > 0.55) {
      target.wounds = clamp(target.wounds + 1, 0, 5);
    }
    return target.health <= 0;
  }

  private rewardCombatExperience(agents: AgentState[], tribe: TribeState, amount: number): void {
    for (const agent of agents) {
      agent.level = clamp(agent.level + amount, 1, 9);
      if (agent.level >= 3 || agent.hero) {
        agent.gear = improveGear(agent.gear, tribe.race.type === RaceType.Dwarves ? "Forged" : "Battle");
      }
      agent.title = titleForAgent(agent, tribe.race.type);
    }
  }

  private resolveAttack(attackingTribe: TribeState, targetTribeId: number, targetX: number, targetY: number): void {
    const enemy = this.tribes[targetTribeId];
    if (!enemy) return;
    const nearbyAttackers = this.agents.filter((agent) => agent.tribeId === attackingTribe.id && manhattan(agent.x, agent.y, targetX, targetY) <= 3);
    const riderBonus = nearbyAttackers.filter((agent) => agent.role === AgentRole.Rider).length * 2.5;
    const mageAttackers = nearbyAttackers.filter((agent) => agent.role === AgentRole.Mage);
    const heroBonus = nearbyAttackers.filter((agent) => agent.hero).length * 3;
    const gearBonus = attackingTribe.resources[ResourceType.MetalWeapons] > 0 ? 3 : attackingTribe.resources[ResourceType.BasicWeapons] > 0 ? 1.5 : 0;
    const sanctumBonus = this.buildingCount(attackingTribe.id, BuildingType.ArcaneSanctum);
    const magicBonus = mageAttackers.length > 0 ? 4 + mageAttackers.length * 2 + sanctumBonus * 3 : 0;
    const siegeBonus = attackingTribe.age >= AgeType.Medieval
      ? this.buildingCount(attackingTribe.id, BuildingType.Workshop) * 0.6 + this.siegeEngines.filter((engine) => engine.tribeId === attackingTribe.id && manhattan(engine.x, engine.y, targetX, targetY) <= 10).length * 4
      : 0;
    const defenseBonus = this.earthworkDefenseBonus(targetX, targetY);
    const damage = 4 + attackingTribe.race.militaryBias * 2 + riderBonus + heroBonus + gearBonus + magicBonus + siegeBonus;

    const targetBuilding = this.buildings.find((building) => building.tribeId === targetTribeId && manhattan(building.x, building.y, targetX, targetY) <= 2);
    if (targetBuilding) {
      targetBuilding.hp -= damage;
      if (targetBuilding.hp <= 0) {
        this.removeBuilding(targetBuilding);
      }
      if (siegeBonus > 0 && this.tickCount % 20 === 0) {
        this.pushEvent({
          kind: "siege-barrage",
          title: `${attackingTribe.name} bombards ${enemy.name}`,
          description: `${attackingTribe.name} is using siege engines against ${enemy.name}.`,
          x: targetBuilding.x,
          y: targetBuilding.y,
          tribeId: attackingTribe.id,
        });
      }
    }

    const defenders = this.agents.filter((agent) => agent.tribeId === targetTribeId && manhattan(agent.x, agent.y, targetX, targetY) <= 2);
    if (defenders.length > 0) {
      const victim = chooseOne(this.random, defenders);
      const killed = this.applyDamage(victim, Math.max(2, 10 + attackingTribe.race.militaryBias * 4 + riderBonus + gearBonus + magicBonus + heroBonus - defenseBonus));
      if (killed) {
        for (const attacker of nearbyAttackers) {
          attacker.kills += 1;
        }
        this.rewardCombatExperience(nearbyAttackers, attackingTribe, 1);
      }
    }
    if (mageAttackers.length > 0 && defenders.length > 1) {
      for (const mage of mageAttackers) {
        if (mage.spellCooldown > 0) continue;
        mage.spellCooldown = SIM_TICKS_PER_SECOND * 6;
        const splash = defenders.filter((agent) => agent.health > 0).slice(0, 2);
        for (const defender of splash) {
          const killed = this.applyDamage(defender, 8 + attackingTribe.age * 2);
          if (killed) {
            mage.kills += 1;
            mage.level = clamp(mage.level + 1, 1, 9);
          }
        }
        if (this.tickCount % 18 === 0) {
          this.pushEvent({
            kind: "battle-magic",
            title: `${attackingTribe.name} casts battle magic`,
            description: `${attackingTribe.name} unleashed spellfire against ${enemy.name}.`,
            x: targetX,
            y: targetY,
            tribeId: attackingTribe.id,
          });
        }
      }
      const canMeteor = this.hasBuilt(attackingTribe.id, BuildingType.MageTower) && mageAttackers.some((mage) => mage.hero || mage.level >= 5);
      if (canMeteor && this.tickCount % 20 === 0) {
        for (const defender of defenders.slice(0, 4)) {
          this.applyDamage(defender, 10 + attackingTribe.age * 3);
        }
        if (targetBuilding) {
          targetBuilding.hp -= 16;
          if (targetBuilding.hp <= 0) {
            this.removeBuilding(targetBuilding);
          }
        }
        this.pushEvent({
          kind: "meteor",
          title: `${attackingTribe.name} calls down a meteor`,
          description: `${attackingTribe.name} shattered part of ${enemy.name}'s line with high magic.`,
          x: targetX,
          y: targetY,
          tribeId: attackingTribe.id,
        });
      }
      const canCataclysm = this.hasBuilt(attackingTribe.id, BuildingType.ArcaneSanctum) && mageAttackers.some((mage) => mage.hero || mage.level >= 7 || mage.blessed);
      if (canCataclysm && this.tickCount % 28 === 0) {
        for (const defender of defenders.slice(0, 6)) {
          this.applyDamage(defender, 12 + attackingTribe.age * 3 + sanctumBonus * 2);
        }
        if (targetBuilding) {
          targetBuilding.hp -= 24 + sanctumBonus * 4;
          if (targetBuilding.hp <= 0) {
            this.removeBuilding(targetBuilding);
          }
        }
        this.pushEvent({
          kind: "arcane-cataclysm",
          title: `${attackingTribe.name} tears open an arcane storm`,
          description: `${attackingTribe.name} unleashed a sanctum-backed cataclysm against ${enemy.name}.`,
          x: targetX,
          y: targetY,
          tribeId: attackingTribe.id,
        });
      }
    }
    attackingTribe.relations[targetTribeId] = Math.min(attackingTribe.relations[targetTribeId]!, -80);
    enemy.relations[attackingTribe.id] = Math.min(enemy.relations[attackingTribe.id]!, -80);
    if (this.tickCount % 15 === 0) {
      this.pushEvent({
        kind: "battle",
        title: `${attackingTribe.name} raids ${enemy.name}`,
        description: `${attackingTribe.name} is attacking the territory of ${enemy.name}.`,
        x: targetX,
        y: targetY,
        tribeId: attackingTribe.id,
      });
    }
  }

  private removeBuilding(building: BuildingState): void {
    if (building.type === BuildingType.Stable) {
      this.tribes[building.tribeId]!.stableCount = Math.max(0, this.tribes[building.tribeId]!.stableCount - 1);
    }
    for (let dy = 0; dy < building.height; dy += 1) {
      for (let dx = 0; dx < building.width; dx += 1) {
        const tx = building.x + dx;
        const ty = building.y + dy;
        if (!inBounds(tx, ty, this.world.width, this.world.height)) continue;
        const index = indexOf(tx, ty, this.world.width);
        this.world.buildingByTile[index] = -1;
        if (this.world.terrain[index] === TerrainType.Farmland) {
          this.world.terrain[index] = TerrainType.Grass;
        }
        this.markDirty(index);
      }
    }
    this.buildings.splice(this.buildings.indexOf(building), 1);
    this.invalidateSummaryCaches();
  }

  private earthworkDefenseBonus(x: number, y: number): number {
    let bonus = 0;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, this.world.width, this.world.height)) continue;
        const feature = this.world.feature[indexOf(nx, ny, this.world.width)];
        if (feature === FeatureType.Trench) bonus += 0.7;
        if (feature === FeatureType.Palisade) bonus += 1.1;
        if (feature === FeatureType.Gate) bonus += 0.4;
        if (feature === FeatureType.StoneWall) bonus += 1.8;
      }
    }
    return bonus;
  }

  private consumeAndGrow(): void {
    for (const tribe of this.tribes) {
      const tribeAgents = this.agentsForTribe(tribe.id);
      const population = tribeAgents.length;
      const housing = this.computeHousing(tribe.id);
      const weather = this.weatherAt(tribe.capitalX, tribe.capitalY);
      const floodedBuildings = this.floodedBuildingCountForTribe(tribe.id);
      const powerPlants = this.buildingCount(tribe.id, BuildingType.PowerPlant);
      const airfields = this.buildingCount(tribe.id, BuildingType.Airfield);
      if (this.tickCount % (SIM_TICKS_PER_SECOND * 6) === 0) {
        const waterCapacity = this.waterCapacityForTribe(tribe.id, population);
        const waterFill = this.waterIncomeForTribe(tribe.id, weather);
        const waterUse = this.waterDemandForTribe(tribe.id, population, weather);
        const wasDry = tribe.water < Math.max(10, population * 0.45);
        tribe.water = clamp(tribe.water + waterFill - waterUse, 0, waterCapacity);
        const isDry = tribe.water < Math.max(10, population * 0.45);
        const waterFactor = tribe.water <= Math.max(8, population * 0.35) ? 0.8 : tribe.water >= Math.max(18, population * 1.1) ? 1.08 : 1;
        const horseBonus = Math.min(this.buildingCount(tribe.id, BuildingType.Farm), tribe.resources[ResourceType.Horses]) * 0.5;
        const irrigationBonus = this.irrigationBonusForTribe(tribe.id);
        const runoffBonus = this.surfaceWaterFarmSupportForTribe(tribe.id);
        const floodedFields = this.floodedFarmCountForTribe(tribe.id);
        const cisternBonus = this.cisternBonusForTribe(tribe.id);
        const weatherFactor = weather === WeatherKind.Heatwave ? 0.6 : weather === WeatherKind.Rain ? 1.15 : weather === WeatherKind.Blizzard ? 0.7 : weather === WeatherKind.Storm ? 0.85 : 1;
        const passiveFood = Math.floor((this.buildingCount(tribe.id, BuildingType.Farm) * (this.season === SeasonType.Winter ? 1 : 2) * tribe.race.foodBias * weatherFactor + horseBonus + irrigationBonus + runoffBonus + cisternBonus + powerPlants * 0.6 - floodedFields * 1.4) * waterFactor);
        const orchardFood = Math.floor((this.buildingCount(tribe.id, BuildingType.Orchard) * (this.season === SeasonType.Winter ? 0 : 1.5) + runoffBonus * 0.35 - floodedFields * 0.4) * waterFactor);
        const herdFood = Math.floor(tribe.resources[ResourceType.Livestock] * 0.3);
        const fishingFood = Math.floor(this.buildingCount(tribe.id, BuildingType.FishingHut) * 2 + this.buildingCount(tribe.id, BuildingType.Fishery) * 3 + this.boats.filter((boat) => boat.tribeId === tribe.id).length + airfields * 0.5);
        const rationGain = passiveFood + orchardFood + herdFood + fishingFood;
        if (rationGain > 0) {
          tribe.resources[ResourceType.Grain] += passiveFood;
          tribe.resources[ResourceType.Rations] += rationGain;
        }
        if (this.buildingCount(tribe.id, BuildingType.Stable) > 0 && tribe.resources[ResourceType.Horses] > 0 && this.tickCount % (YEAR_TICKS / 3) === 0) {
          tribe.resources[ResourceType.Horses] += Math.max(1, Math.floor(this.buildingCount(tribe.id, BuildingType.Stable) / 2));
        }
        if (tribe.resources[ResourceType.Livestock] > 0 && this.tickCount % (YEAR_TICKS / 4) === 0) {
          tribe.resources[ResourceType.Livestock] += Math.max(1, Math.floor(this.buildingCount(tribe.id, BuildingType.Farm) / 3));
        }
        if (isDry && this.tickCount % (SIM_TICKS_PER_SECOND * 18) === 0) {
          this.pushEvent({
            kind: "water-shortage",
            title: `${tribe.name} is short on water`,
            description: `${tribe.name} is straining its cisterns and canals to keep farms and homes supplied.`,
            x: tribe.capitalX,
            y: tribe.capitalY,
            tribeId: tribe.id,
          });
        } else if (wasDry && !isDry && (weather === WeatherKind.Rain || weather === WeatherKind.Storm || weather === WeatherKind.Blizzard)) {
          this.pushEvent({
            kind: "water-relief",
            title: `${tribe.name} refills its stores`,
            description: `${tribe.name} replenished its water reserves with fresh weather, runoff, and managed waterworks.`,
            x: tribe.capitalX,
            y: tribe.capitalY,
            tribeId: tribe.id,
          });
        }
        if (floodedBuildings >= Math.max(2, Math.floor(population * 0.05)) && this.tickCount % (SIM_TICKS_PER_SECOND * 18) === 0) {
          this.pushEvent({
            kind: "flood",
            title: `${tribe.name} is taking flood damage`,
            description: `${tribe.name} is dealing with runoff and flooded structures after heavy weather.`,
            x: tribe.capitalX,
            y: tribe.capitalY,
            tribeId: tribe.id,
          });
        }
      }

      if (this.tickCount % (SIM_TICKS_PER_SECOND * 10) === 0) {
        tribe.faith += this.buildingCount(tribe.id, BuildingType.Shrine) * 3 + this.buildingCount(tribe.id, BuildingType.Castle) + (tribe.race.type === RaceType.Elves || tribe.race.type === RaceType.Darkfolk ? this.buildingCount(tribe.id, BuildingType.MageTower) + this.buildingCount(tribe.id, BuildingType.ArcaneSanctum) * 2 : 0);
      }

      const fertilityRate = tribe.race.type === RaceType.Orcs ? 1.2 : tribe.race.type === RaceType.Halflings ? 1.1 : 1;
      if (
        this.tickCount % Math.max(320, Math.floor((YEAR_TICKS / 2.6) / fertilityRate)) === 0
        && population + 1 < housing
        && population < MAX_AGENTS_PER_TRIBE
        && tribe.resources[ResourceType.Rations] > population * 5.2
        && tribe.water > Math.max(14, population * 0.55)
        && tribe.morale > 58
      ) {
        this.spawnAgent(tribe.id, tribe.capitalX + randInt(this.random, -2, 2), tribe.capitalY + randInt(this.random, -2, 2));
        tribe.resources[ResourceType.Rations] -= 14;
      }

      if (tribe.resources[ResourceType.Rations] <= 0 && this.tickCount % (SIM_TICKS_PER_SECOND * 8) === 0) {
        const victim = this.agents.find((agent) => agent.tribeId === tribe.id);
        if (victim) {
          this.applyDamage(victim, 12);
          this.pushEvent({
            kind: "famine",
            title: `${tribe.name} faces famine`,
            description: `${tribe.name} is starving and losing people to hunger.`,
            x: tribe.capitalX,
            y: tribe.capitalY,
            tribeId: tribe.id,
          });
        }
      }
      if (tribe.water <= 0 && this.tickCount % (SIM_TICKS_PER_SECOND * 10) === 0) {
        const victim = this.agents.find((agent) => agent.tribeId === tribe.id);
        if (victim) {
          this.applyDamage(victim, 10);
          this.pushEvent({
            kind: "thirst",
            title: `${tribe.name} suffers thirst`,
            description: `${tribe.name} has exhausted its water stores and people are weakening.`,
            x: tribe.capitalX,
            y: tribe.capitalY,
            tribeId: tribe.id,
          });
        }
      }

      const conditionCounts = this.conditionCountsForTribe(tribe.id);
      tribe.morale = clamp(
        65 +
          (tribe.resources[ResourceType.Rations] > population * 4 ? 10 : -12) +
          (tribe.water > population ? 6 : tribe.water > Math.max(8, population * 0.4) ? 1 : -10) +
          (housing >= population ? 8 : -8) +
          (tribe.tributeTo !== null ? -6 : 0) +
          this.tributaryCount(tribe.id) * 1.6 +
          powerPlants * 1.2 +
          airfields * 0.8 +
          this.buildingCount(tribe.id, BuildingType.Cistern) * (weather === WeatherKind.Heatwave ? 3 : 1) +
          this.buildingCount(tribe.id, BuildingType.Tavern) * 3 +
          this.buildingCount(tribe.id, BuildingType.Shrine) * 2 +
          this.buildingCount(tribe.id, BuildingType.Infirmary) * 2 +
          tribeAgents.filter((agent) => agent.hero).length * 2 -
          tribeAgents.filter((agent) => agent.wounds > 0).length * 0.4 +
          floodedBuildings * -0.8 +
          conditionCounts.inspired * 0.25 -
          conditionCounts.sick * 0.5 -
          conditionCounts.exhausted * 0.35 +
          tribe.race.personality.diplomacy * 4 -
          this.meanHostility(tribe) * 0.08,
        15,
        98,
      );

      if (conditionCounts.sick >= Math.max(4, Math.floor(population * 0.18)) && this.tickCount % (SIM_TICKS_PER_SECOND * 20) === 0) {
        this.pushEvent({
          kind: "fever",
          title: `Fever spreads through ${tribe.name}`,
          description: `${tribe.name} is struggling with sickness, and healers are under pressure.`,
          x: tribe.capitalX,
          y: tribe.capitalY,
          tribeId: tribe.id,
        });
      }
      if (conditionCounts.exhausted >= Math.max(5, Math.floor(population * 0.22)) && this.tickCount % (SIM_TICKS_PER_SECOND * 24) === 0) {
        this.pushEvent({
          kind: "fatigue",
          title: `${tribe.name} is worn thin`,
          description: `${tribe.name} is showing signs of exhaustion from labor, weather, and war.`,
          x: tribe.capitalX,
          y: tribe.capitalY,
          tribeId: tribe.id,
        });
      }

      if (this.tickCount % (YEAR_TICKS / 3) === 0) {
        this.maybePromoteHero(tribe);
        this.maybeGrantBlessing(tribe);
      }
      this.maybeTriggerUnrest(tribe);
    }
  }

  private maybeGrantBlessing(tribe: TribeState): void {
    const shrines = this.buildingCount(tribe.id, BuildingType.Shrine);
    if (shrines <= 0 || tribe.faith < 50) return;
    const candidate = this.agents
      .filter((agent) => agent.tribeId === tribe.id && !agent.blessed && (agent.hero || agent.level >= 3 || agent.role === AgentRole.Mage || agent.role === AgentRole.Scholar))
      .sort((a, b) => Number(b.hero) - Number(a.hero) || b.level - a.level || b.kills - a.kills)[0];
    if (!candidate) return;
    candidate.blessed = true;
    candidate.hero = true;
    candidate.level = clamp(candidate.level + 1, 1, 9);
    candidate.health = Math.min(100, candidate.health + 16);
    candidate.gear = improveGear(improveGear(candidate.gear, "Blessed"), tribe.race.type === RaceType.Darkfolk ? "Night" : "Dawn");
    candidate.title = titleForAgent(candidate, tribe.race.type);
    tribe.faith = Math.max(0, tribe.faith - 50);
    this.pushEvent({
      kind: "blessing",
      title: `${candidate.name} is blessed in ${tribe.name}`,
      description: `${candidate.name} has been anointed as a blessed champion of ${tribe.name}.`,
      x: candidate.x,
      y: candidate.y,
      tribeId: tribe.id,
    });
  }

  private maybeTriggerUnrest(tribe: TribeState): void {
    if (this.tickCount % (SIM_TICKS_PER_SECOND * 22) !== 0) {
      return;
    }
    const population = this.populationOf(tribe.id);
    const wounded = this.agentsForTribe(tribe.id).filter((agent) => agent.wounds > 0).length;
    const instability =
      (tribe.morale < 34 ? 0.16 : tribe.morale < 44 ? 0.08 : 0)
      + (tribe.tributeTo !== null ? 0.08 : 0)
      + Math.max(0, tribe.successionCount - 1) * 0.015
      + wounded * 0.004
      + (tribe.resources[ResourceType.Rations] < population * 2.2 ? 0.06 : 0)
      + (tribe.water < Math.max(8, population * 0.35) ? 0.05 : 0);
    if (instability < 0.1 || this.random() > instability) {
      return;
    }

    const victims = this.agents
      .filter((agent) => agent.tribeId === tribe.id)
      .sort((a, b) => b.level - a.level)
      .slice(0, 3);
    for (const agent of victims) {
      agent.wounds = clamp(agent.wounds + 1, 0, 5);
      agent.health = Math.max(24, agent.health - randInt(this.random, 8, 18));
    }
    tribe.resources[ResourceType.Rations] = Math.max(0, tribe.resources[ResourceType.Rations] - randInt(this.random, 18, 42));
    tribe.resources[ResourceType.Wood] = Math.max(0, tribe.resources[ResourceType.Wood] - randInt(this.random, 8, 20));
    tribe.resources[ResourceType.Stone] = Math.max(0, tribe.resources[ResourceType.Stone] - randInt(this.random, 6, 16));
    tribe.morale = Math.max(12, tribe.morale - randInt(this.random, 10, 18));

    if (tribe.tributeTo !== null) {
      const overlord = this.tribes[tribe.tributeTo];
      if (overlord) {
        tribe.relations[overlord.id] = clamp(tribe.relations[overlord.id]! - 22, -100, 100);
        overlord.relations[tribe.id] = clamp(overlord.relations[tribe.id]! - 12, -100, 100);
      }
      tribe.tributeTo = null;
    }

    this.pushEvent({
      kind: "rebellion",
      title: `${tribe.name} is shaken by rebellion`,
      description: `${tribe.name} is struggling with unrest after hardship, succession strain, and internal fighting.`,
      x: tribe.capitalX,
      y: tribe.capitalY,
      tribeId: tribe.id,
    });
  }

  private researchFromFieldWork(kind: AgentTask["kind"], tribe: TribeState): number {
    const primitiveBonus = tribe.age === AgeType.Primitive ? 0.16 : tribe.age === AgeType.Stone ? 0.08 : 0.03;
    if (kind === "quarry" || kind === "mine") return 0.22 + primitiveBonus;
    if (kind === "cut_tree" || kind === "replant_tree") return 0.18 + primitiveBonus;
    if (kind === "gather" || kind === "farm" || kind === "hunt" || kind === "fish") return 0.14 + primitiveBonus;
    if (kind === "tame_horse" || kind === "tame_livestock") return 0.12 + primitiveBonus * 0.5;
    return 0.1;
  }

  private researchFromConstruction(type: BuildingType): number {
    if (type === BuildingType.House) return 1.2;
    if (type === BuildingType.Stockpile || type === BuildingType.Cistern) return 2;
    if (type === BuildingType.Farm || type === BuildingType.LumberCamp || type === BuildingType.Quarry) return 3.2;
    if (type === BuildingType.Workshop || type === BuildingType.School || type === BuildingType.Mine) return 5;
    if (type === BuildingType.Smithy || type === BuildingType.Armory || type === BuildingType.Barracks) return 7;
    if (type === BuildingType.Castle || type === BuildingType.Foundry || type === BuildingType.Factory) return 11;
    if (type === BuildingType.PowerPlant || type === BuildingType.Airfield) return 16;
    return 2.4;
  }

  private canAdvanceToAge(tribe: TribeState, nextAge: AgeType, population: number): boolean {
    if (this.currentYear < AGE_YEAR_REQUIREMENTS[nextAge]!) {
      return false;
    }
    switch (nextAge) {
      case AgeType.Stone:
        return (
          population >= 18
          && this.hasBuilt(tribe.id, BuildingType.Farm)
          && this.hasBuilt(tribe.id, BuildingType.LumberCamp)
          && this.hasBuilt(tribe.id, BuildingType.Cistern)
          && (this.hasBuilt(tribe.id, BuildingType.Quarry) || tribe.resources[ResourceType.Stone] >= 36)
          && this.buildingsForTribe(tribe.id).filter((building) => building.type === BuildingType.House || building.type === BuildingType.MountainHall).length >= 5
          && tribe.resources[ResourceType.StoneTools] >= 6
          && tribe.resources[ResourceType.Rations] >= population * 2.8
          && tribe.water >= 8
        );
      case AgeType.Bronze:
        return (
          population >= 26
          && this.buildingCount(tribe.id, BuildingType.Farm) >= 2
          && this.hasBuilt(tribe.id, BuildingType.LumberCamp)
          && this.hasBuilt(tribe.id, BuildingType.Cistern)
          && this.hasBuilt(tribe.id, BuildingType.Workshop)
          && this.hasBuilt(tribe.id, BuildingType.Mine)
          && tribe.resources[ResourceType.StoneTools] >= 10
          && tribe.resources[ResourceType.Planks] >= 4
          && tribe.resources[ResourceType.Ore] >= 6
          && tribe.resources[ResourceType.Wood] >= 60
          && tribe.resources[ResourceType.Stone] >= 48
          && tribe.resources[ResourceType.Rations] >= population * 3.4
        );
      case AgeType.Iron:
        return (
          population >= 36
          && this.hasBuilt(tribe.id, BuildingType.Workshop)
          && this.hasBuilt(tribe.id, BuildingType.Mine)
          && this.hasBuilt(tribe.id, BuildingType.Warehouse)
          && this.hasBuilt(tribe.id, BuildingType.School)
          && tribe.resources[ResourceType.Ore] >= 24
          && tribe.resources[ResourceType.Planks] >= 10
        );
      case AgeType.Medieval:
        return (
          population >= 50
          && this.hasBuilt(tribe.id, BuildingType.Smithy)
          && this.hasBuilt(tribe.id, BuildingType.Armory)
          && this.hasBuilt(tribe.id, BuildingType.Barracks)
          && this.buildingCount(tribe.id, BuildingType.Warehouse) >= 1
          && tribe.resources[ResourceType.MetalWeapons] >= 14
          && tribe.resources[ResourceType.MetalArmor] >= 10
        );
      case AgeType.Gunpowder:
        return (
          population >= 68
          && this.hasBuilt(tribe.id, BuildingType.Castle)
          && this.hasBuilt(tribe.id, BuildingType.Stable)
          && (this.hasBuilt(tribe.id, BuildingType.Tavern) || this.hasBuilt(tribe.id, BuildingType.Shrine))
          && this.buildingCount(tribe.id, BuildingType.House) + this.buildingCount(tribe.id, BuildingType.MountainHall) >= 10
          && this.computeHousing(tribe.id) >= population
        );
      case AgeType.Industrial:
        return (
          population >= 84
          && this.hasBuilt(tribe.id, BuildingType.Foundry)
          && this.hasBuilt(tribe.id, BuildingType.School)
          && this.hasBuilt(tribe.id, BuildingType.Warehouse)
          && tribe.resources[ResourceType.Bricks] >= 30
          && tribe.resources[ResourceType.Charcoal] >= 22
          && tribe.resources[ResourceType.MetalWeapons] >= 22
        );
      case AgeType.Modern:
        return (
          population >= 104
          && this.hasBuilt(tribe.id, BuildingType.Factory)
          && this.hasBuilt(tribe.id, BuildingType.RailDepot)
          && this.hasBuilt(tribe.id, BuildingType.Foundry)
          && this.buildingCount(tribe.id, BuildingType.Warehouse) >= 2
          && tribe.resources[ResourceType.MetalArmor] >= 32
          && tribe.resources[ResourceType.Bricks] >= 40
        );
      default:
        return true;
    }
  }

  private progressResearch(): void {
    for (const tribe of this.tribes) {
      const tribeAgents = this.agentsForTribe(tribe.id);
      const pop = tribeAgents.length;
      const workshops = this.buildingCount(tribe.id, BuildingType.Workshop);
      const schools = this.buildingCount(tribe.id, BuildingType.School);
      const smithies = this.buildingCount(tribe.id, BuildingType.Smithy);
      const armories = this.buildingCount(tribe.id, BuildingType.Armory);
      const castles = this.buildingCount(tribe.id, BuildingType.Castle);
      const foundries = this.buildingCount(tribe.id, BuildingType.Foundry);
      const factories = this.buildingCount(tribe.id, BuildingType.Factory);
      const railDepots = this.buildingCount(tribe.id, BuildingType.RailDepot);
      const powerPlants = this.buildingCount(tribe.id, BuildingType.PowerPlant);
      const airfields = this.buildingCount(tribe.id, BuildingType.Airfield);
      const mageTowers = this.buildingCount(tribe.id, BuildingType.MageTower);
      const sanctums = this.buildingCount(tribe.id, BuildingType.ArcaneSanctum);
      const infirmaries = this.buildingCount(tribe.id, BuildingType.Infirmary);
      const mageBonus = tribeAgents.filter((agent) => agent.role === AgentRole.Mage).length * 0.18;
      const scholarBonus = tribeAgents.filter((agent) => agent.role === AgentRole.Scholar).length * 0.3;
      const heroBonus = tribeAgents.filter((agent) => agent.hero).length * 0.08;
      const tunnelEntrances = this.buildingCount(tribe.id, BuildingType.TunnelEntrance);
      const stableFood = tribe.resources[ResourceType.Rations] > pop * 3.2;
      const stableWater = tribe.water > Math.max(12, pop * 0.45);
      const stableHousing = this.computeHousing(tribe.id) >= pop;
      const stabilityFactor =
        (stableFood ? 1 : 0.72)
        * (stableWater ? 1 : 0.7)
        * (stableHousing ? 1 : 0.82)
        * clamp(tribe.morale / 70, 0.55, 1.3);
      const bootstrapPenalty = this.isBootstrapPhase(tribe) ? 0.5 : 1;
      const primitiveBootstrap = tribe.age === AgeType.Primitive
        ? (
          (this.hasBuilt(tribe.id, BuildingType.Farm) ? 0.05 : 0)
          + (this.hasBuilt(tribe.id, BuildingType.LumberCamp) ? 0.05 : 0)
          + (this.hasBuilt(tribe.id, BuildingType.Quarry) ? 0.04 : 0)
          + (this.hasBuilt(tribe.id, BuildingType.Cistern) ? 0.04 : 0)
        )
        : 0;
      const gain =
        (pop * 0.003
        + workshops * 0.1
        + schools * 0.22
        + smithies * 0.15
        + armories * 0.06
        + castles * 0.12
        + mageTowers * 0.28
        + sanctums * 0.42
        + infirmaries * 0.05
        + foundries * 0.24
        + factories * 0.36
        + railDepots * 0.14
        + powerPlants * 0.45
        + airfields * 0.22
        + tunnelEntrances * 0.08
        + mageBonus
        + scholarBonus
        + heroBonus
        + tribe.race.buildBias * 0.015
        + primitiveBootstrap)
        * stabilityFactor
        * bootstrapPenalty;
      tribe.research += Math.max(0.02, gain);
      const currentAgeIndex = tribe.age;
      if (
        currentAgeIndex < AgeType.Modern
        && tribe.research >= TECH_THRESHOLDS[currentAgeIndex + 1]!
        && this.canAdvanceToAge(tribe, currentAgeIndex + 1, pop)
      ) {
        tribe.age = currentAgeIndex + 1;
        this.assignRolesForTribe(tribe);
        this.pushEvent({
          kind: "age-advance",
          title: `${tribe.name} reaches ${AGE_NAMES[tribe.age]}`,
          description: `${tribe.name} has advanced into the ${AGE_NAMES[tribe.age]} age.`,
          x: tribe.capitalX,
          y: tribe.capitalY,
          tribeId: tribe.id,
        });
      }
    }
  }

  private runTribeStrategy(): void {
    const carriedJobs = this.jobs.filter((job) => this.shouldPersistJob(job));
    this.jobs.length = 0;
    this.jobs.push(...carriedJobs);
    for (const tribe of this.tribes) {
      const bootstrap = this.isBootstrapPhase(tribe);
      this.updateDiscovery(tribe);
      this.updateDiplomacy(tribe);
      this.assignRolesForTribe(tribe);
      this.generateEconomyJobs(tribe, bootstrap);
      this.generateBuildingPlans(tribe);
      if (!bootstrap) {
        this.generateDistrictPlans(tribe);
        this.generateExplorationPlans(tribe);
        this.generateEarthworkPlans(tribe);
        this.generateCraftingPlans(tribe);
        this.generateMilitaryPlans(tribe);
        this.generateAdventurePlans(tribe);
        this.generateDelvePlans(tribe);
        this.ensureBoatsForTribe(tribe);
        this.ensureWagonsForTribe(tribe);
        this.ensureCaravansForTribe(tribe);
        this.ensureSiegeForTribe(tribe);
      }
    }
  }

  private shouldPersistJob(job: JobState): boolean {
    if (job.claimedBy !== null) return true;
    return job.kind === "build" || job.kind === "haul" || job.kind === "craft" || job.kind === "earthwork";
  }

  private isBootstrapPhase(tribe: TribeState): boolean {
    const population = this.populationOf(tribe.id);
    const foodNeed = population * (tribe.age >= AgeType.Bronze ? 6 : 5);
    return (
      !this.hasBuilt(tribe.id, BuildingType.Farm) ||
      !this.hasBuilt(tribe.id, BuildingType.LumberCamp) ||
      !this.hasBuilt(tribe.id, BuildingType.Cistern) ||
      (!this.hasBuilt(tribe.id, BuildingType.Quarry) && tribe.resources[ResourceType.Stone] < 36) ||
      tribe.resources[ResourceType.Rations] < foodNeed * 1.35 ||
      tribe.resources[ResourceType.Wood] < 52 ||
      tribe.resources[ResourceType.Stone] < 26 ||
      tribe.water < Math.max(18, population * 0.6)
    );
  }

  private contactRadiusForTribe(tribe: TribeState): number {
    return tribe.age >= AgeType.Modern ? 42 : tribe.age >= AgeType.Industrial ? 36 : tribe.age >= AgeType.Medieval ? 32 : tribe.age >= AgeType.Bronze ? 28 : 24;
  }

  private hasLineOfContact(tribe: TribeState, other: TribeState): boolean {
    const radius = this.contactRadiusForTribe(tribe);
    for (const building of this.buildings) {
      if (building.tribeId !== tribe.id) continue;
      const center = buildingCenter(building);
      if (manhattan(center.x, center.y, other.capitalX, other.capitalY) <= radius) {
        return true;
      }
    }
    for (const agent of this.agents) {
      if (agent.tribeId === tribe.id && manhattan(agent.x, agent.y, other.capitalX, other.capitalY) <= radius) {
        return true;
      }
    }
    for (const wagon of this.wagons) {
      if (wagon.tribeId === tribe.id && manhattan(wagon.x, wagon.y, other.capitalX, other.capitalY) <= radius) {
        return true;
      }
    }
    for (const caravan of this.caravans) {
      if (caravan.tribeId === tribe.id && manhattan(caravan.x, caravan.y, other.capitalX, other.capitalY) <= radius) {
        return true;
      }
    }
    for (const boat of this.boats) {
      if (boat.tribeId === tribe.id && manhattan(boat.x, boat.y, other.capitalX, other.capitalY) <= radius) {
        return true;
      }
    }
    for (const engine of this.siegeEngines) {
      if (engine.tribeId === tribe.id && manhattan(engine.x, engine.y, other.capitalX, other.capitalY) <= radius) {
        return true;
      }
    }
    return false;
  }

  private markDiscovery(tribe: TribeState, other: TribeState): void {
    if (tribe.discovered[other.id]) {
      return;
    }
    tribe.discovered[other.id] = true;
    other.discovered[tribe.id] = true;
    this.pushEvent({
      kind: "first-contact",
      title: `${tribe.name} meets ${other.name}`,
      description: `${tribe.name} has made first contact with ${other.name}. Trade or war may follow.`,
      x: Math.floor((tribe.capitalX + other.capitalX) / 2),
      y: Math.floor((tribe.capitalY + other.capitalY) / 2),
      tribeId: tribe.id,
    });
  }

  private updateDiscovery(tribe: TribeState): void {
    for (const other of this.tribes) {
      if (other.id === tribe.id || tribe.discovered[other.id]) continue;
      const distance = manhattan(tribe.capitalX, tribe.capitalY, other.capitalX, other.capitalY);
      const frontierAwareness =
        distance <= 220
        && this.currentYear >= 1
        && this.buildingsForTribe(tribe.id).length >= 6
        && this.buildingsForTribe(other.id).length >= 6
        && !this.isBootstrapPhase(tribe)
        && !this.isBootstrapPhase(other);
      if (frontierAwareness || this.hasLineOfContact(tribe, other) || this.hasLineOfContact(other, tribe)) {
        this.markDiscovery(tribe, other);
      }
    }
  }

  private updateDiplomacy(tribe: TribeState): void {
    for (const other of this.tribes) {
      if (other.id === tribe.id) continue;
      if (!tribe.discovered[other.id]) continue;
      const distance = manhattan(tribe.capitalX, tribe.capitalY, other.capitalX, other.capitalY);
      const scarcity = (tribe.resources[ResourceType.Rations] < this.populationOf(tribe.id) * 3 ? -6 : 2) + (tribe.water < Math.max(10, this.populationOf(tribe.id) * 0.4) ? -4 : 1);
      const raceAffinity = tribe.race.type === other.race.type ? 12 : tribe.race.personality.diplomacy * 6 - other.race.personality.aggression * 8;
      const borderPressure = distance < 160 ? -8 : 1;
      const powerGap = this.populationOf(tribe.id) - this.populationOf(other.id);
      const drift = scarcity + raceAffinity + borderPressure + powerGap * 0.08 - tribe.race.personality.aggression * 5;
      tribe.relations[other.id] = clamp(tribe.relations[other.id]! + drift * 0.16, -100, 100);
    }

    for (const other of this.tribes) {
      if (other.id === tribe.id || tribe.id > other.id) continue;
      if (!tribe.discovered[other.id] || !other.discovered[tribe.id]) continue;
      const relation = Math.min(tribe.relations[other.id]!, other.relations[tribe.id]!);
      const distance = manhattan(tribe.capitalX, tribe.capitalY, other.capitalX, other.capitalY);
      const tradeReady = tribe.age >= AgeType.Stone && other.age >= AgeType.Stone;
      const tradeLean = tribe.race.personality.trade + other.race.personality.trade + tribe.race.personality.diplomacy + other.race.personality.diplomacy;
      const hasPact = tribe.tradePacts[other.id] || other.tradePacts[tribe.id];
      if (!hasPact && tradeReady && relation > 42 && distance < 720 && tradeLean > 1.45) {
        tribe.tradePacts[other.id] = true;
        other.tradePacts[tribe.id] = true;
        this.pushEvent({
          kind: "trade-pact",
          title: `${tribe.name} and ${other.name} sign a trade pact`,
          description: `${tribe.name} and ${other.name} have opened a formal trade road between their settlements.`,
          x: Math.floor((tribe.capitalX + other.capitalX) / 2),
          y: Math.floor((tribe.capitalY + other.capitalY) / 2),
          tribeId: tribe.id,
        });
      } else if (hasPact && (relation < 18 || distance > 980 || diplomacyStateFromScore(relation) < DiplomacyState.Neutral)) {
        tribe.tradePacts[other.id] = false;
        other.tradePacts[tribe.id] = false;
        this.pushEvent({
          kind: "trade-break",
          title: `${tribe.name} and ${other.name} break trade`,
          description: `${tribe.name} and ${other.name} have let their trade pact collapse.`,
          x: Math.floor((tribe.capitalX + other.capitalX) / 2),
          y: Math.floor((tribe.capitalY + other.capitalY) / 2),
          tribeId: tribe.id,
        });
      }
    }

    const rivals = this.tribes
      .filter((other) => other.id !== tribe.id && tribe.discovered[other.id] && manhattan(tribe.capitalX, tribe.capitalY, other.capitalX, other.capitalY) < 260)
      .sort((a, b) => this.tribeStrategicPower(b) - this.tribeStrategicPower(a));
    for (const other of rivals) {
      const tribePower = this.tribeStrategicPower(tribe);
      const otherPower = this.tribeStrategicPower(other);
      const relation = tribe.relations[other.id]!;
      const distance = manhattan(tribe.capitalX, tribe.capitalY, other.capitalX, other.capitalY);
      if (
        tribePower > otherPower * 1.8 &&
        relation < -24 &&
        tribe.age >= AgeType.Bronze &&
        other.tributeTo === null
      ) {
        other.tributeTo = tribe.id;
        this.pushEvent({
          kind: "tribute",
          title: `${other.name} bows to ${tribe.name}`,
          description: `${other.name} is now paying tribute to ${tribe.name} under military pressure.`,
          x: other.capitalX,
          y: other.capitalY,
          tribeId: tribe.id,
        });
      }
      if (tribe.tributeTo === other.id && (tribePower > otherPower * 0.72 || relation > -8 || distance > 320)) {
        tribe.tributeTo = null;
        this.pushEvent({
          kind: "tribute-break",
          title: `${tribe.name} rejects tribute`,
          description: `${tribe.name} has slipped free of ${other.name}'s tribute demands.`,
          x: tribe.capitalX,
          y: tribe.capitalY,
          tribeId: tribe.id,
        });
      }
    }
  }

  private generateEconomyJobs(tribe: TribeState, bootstrap = false): void {
    const foodNeed = this.populationOf(tribe.id) * (tribe.age >= AgeType.Bronze ? 6 : 5);
    const lowFood = tribe.resources[ResourceType.Rations] < foodNeed * (bootstrap ? 1.6 : 1.15);
    const lowWood = tribe.resources[ResourceType.Wood] < (bootstrap ? 56 : 90);
    const lowStone = tribe.resources[ResourceType.Stone] < (bootstrap ? 28 : 70);
    const lowClay = tribe.resources[ResourceType.Clay] < (bootstrap ? 12 : 6);
    const lowOre = tribe.age >= AgeType.Bronze && tribe.resources[ResourceType.Ore] < (bootstrap ? 24 : 60);
    const economyRadius = bootstrap ? 12 : 18;
    const huntRadius = bootstrap ? 12 : 16;
    const missingFarm = !this.hasBuilt(tribe.id, BuildingType.Farm);
    const missingLumber = !this.hasBuilt(tribe.id, BuildingType.LumberCamp);
    const missingQuarry = !this.hasBuilt(tribe.id, BuildingType.Quarry);
    const missingCistern = !this.hasBuilt(tribe.id, BuildingType.Cistern);
    const farms = this.buildingsForTribe(tribe.id).filter((building) => building.type === BuildingType.Farm || building.type === BuildingType.Orchard);
    const lumberCamps = this.buildingsForTribe(tribe.id).filter((building) => building.type === BuildingType.LumberCamp);
    const quarries = this.buildingsForTribe(tribe.id).filter((building) => building.type === BuildingType.Quarry);
    const mines = this.buildingsForTribe(tribe.id).filter((building) => building.type === BuildingType.Mine || building.type === BuildingType.DeepMine);
    const docks = this.buildingsForTribe(tribe.id).filter((building) =>
      building.type === BuildingType.Dock || building.type === BuildingType.FishingHut || building.type === BuildingType.Fishery,
    );

    if (farms.length > 0) {
      let activeFarmJobs = this.jobs.filter((job) => job.tribeId === tribe.id && job.kind === "farm").length;
      for (const farm of farms) {
        if (activeFarmJobs >= Math.min(3, farms.length)) break;
        const center = buildingCenter(farm);
        if (this.jobs.some((job) => job.tribeId === tribe.id && job.kind === "farm" && job.x === center.x && job.y === center.y)) continue;
        this.jobs.push({
          id: this.nextJobId++,
          tribeId: tribe.id,
          kind: "farm",
          x: center.x,
          y: center.y,
          priority: lowFood ? 6 : 4,
          claimedBy: null,
          payload: { resourceType: farm.type === BuildingType.Orchard ? ResourceType.Berries : ResourceType.Grain },
        });
        activeFarmJobs += 1;
      }
    }

    if (docks.length > 0) {
      let activeFishJobs = this.jobs.filter((job) => job.tribeId === tribe.id && job.kind === "fish").length;
      for (const dock of docks) {
        if (activeFishJobs >= Math.min(3, docks.length + 1)) break;
        const center = buildingCenter(dock);
        activeFishJobs += this.enqueueWaterJobsAround(tribe, center.x, center.y, "fish", 10, lowFood ? 2 : 1);
      }
    }

    if (lumberCamps.length > 0) {
      for (const camp of lumberCamps) {
        const center = buildingCenter(camp);
        this.enqueueFeatureJobsAround(tribe, center.x, center.y, FeatureType.Trees, "cut_tree", 9, lowWood ? 2 : 1);
      }
    }

    if (quarries.length > 0) {
      for (const quarry of quarries) {
        const center = buildingCenter(quarry);
        this.enqueueFeatureJobsAround(tribe, center.x, center.y, FeatureType.StoneOutcrop, "quarry", 9, lowStone ? 2 : 1);
        this.enqueueFeatureJobsAround(tribe, center.x, center.y, FeatureType.ClayDeposit, "quarry", 8, missingCistern || lowClay ? 2 : 1);
      }
    }

    if (mines.length > 0) {
      for (const mine of mines) {
        const center = buildingCenter(mine);
        this.enqueueFeatureJobsAround(tribe, center.x, center.y, FeatureType.OreVein, "mine", 10, lowOre ? 2 : 1);
      }
    }

    if (lowFood || bootstrap || missingFarm) {
      let queuedFood = 0;
      for (const farm of farms) {
        if (queuedFood >= (bootstrap ? 5 : 3)) break;
        const center = buildingCenter(farm);
        queuedFood += this.enqueueFeatureJobsAround(tribe, center.x, center.y, FeatureType.BerryPatch, "gather", 8, 2);
        queuedFood += this.enqueueResourceJobsAround(tribe, center.x, center.y, [ResourceType.Berries, ResourceType.Grain], "gather", 7, 1);
      }
      if (queuedFood < (bootstrap ? 10 : 6)) {
        this.enqueueNearbyFeatureJobs(tribe, FeatureType.BerryPatch, "gather", economyRadius, (bootstrap ? 10 : 6) - queuedFood);
      }
      this.enqueueNearbyResourceJobs(tribe, [ResourceType.Berries, ResourceType.Grain], "gather", economyRadius, bootstrap ? 8 : 4);
      this.enqueueAnimalJobs(tribe, [AnimalType.Deer, AnimalType.Boar, AnimalType.Sheep, AnimalType.Goat], "hunt", huntRadius, bootstrap ? 6 : 4);
    }

    if (!bootstrap && tribe.age >= AgeType.Iron && tribe.resources[ResourceType.Horses] < 4) {
      this.enqueueAnimalJobs(tribe, [AnimalType.Horse], "tame_horse", 22, 2);
    }
    if (!bootstrap && tribe.age >= AgeType.Stone && tribe.resources[ResourceType.Livestock] < 6) {
      this.enqueueAnimalJobs(tribe, [AnimalType.Sheep], "tame_livestock", 18, 2);
    }

    if (lowWood || bootstrap || missingLumber) {
      let queuedWood = 0;
      for (const camp of lumberCamps) {
        if (queuedWood >= (bootstrap ? 8 : 5)) break;
        const center = buildingCenter(camp);
        queuedWood += this.enqueueFeatureJobsAround(tribe, center.x, center.y, FeatureType.Trees, "cut_tree", 9, bootstrap ? 4 : 3);
        queuedWood += this.enqueueResourceJobsAround(tribe, center.x, center.y, [ResourceType.Wood], "cut_tree", 8, bootstrap ? 2 : 1);
      }
      if (queuedWood < (bootstrap ? 10 : 6)) {
        this.enqueueNearbyFeatureJobs(tribe, FeatureType.Trees, "cut_tree", economyRadius, (bootstrap ? 10 : 6) - queuedWood);
      }
      this.enqueueNearbyResourceJobs(tribe, [ResourceType.Wood], "cut_tree", economyRadius, bootstrap ? 8 : 3);
    }

    if (lowStone || bootstrap || missingQuarry || missingCistern) {
      let queuedStone = 0;
      for (const quarry of quarries) {
        if (queuedStone >= (bootstrap ? 5 : 3)) break;
        const center = buildingCenter(quarry);
        queuedStone += this.enqueueFeatureJobsAround(tribe, center.x, center.y, FeatureType.StoneOutcrop, "quarry", 9, bootstrap ? 3 : 2);
        queuedStone += this.enqueueFeatureJobsAround(tribe, center.x, center.y, FeatureType.ClayDeposit, "quarry", 8, 1);
        queuedStone += this.enqueueResourceJobsAround(tribe, center.x, center.y, [ResourceType.Stone, ResourceType.Clay], "quarry", 8, 1);
      }
      if (queuedStone < (bootstrap ? 6 : 4)) {
        this.enqueueNearbyFeatureJobs(tribe, FeatureType.StoneOutcrop, "quarry", economyRadius, (bootstrap ? 6 : 4) - queuedStone);
      }
      this.enqueueNearbyFeatureJobs(tribe, FeatureType.ClayDeposit, "quarry", economyRadius, bootstrap ? 4 : 2);
      this.enqueueNearbyResourceJobs(tribe, [ResourceType.Stone, ResourceType.Clay], "quarry", economyRadius, bootstrap ? 6 : 3);
    }

    if ((missingCistern || tribe.water < Math.max(18, this.populationOf(tribe.id) * 0.6)) && (lowClay || bootstrap)) {
      for (const quarry of quarries) {
        const center = buildingCenter(quarry);
        this.enqueueFeatureJobsAround(tribe, center.x, center.y, FeatureType.ClayDeposit, "quarry", 8, 2);
        this.enqueueResourceJobsAround(tribe, center.x, center.y, [ResourceType.Clay], "quarry", 7, 1);
      }
      this.enqueueNearbyFeatureJobs(tribe, FeatureType.ClayDeposit, "quarry", economyRadius, bootstrap ? 8 : 5);
      this.enqueueNearbyResourceJobs(tribe, [ResourceType.Clay], "quarry", economyRadius, bootstrap ? 5 : 2);
    }

    if ((tribe.age >= AgeType.Bronze && !bootstrap && lowOre) || (tribe.age >= AgeType.Bronze && !this.hasBuilt(tribe.id, BuildingType.Mine))) {
      let queuedOre = 0;
      for (const mine of mines) {
        if (queuedOre >= 4) break;
        const center = buildingCenter(mine);
        queuedOre += this.enqueueFeatureJobsAround(tribe, center.x, center.y, FeatureType.OreVein, "mine", 10, 2);
      }
      if (queuedOre < 4) {
        this.enqueueNearbyFeatureJobs(tribe, FeatureType.OreVein, "mine", 20, 4 - queuedOre);
      }
    }

    if (!bootstrap && tribe.race.personality.ecology > 0.7 && this.tickCount % (STRATEGY_TICKS * 2) === 1) {
      this.enqueueReplantJobs(tribe, 2);
    }
  }

  private generateExplorationPlans(tribe: TribeState): void {
    if (tribe.age < AgeType.Stone) {
      return;
    }
    const undiscovered = this.tribes
      .filter((other) => other.id !== tribe.id && !tribe.discovered[other.id])
      .sort((a, b) => manhattan(tribe.capitalX, tribe.capitalY, a.capitalX, a.capitalY) - manhattan(tribe.capitalX, tribe.capitalY, b.capitalX, b.capitalY));
    if (undiscovered.length === 0) {
      return;
    }

    const activePatrols = this.jobs.filter((job) => job.tribeId === tribe.id && job.kind === "patrol").length;
    const fighters = this.agentsForTribe(tribe.id)
      .filter((agent) => agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider || agent.role === AgentRole.Mage)
      .length;
    if (fighters === 0) {
      return;
    }

    const desired = Math.min(3, Math.max(1, Math.floor(fighters / 3)));
    if (activePatrols >= desired) {
      return;
    }

    const target = undiscovered[0]!;
    const contactOffset = Math.max(6, this.contactRadiusForTribe(tribe) - 6);
    const frontX = clamp(target.capitalX - Math.sign(target.capitalX - tribe.capitalX) * contactOffset, 2, this.world.width - 3);
    const frontY = clamp(target.capitalY - Math.sign(target.capitalY - tribe.capitalY) * contactOffset, 2, this.world.height - 3);
    for (let i = activePatrols; i < desired; i += 1) {
      const rally = this.militaryFormationPoint(frontX, frontY, target.capitalX, target.capitalY, i, desired, 3);
      this.jobs.push({
        id: this.nextJobId++,
        tribeId: tribe.id,
        kind: "patrol",
        x: rally.x,
        y: rally.y,
        priority: 5,
        claimedBy: null,
        payload: { targetTribeId: target.id, targetX: target.capitalX, targetY: target.capitalY },
      });
    }
  }

  private nearestStorageDistance(tribeId: number, x: number, y: number): number {
    let best = Number.POSITIVE_INFINITY;
    for (const building of this.buildingsForTribe(tribeId)) {
      if (building.type !== BuildingType.Warehouse && building.type !== BuildingType.Stockpile && building.type !== BuildingType.CapitalHall) continue;
      const center = buildingCenter(building);
      best = Math.min(best, manhattan(center.x, center.y, x, y));
    }
    return best;
  }

  private hasNearbyPlannedBuild(tribeId: number, buildingType: BuildingType, x: number, y: number, radius: number): boolean {
    return this.jobs.some((job) =>
      job.tribeId === tribeId &&
      job.kind === "build" &&
      (job.payload as BuildPayload | undefined)?.buildingType === buildingType &&
      manhattan(job.x, job.y, x, y) <= radius,
    );
  }

  private findBuildingSiteAround(tribe: TribeState, def: { type: BuildingType; size: [number, number] }, originX: number, originY: number, radius: number): { x: number; y: number } | null {
    let best: { x: number; y: number; score: number } | null = null;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = originX + dx;
        const y = originY + dy;
        if (!this.canPlaceBuilding(def.type, x, y, def.size[0], def.size[1])) continue;
        const score = this.scoreBuildingSite(tribe, def.type, x, y) - manhattan(originX, originY, x, y) * 1.7;
        if (!best || score > best.score) {
          best = { x, y, score };
        }
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  private tryPlanBuildingAround(tribe: TribeState, type: BuildingType, priority: number, originX: number, originY: number, radius: number): void {
    const existingPlan = this.jobs.find((job) => job.tribeId === tribe.id && job.kind === "build" && (job.payload as BuildPayload | undefined)?.buildingType === type && manhattan(job.x, job.y, originX, originY) <= radius + 4);
    if (existingPlan) return;
    if (this.buildingCount(tribe.id, type) >= this.maxBuildingCountForTribe(tribe, type)) return;
    if (
      this.hasBuilt(tribe.id, type) &&
      type !== BuildingType.House &&
      type !== BuildingType.Watchtower &&
      type !== BuildingType.Farm &&
      type !== BuildingType.Orchard &&
      type !== BuildingType.Stockpile &&
      type !== BuildingType.Warehouse
    ) {
      return;
    }

    const def = getBuildingDef(type);
    if (tribe.age < def.minAge) return;
    if (!this.canAfford(tribe, def.cost)) return;
    const site = this.findBuildingSiteAround(tribe, def, originX, originY, radius);
    if (!site) return;
    const haulSpecs = this.constructionHaulPlan(def.cost);

    for (const [resource, amount] of Object.entries(def.cost)) {
      tribe.resources[Number(resource)] -= amount ?? 0;
    }

    const buildJob: JobState = {
      id: this.nextJobId++,
      tribeId: tribe.id,
      kind: "build",
      x: site.x,
      y: site.y,
      priority,
      claimedBy: null,
      payload: {
        buildingType: type,
        width: def.size[0],
        height: def.size[1],
        supplied: 0,
        supplyNeeded: Math.max(1, haulSpecs.length),
        stockX: site.x + Math.floor(def.size[0] / 2),
        stockY: site.y + Math.floor(def.size[1] / 2),
      },
    };
    this.jobs.push(buildJob);
    for (const haul of haulSpecs) {
      const sourceBuilding = this.findStockedSourceBuilding(tribe.id, site.x, site.y, haul.resourceType);
      const sourceSite = sourceBuilding ? buildingCenter(sourceBuilding) : this.findConstructionSource(tribe.id, type);
      this.jobs.push({
        id: this.nextJobId++,
        tribeId: tribe.id,
        kind: "haul",
        x: sourceSite.x,
        y: sourceSite.y,
        priority: Math.max(4, priority - 1),
        claimedBy: null,
        payload: {
          sourceX: sourceSite.x,
          sourceY: sourceSite.y,
          sourceBuildingId: sourceBuilding?.id ?? null,
          dropX: site.x + Math.floor(def.size[0] / 2),
          dropY: site.y + Math.floor(def.size[1] / 2),
          resourceType: haul.resourceType,
          amount: haul.amount,
          targetJobId: buildJob.id,
        },
      });
    }
  }

  private generateDistrictPlans(tribe: TribeState): void {
    const population = this.populationOf(tribe.id);
    if (population < 20) {
      return;
    }
    const storages = this.buildingsForTribe(tribe.id)
      .filter((building) => building.type === BuildingType.Warehouse || building.type === BuildingType.Stockpile || building.type === BuildingType.CapitalHall);
    if (storages.length === 0) {
      return;
    }

    const remoteCandidates = this.buildingsForTribe(tribe.id)
      .filter((building) =>
        building.type === BuildingType.Farm ||
        building.type === BuildingType.Orchard ||
        building.type === BuildingType.LumberCamp ||
        building.type === BuildingType.Quarry ||
        building.type === BuildingType.Mine ||
        building.type === BuildingType.DeepMine ||
        building.type === BuildingType.Dock ||
        building.type === BuildingType.FishingHut ||
        building.type === BuildingType.Fishery,
      )
      .map((building) => ({ building, center: buildingCenter(building), storageDistance: this.nearestStorageDistance(tribe.id, buildingCenter(building).x, buildingCenter(building).y) }))
      .filter((entry) => entry.storageDistance >= 14)
      .sort((a, b) => b.storageDistance - a.storageDistance);

    const target = remoteCandidates[0];
    if (!target) {
      return;
    }

    const nearbyStorage = storages.some((building) => manhattan(buildingCenter(building).x, buildingCenter(building).y, target.center.x, target.center.y) <= 7);
    if (!nearbyStorage && !this.hasNearbyPlannedBuild(tribe.id, BuildingType.Stockpile, target.center.x, target.center.y, 7)) {
      this.tryPlanBuildingAround(tribe, BuildingType.Stockpile, 6, target.center.x, target.center.y, 7);
      return;
    }

    if (
      tribe.age >= AgeType.Bronze &&
      population >= 30 &&
      target.storageDistance >= 22 &&
      !storages.some((building) => building.type === BuildingType.Warehouse && manhattan(buildingCenter(building).x, buildingCenter(building).y, target.center.x, target.center.y) <= 8) &&
      !this.hasNearbyPlannedBuild(tribe.id, BuildingType.Warehouse, target.center.x, target.center.y, 8)
    ) {
      this.tryPlanBuildingAround(tribe, BuildingType.Warehouse, 7, target.center.x, target.center.y, 8);
    }
  }

  private generateBuildingPlans(tribe: TribeState): void {
    const population = this.populationOf(tribe.id);
    const housing = this.computeHousing(tribe.id);
    const foodNeed = population * (tribe.age >= AgeType.Bronze ? 6 : 5);
    const contacts = this.contactCount(tribe);
    const lowFood = tribe.resources[ResourceType.Rations] < foodNeed * 1.1;
    const lowWater = tribe.water < Math.max(18, population * 0.6);
    const lowWood = tribe.resources[ResourceType.Wood] < 56;
    const lowStone = tribe.resources[ResourceType.Stone] < 30;
    const infrastructureStable = !lowFood && !lowWater && !lowWood && !lowStone;
    const missingBootstrap =
      !this.hasBuilt(tribe.id, BuildingType.Farm)
      || !this.hasBuilt(tribe.id, BuildingType.LumberCamp)
      || !this.hasBuilt(tribe.id, BuildingType.Cistern)
      || (!this.hasBuilt(tribe.id, BuildingType.Quarry) && tribe.resources[ResourceType.Stone] < 36);

    if (lowWater && this.buildingCount(tribe.id, BuildingType.Cistern) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.Cistern, 9);
    }
    if (lowFood && this.buildingCount(tribe.id, BuildingType.Farm) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.Farm, 10);
      if (tribe.race.personality.ecology > 0.55) {
        this.tryPlanBuilding(tribe, BuildingType.Orchard, 8);
      }
    }
    if (tribe.age >= AgeType.Medieval && lowFood && hasAdjacentWater(this.world, tribe.capitalX, tribe.capitalY, 7)) {
      if (!this.hasBuilt(tribe.id, BuildingType.Dock)) {
        this.tryPlanBuilding(tribe, BuildingType.Dock, 9);
      } else if (this.buildingCount(tribe.id, BuildingType.FishingHut) < 2) {
        this.tryPlanBuilding(tribe, BuildingType.FishingHut, 8);
      }
    }
    if (lowWood && this.buildingCount(tribe.id, BuildingType.LumberCamp) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.LumberCamp, 9);
    }
    if (lowStone && this.buildingCount(tribe.id, BuildingType.Quarry) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.Quarry, 8);
    }
    if ((lowFood || lowWood || lowStone) && this.buildingCount(tribe.id, BuildingType.Stockpile) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.Stockpile, 8);
    }
    if (tribe.age >= AgeType.Bronze && (lowFood || lowWood || lowStone || lowWater) && this.buildingCount(tribe.id, BuildingType.Warehouse) < 1) {
      this.tryPlanBuilding(tribe, BuildingType.Warehouse, 9);
    }

    if (missingBootstrap) {
      if (!this.hasBuilt(tribe.id, BuildingType.Farm)) {
        this.tryPlanBuilding(tribe, BuildingType.Farm, 10);
      }
      if (!this.hasBuilt(tribe.id, BuildingType.LumberCamp)) {
        this.tryPlanBuilding(tribe, BuildingType.LumberCamp, 10);
      }
      if (!this.hasBuilt(tribe.id, BuildingType.Cistern)) {
        this.tryPlanBuilding(tribe, BuildingType.Cistern, 10);
      }
      if (!this.hasBuilt(tribe.id, BuildingType.Quarry)) {
        this.tryPlanBuilding(tribe, BuildingType.Quarry, 9);
      }
      return;
    }

    if (housing < population + 2) {
      if (tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Darkfolk) {
        this.tryPlanBuilding(tribe, BuildingType.MountainHall, 8);
      }
      this.tryPlanBuilding(tribe, BuildingType.House, 8);
    }

    if (population > 18 && this.buildingCount(tribe.id, BuildingType.Stockpile) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.Stockpile, 6);
    }
    if (tribe.age >= AgeType.Bronze && population > 28 && this.buildingCount(tribe.id, BuildingType.Warehouse) < 1) {
      this.tryPlanBuilding(tribe, BuildingType.Warehouse, 6);
    }
    if (this.buildingCount(tribe.id, BuildingType.Cistern) < 1) {
      this.tryPlanBuilding(tribe, BuildingType.Cistern, 5);
    }
    if (population > 24 && tribe.water < Math.max(16, population * 0.55) && this.buildingCount(tribe.id, BuildingType.Cistern) < 3) {
      this.tryPlanBuilding(tribe, BuildingType.Cistern, 7);
    }

    if (!this.hasBuilt(tribe.id, BuildingType.Farm)) {
      this.tryPlanBuilding(tribe, BuildingType.Farm, 7);
    }
    if (tribe.age >= AgeType.Stone && population > 22 && this.buildingCount(tribe.id, BuildingType.Farm) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.Farm, 6);
    }
    if (!this.hasBuilt(tribe.id, BuildingType.LumberCamp)) {
      this.tryPlanBuilding(tribe, BuildingType.LumberCamp, 7);
    }
    if (!this.hasBuilt(tribe.id, BuildingType.Quarry)) {
      this.tryPlanBuilding(tribe, BuildingType.Quarry, 6);
    }
    if ((tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Darkfolk) && this.buildingCount(tribe.id, BuildingType.MountainHall) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.MountainHall, 6);
    }
    if (tribe.race.personality.ecology > 0.65 && tribe.age >= AgeType.Stone && infrastructureStable && this.buildingCount(tribe.id, BuildingType.Orchard) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.Orchard, 5);
    }
    if (tribe.age >= AgeType.Stone && infrastructureStable && population > 20 && !this.hasBuilt(tribe.id, BuildingType.Shrine)) {
      this.tryPlanBuilding(tribe, BuildingType.Shrine, 5);
    }
    if (tribe.age >= AgeType.Stone && infrastructureStable && population >= 22 && !this.hasBuilt(tribe.id, BuildingType.Workshop)) {
      this.tryPlanBuilding(tribe, BuildingType.Workshop, 7);
    }
    if (
      tribe.age >= AgeType.Stone &&
      infrastructureStable &&
      population >= 22 &&
      !this.hasBuilt(tribe.id, BuildingType.Mine) &&
      distanceToNearestFeature(this.world, tribe.capitalX, tribe.capitalY, (feature) => feature === FeatureType.OreVein, 18) <= 12
    ) {
      this.tryPlanBuilding(tribe, BuildingType.Mine, 7);
    }
    if (tribe.age >= AgeType.Bronze && infrastructureStable && !this.hasBuilt(tribe.id, BuildingType.School)) {
      this.tryPlanBuilding(tribe, BuildingType.School, 6);
    }
    if (tribe.age >= AgeType.Bronze && infrastructureStable && population > 26 && !this.hasBuilt(tribe.id, BuildingType.Tavern)) {
      this.tryPlanBuilding(tribe, BuildingType.Tavern, 5);
    }
    if (tribe.age >= AgeType.Stone && !this.hasBuilt(tribe.id, BuildingType.Mine) && distanceToNearestFeature(this.world, tribe.capitalX, tribe.capitalY, (feature) => feature === FeatureType.OreVein, 18) <= 12) {
      this.tryPlanBuilding(tribe, BuildingType.Mine, 6);
    }
    if ((tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Darkfolk) && tribe.age >= AgeType.Bronze && this.buildingCount(tribe.id, BuildingType.TunnelEntrance) < 1) {
      this.tryPlanBuilding(tribe, BuildingType.TunnelEntrance, 6);
    }
    if (tribe.age >= AgeType.Iron && (tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Darkfolk) && this.buildingCount(tribe.id, BuildingType.DeepMine) < 1) {
      this.tryPlanBuilding(tribe, BuildingType.DeepMine, 7);
    }
    if (tribe.age >= AgeType.Bronze && infrastructureStable && population >= 24 && (contacts > 0 || this.currentYear >= 4) && this.meanHostility(tribe) > 12 && !this.hasBuilt(tribe.id, BuildingType.Barracks)) {
      this.tryPlanBuilding(tribe, BuildingType.Barracks, 8);
    }
    if (tribe.age >= AgeType.Iron && !this.hasBuilt(tribe.id, BuildingType.Smithy)) {
      this.tryPlanBuilding(tribe, BuildingType.Smithy, 6);
    }
    if (tribe.age >= AgeType.Iron && infrastructureStable && population >= 28 && contacts > 0 && this.meanHostility(tribe) > 10 && !this.hasBuilt(tribe.id, BuildingType.Armory)) {
      this.tryPlanBuilding(tribe, BuildingType.Armory, 7);
    }
    if (tribe.age >= AgeType.Iron && infrastructureStable && population >= 26 && contacts > 0 && this.meanHostility(tribe) > 8 && this.buildingCount(tribe.id, BuildingType.Watchtower) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.Watchtower, 3);
    }
    if (
      tribe.age >= AgeType.Iron
      && this.agentsForTribe(tribe.id).filter((agent) => agent.wounds > 0).length >= 3
      && !this.hasBuilt(tribe.id, BuildingType.Infirmary)
    ) {
      this.tryPlanBuilding(tribe, BuildingType.Infirmary, 7);
    }
    if (
      tribe.age >= AgeType.Medieval
      && (tribe.race.type === RaceType.Elves || tribe.race.type === RaceType.Darkfolk)
      && !this.hasBuilt(tribe.id, BuildingType.MageTower)
    ) {
      this.tryPlanBuilding(tribe, BuildingType.MageTower, 7);
    }
    if (
      tribe.age >= AgeType.Gunpowder
      && (tribe.race.type === RaceType.Elves || tribe.race.type === RaceType.Darkfolk)
      && !this.hasBuilt(tribe.id, BuildingType.ArcaneSanctum)
    ) {
      this.tryPlanBuilding(tribe, BuildingType.ArcaneSanctum, 9);
    }
    if (tribe.age >= AgeType.Medieval && hasAdjacentWater(this.world, tribe.capitalX, tribe.capitalY, 7) && !this.hasBuilt(tribe.id, BuildingType.Dock)) {
      this.tryPlanBuilding(tribe, BuildingType.Dock, 6);
    }
    if (tribe.age >= AgeType.Medieval && this.hasBuilt(tribe.id, BuildingType.Dock) && this.buildingCount(tribe.id, BuildingType.FishingHut) < 2) {
      this.tryPlanBuilding(tribe, BuildingType.FishingHut, 5);
    }
    if (tribe.age >= AgeType.Medieval && this.hasBuilt(tribe.id, BuildingType.Dock) && this.buildingCount(tribe.id, BuildingType.Fishery) < 1) {
      this.tryPlanBuilding(tribe, BuildingType.Fishery, 5);
    }
    if (tribe.age >= AgeType.Medieval && tribe.resources[ResourceType.Horses] > 0 && !this.hasBuilt(tribe.id, BuildingType.Stable)) {
      this.tryPlanBuilding(tribe, BuildingType.Stable, 5);
    }
    if (tribe.age >= AgeType.Medieval && population > 42 && contacts > 0 && this.meanHostility(tribe) > 10 && !this.hasBuilt(tribe.id, BuildingType.Castle)) {
      this.tryPlanBuilding(tribe, BuildingType.Castle, 9);
    }
    if (
      tribe.age >= AgeType.Gunpowder &&
      (tribe.race.type === RaceType.Humans || tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Goblins) &&
      !this.hasBuilt(tribe.id, BuildingType.Foundry)
    ) {
      this.tryPlanBuilding(tribe, BuildingType.Foundry, 8);
    }
    if (
      tribe.age >= AgeType.Industrial &&
      (tribe.race.type === RaceType.Humans || tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Goblins || tribe.race.type === RaceType.Halflings) &&
      !this.hasBuilt(tribe.id, BuildingType.Factory)
    ) {
      this.tryPlanBuilding(tribe, BuildingType.Factory, 9);
    }
    if (
      tribe.age >= AgeType.Industrial &&
      (tribe.race.type === RaceType.Humans || tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Goblins || tribe.race.type === RaceType.Nomads) &&
      !this.hasBuilt(tribe.id, BuildingType.RailDepot)
    ) {
      this.tryPlanBuilding(tribe, BuildingType.RailDepot, 8);
    }
    if (
      tribe.age >= AgeType.Modern &&
      (tribe.race.type === RaceType.Humans || tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Goblins) &&
      !this.hasBuilt(tribe.id, BuildingType.PowerPlant)
    ) {
      this.tryPlanBuilding(tribe, BuildingType.PowerPlant, 10);
    }
    if (
      tribe.age >= AgeType.Modern &&
      (tribe.race.type === RaceType.Humans || tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Goblins || tribe.race.type === RaceType.Nomads) &&
      !this.hasBuilt(tribe.id, BuildingType.Airfield)
    ) {
      this.tryPlanBuilding(tribe, BuildingType.Airfield, 9);
    }
  }

  private generateEarthworkPlans(tribe: TribeState): void {
    const earthworkJobs = this.jobs.filter((job) => job.tribeId === tribe.id && job.kind === "earthwork").length;
    if (earthworkJobs > 18) {
      return;
    }

    const population = this.populationOf(tribe.id);
    const foodNeed = population * (tribe.age >= AgeType.Bronze ? 6 : 5);
    const lowFood = tribe.resources[ResourceType.Rations] < foodNeed;
    const lowWater = tribe.water < Math.max(14, population * 0.5);
    const lowWood = tribe.resources[ResourceType.Wood] < 70;
    const lowStone = tribe.resources[ResourceType.Stone] < 48;
    const infrastructureStable = !lowFood && !lowWater && !lowWood && !lowStone;
    const contacts = this.contactCount(tribe);

    if (tribe.age >= AgeType.Stone) {
      this.planFarmCanals(tribe, lowWater ? 1 : tribe.age >= AgeType.Iron ? 3 : 1);
    }

    const hostility = this.meanHostility(tribe);
    if (!infrastructureStable || population < 24 || contacts === 0) {
      return;
    }

    const hasMilitaryAnchor =
      this.hasBuilt(tribe.id, BuildingType.Barracks) ||
      this.hasBuilt(tribe.id, BuildingType.Watchtower) ||
      this.hasBuilt(tribe.id, BuildingType.Castle);

    if (hostility > 14 && hasMilitaryAnchor) {
      this.planDefensiveRing(tribe, Math.min(6, 2 + Math.floor(hostility * 0.04)));
    }
    if (hostility > 24 && tribe.age >= AgeType.Bronze && hasMilitaryAnchor) {
      this.planOuterTrenches(tribe, 4);
    }
  }

  private planFarmCanals(tribe: TribeState, limit: number): void {
    const farms = this.buildingsForTribe(tribe.id).filter((building) => building.type === BuildingType.Farm || building.type === BuildingType.Orchard);
    let planned = 0;
    for (const farm of farms) {
      if (planned >= limit) break;
      const candidates = [
        { x: farm.x - 1, y: farm.y + 1 },
        { x: farm.x + farm.width, y: farm.y + 1 },
        { x: farm.x + 1, y: farm.y - 1 },
        { x: farm.x + 1, y: farm.y + farm.height },
      ];
      for (const candidate of candidates) {
        if (planned >= limit) break;
        if (!this.canPlaceEarthwork(candidate.x, candidate.y, "canal")) continue;
        if (!hasAdjacentWater(this.world, candidate.x, candidate.y, 10)) continue;
        this.enqueueEarthworkJob(tribe, candidate.x, candidate.y, "canal", 5);
        planned += 1;
      }
    }
  }

  private planDefensiveRing(tribe: TribeState, limit: number): void {
    const radius = tribe.age >= AgeType.Medieval ? 10 : tribe.age >= AgeType.Iron ? 9 : 8;
    let planned = 0;
    for (let dx = -radius; dx <= radius && planned < limit; dx += 2) {
      for (const dy of [-radius, radius]) {
        const kind = dx === 0 ? "gate" : tribe.age >= AgeType.Iron ? "stone_wall" : "palisade";
        if (this.canPlaceEarthwork(tribe.capitalX + dx, tribe.capitalY + dy, kind)) {
          this.enqueueEarthworkJob(tribe, tribe.capitalX + dx, tribe.capitalY + dy, kind, 6);
          planned += 1;
        }
      }
    }
    for (let dy = -radius + 2; dy <= radius - 2 && planned < limit; dy += 2) {
      for (const dx of [-radius, radius]) {
        const kind = dy === 0 ? "gate" : tribe.age >= AgeType.Iron ? "stone_wall" : "palisade";
        if (this.canPlaceEarthwork(tribe.capitalX + dx, tribe.capitalY + dy, kind)) {
          this.enqueueEarthworkJob(tribe, tribe.capitalX + dx, tribe.capitalY + dy, kind, 6);
          planned += 1;
        }
      }
    }
  }

  private planOuterTrenches(tribe: TribeState, limit: number): void {
    const radius = tribe.age >= AgeType.Medieval ? 12 : 10;
    let planned = 0;
    for (let dx = -radius; dx <= radius && planned < limit; dx += 3) {
      for (const dy of [-radius, radius]) {
        if (this.canPlaceEarthwork(tribe.capitalX + dx, tribe.capitalY + dy, "trench")) {
          this.enqueueEarthworkJob(tribe, tribe.capitalX + dx, tribe.capitalY + dy, "trench", 5);
          planned += 1;
        }
      }
    }
  }

  private generateCraftingPlans(tribe: TribeState): void {
    const population = this.populationOf(tribe.id);
    const soldiers = this.agentsForTribe(tribe.id).filter((agent) => agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider || agent.role === AgentRole.Mage).length;
    const buildBacklog = this.jobs.filter((job) => job.tribeId === tribe.id && (job.kind === "build" || job.kind === "haul")).length;
    const desiredStoneTools = Math.max(6, Math.floor(population * 0.45));
    const desiredBronzeTools = Math.max(4, Math.floor(population * 0.3));
    const desiredIronTools = Math.max(5, Math.floor(population * 0.35));
    const desiredBasicWeapons = Math.max(4, Math.floor(soldiers * 1.2));
    const desiredBasicArmor = Math.max(3, Math.floor(soldiers));
    const desiredMetalWeapons = Math.max(4, Math.floor(soldiers * 1.15));
    const desiredMetalArmor = Math.max(3, Math.floor(soldiers * 0.95));
    if (tribe.resources[ResourceType.StoneTools] < desiredStoneTools && tribe.resources[ResourceType.Wood] > 12 && tribe.resources[ResourceType.Stone] > 8) {
      this.enqueueCraftJob(tribe, ResourceType.StoneTools, 4, { [ResourceType.Wood]: 4, [ResourceType.Stone]: 4 }, BuildingType.Workshop, 5);
    }
    if (tribe.age >= AgeType.Stone && tribe.resources[ResourceType.Planks] < Math.max(4, Math.floor(buildBacklog * 0.7)) && tribe.resources[ResourceType.Wood] > 18) {
      this.enqueueCraftJob(tribe, ResourceType.Planks, 4, { [ResourceType.Wood]: 8 }, BuildingType.Workshop, 5);
    }
    if (tribe.age >= AgeType.Bronze && tribe.resources[ResourceType.BronzeTools] < desiredBronzeTools && tribe.resources[ResourceType.Ore] > 8 && tribe.resources[ResourceType.Wood] > 6) {
      this.enqueueCraftJob(tribe, ResourceType.BronzeTools, 3, { [ResourceType.Ore]: 4, [ResourceType.Wood]: 2 }, BuildingType.Workshop, 4);
    }
    if (tribe.age >= AgeType.Iron && tribe.resources[ResourceType.IronTools] < desiredIronTools && tribe.resources[ResourceType.Ore] > 10 && tribe.resources[ResourceType.Wood] > 4) {
      this.enqueueCraftJob(tribe, ResourceType.IronTools, 3, { [ResourceType.Ore]: 6, [ResourceType.Wood]: 2 }, BuildingType.Smithy, 5);
    }
    if (tribe.age >= AgeType.Bronze && tribe.resources[ResourceType.Charcoal] < Math.max(12, Math.floor(population * 0.45)) && tribe.resources[ResourceType.Wood] > 22) {
      this.enqueueCraftJob(tribe, ResourceType.Charcoal, 4, { [ResourceType.Wood]: 10 }, BuildingType.Workshop, 5);
    }
    if (tribe.age >= AgeType.Bronze && tribe.resources[ResourceType.Bricks] < Math.max(10, Math.floor(buildBacklog * 0.5)) && tribe.resources[ResourceType.Clay] > 8 && tribe.resources[ResourceType.Stone] > 8) {
      this.enqueueCraftJob(tribe, ResourceType.Bricks, 4, { [ResourceType.Clay]: 5, [ResourceType.Stone]: 3 }, BuildingType.Workshop, 5);
    }
    if (
      tribe.age >= AgeType.Bronze
      && tribe.resources[ResourceType.BasicWeapons] < desiredBasicWeapons
      && tribe.resources[ResourceType.Ore] > 12
      && tribe.resources[ResourceType.Wood] > 8
    ) {
      this.enqueueCraftJob(
        tribe,
        ResourceType.BasicWeapons,
        this.hasBuilt(tribe.id, BuildingType.Armory) ? 4 : 3,
        { [ResourceType.Ore]: 6, [ResourceType.Wood]: 3 },
        this.hasBuilt(tribe.id, BuildingType.Armory) ? BuildingType.Armory : BuildingType.Smithy,
        7,
      );
    }
    if (
      tribe.age >= AgeType.Bronze
      && tribe.resources[ResourceType.BasicArmor] < desiredBasicArmor
      && tribe.resources[ResourceType.Ore] > 12
      && tribe.resources[ResourceType.Wood] > 8
    ) {
      this.enqueueCraftJob(
        tribe,
        ResourceType.BasicArmor,
        this.hasBuilt(tribe.id, BuildingType.Armory) ? 4 : 3,
        { [ResourceType.Ore]: 6, [ResourceType.Wood]: 3 },
        this.hasBuilt(tribe.id, BuildingType.Armory) ? BuildingType.Armory : BuildingType.Smithy,
        6,
      );
    }
    if (tribe.age >= AgeType.Iron && tribe.resources[ResourceType.Ore] > 18) {
      const militaryShop = this.hasBuilt(tribe.id, BuildingType.Armory) ? BuildingType.Armory : BuildingType.Smithy;
      if (tribe.resources[ResourceType.MetalWeapons] < desiredMetalWeapons) {
        this.enqueueCraftJob(tribe, ResourceType.MetalWeapons, this.hasBuilt(tribe.id, BuildingType.Armory) ? 3 : 2, { [ResourceType.Ore]: 8, [ResourceType.Wood]: 2 }, militaryShop, 6);
      }
      if (tribe.resources[ResourceType.MetalArmor] < desiredMetalArmor) {
        this.enqueueCraftJob(tribe, ResourceType.MetalArmor, this.hasBuilt(tribe.id, BuildingType.Armory) ? 3 : 2, { [ResourceType.Ore]: 8, [ResourceType.Wood]: 2 }, militaryShop, 6);
      }
    }
    if (tribe.age >= AgeType.Gunpowder && this.hasBuilt(tribe.id, BuildingType.Foundry) && tribe.resources[ResourceType.Ore] > 22 && tribe.resources[ResourceType.Charcoal] > 6) {
      this.enqueueCraftJob(tribe, ResourceType.MetalWeapons, 5, { [ResourceType.Ore]: 10, [ResourceType.Charcoal]: 4, [ResourceType.Wood]: 2 }, BuildingType.Foundry, 7);
      this.enqueueCraftJob(tribe, ResourceType.MetalArmor, 4, { [ResourceType.Ore]: 10, [ResourceType.Charcoal]: 3, [ResourceType.Wood]: 2 }, BuildingType.Foundry, 7);
    }
    if (tribe.age >= AgeType.Industrial && this.hasBuilt(tribe.id, BuildingType.Factory) && tribe.resources[ResourceType.Ore] > 28 && tribe.resources[ResourceType.Charcoal] > 10 && tribe.resources[ResourceType.Bricks] > 4) {
      this.enqueueCraftJob(tribe, ResourceType.MetalWeapons, 7, { [ResourceType.Ore]: 12, [ResourceType.Charcoal]: 5, [ResourceType.Bricks]: 2 }, BuildingType.Factory, 8);
      this.enqueueCraftJob(tribe, ResourceType.MetalArmor, 6, { [ResourceType.Ore]: 12, [ResourceType.Charcoal]: 4, [ResourceType.Bricks]: 2 }, BuildingType.Factory, 8);
      this.enqueueCraftJob(tribe, ResourceType.IronTools, 6, { [ResourceType.Ore]: 8, [ResourceType.Charcoal]: 3, [ResourceType.Wood]: 2 }, BuildingType.Factory, 6);
    }
    if (
      tribe.age >= AgeType.Modern &&
      (this.hasBuilt(tribe.id, BuildingType.PowerPlant) || this.hasBuilt(tribe.id, BuildingType.Airfield)) &&
      tribe.resources[ResourceType.Ore] > 34 &&
      tribe.resources[ResourceType.Charcoal] > 12 &&
      tribe.resources[ResourceType.Bricks] > 8
    ) {
      const productionHub = this.hasBuilt(tribe.id, BuildingType.PowerPlant) ? BuildingType.PowerPlant : BuildingType.Factory;
      const logisticsHub = this.hasBuilt(tribe.id, BuildingType.Airfield) ? BuildingType.Airfield : BuildingType.Factory;
      this.enqueueCraftJob(tribe, ResourceType.MetalWeapons, 9, { [ResourceType.Ore]: 16, [ResourceType.Charcoal]: 6, [ResourceType.Bricks]: 3 }, productionHub, 9);
      this.enqueueCraftJob(tribe, ResourceType.MetalArmor, 8, { [ResourceType.Ore]: 15, [ResourceType.Charcoal]: 5, [ResourceType.Bricks]: 3 }, productionHub, 9);
      this.enqueueCraftJob(tribe, ResourceType.IronTools, 8, { [ResourceType.Ore]: 10, [ResourceType.Charcoal]: 4, [ResourceType.Bricks]: 2 }, logisticsHub, 7);
    }
  }

  private ensureBoatsForTribe(tribe: TribeState): void {
    if (tribe.age < AgeType.Medieval) {
      return;
    }

    const docks = this.buildingsForTribe(tribe.id).filter((building) => building.type === BuildingType.Dock);
    if (docks.length === 0) {
      return;
    }

    const desiredBoats = docks.length * 2 + this.buildingCount(tribe.id, BuildingType.Fishery);
    const existingBoats = this.boats.filter((boat) => boat.tribeId === tribe.id).length;
    if (existingBoats >= desiredBoats) {
      return;
    }
    if (tribe.resources[ResourceType.Wood] < 16 || tribe.resources[ResourceType.Planks] < 6) {
      return;
    }

    const dock = docks.find((entry) => !this.boats.some((boat) => boat.dockBuildingId === entry.id)) ?? docks[0];
    if (!dock) {
      return;
    }
    const waterTile = this.findDockWaterTile(dock);
    if (!waterTile) {
      return;
    }

    tribe.resources[ResourceType.Wood] -= 16;
    tribe.resources[ResourceType.Planks] -= 6;
    this.boats.push({
      id: this.nextBoatId++,
      tribeId: tribe.id,
      dockBuildingId: dock.id,
      x: waterTile.x,
      y: waterTile.y,
      dockX: waterTile.x,
      dockY: waterTile.y,
      targetX: waterTile.x,
      targetY: waterTile.y,
      path: [],
      pathIndex: 0,
      cargo: 0,
      task: BoatTaskType.Idle,
      moveCooldown: 0,
    });
  }

  private ensureWagonsForTribe(tribe: TribeState): void {
    if (tribe.age < AgeType.Bronze) {
      return;
    }
    if (tribe.resources[ResourceType.Horses] <= 0) {
      return;
    }
    const depots = this.buildingsForTribe(tribe.id).filter((building) =>
      (building.type === BuildingType.Warehouse || building.type === BuildingType.Stockpile || building.type === BuildingType.CapitalHall),
    );
    if (depots.length === 0) {
      return;
    }
    const activeHauls = this.jobs.filter((job) => job.tribeId === tribe.id && job.kind === "haul").length;
    if (activeHauls < 3) {
      return;
    }
    const desiredWagons = Math.min(
      7,
      depots.length + Math.floor(this.buildingCount(tribe.id, BuildingType.Stable) / 2) + this.buildingCount(tribe.id, BuildingType.RailDepot) * 2 + this.buildingCount(tribe.id, BuildingType.PowerPlant) + Math.floor(activeHauls / 6),
    );
    const existingWagons = this.wagons.filter((wagon) => wagon.tribeId === tribe.id).length;
    if (existingWagons >= desiredWagons) {
      return;
    }
    if (tribe.resources[ResourceType.Wood] < 10 || tribe.resources[ResourceType.Planks] < 4) {
      return;
    }

    const home = depots.find((building) => !this.wagons.some((wagon) => wagon.homeBuildingId === building.id)) ?? depots[0];
    if (!home) return;
    const center = buildingCenter(home);
    tribe.resources[ResourceType.Wood] -= 10;
    tribe.resources[ResourceType.Planks] -= 4;
    this.wagons.push({
      id: this.nextWagonId++,
      tribeId: tribe.id,
      homeBuildingId: home.id,
      x: center.x,
      y: center.y,
      homeX: center.x,
      homeY: center.y,
      targetX: center.x,
      targetY: center.y,
      path: [],
      pathIndex: 0,
      cargoType: ResourceType.None,
      cargoAmount: 0,
      task: WagonTaskType.Idle,
      targetJobId: null,
      moveCooldown: 0,
    });
  }

  private tradePreferenceForRace(race: RaceType): ResourceType[] {
    switch (race) {
      case RaceType.Humans:
        return [ResourceType.Grain, ResourceType.Rations, ResourceType.Planks, ResourceType.BasicWeapons];
      case RaceType.Elves:
        return [ResourceType.Berries, ResourceType.Grain, ResourceType.Planks, ResourceType.IronTools];
      case RaceType.Dwarves:
        return [ResourceType.Stone, ResourceType.Ore, ResourceType.Bricks, ResourceType.MetalWeapons];
      case RaceType.Orcs:
        return [ResourceType.Meat, ResourceType.Wood, ResourceType.BasicWeapons, ResourceType.BasicArmor];
      case RaceType.Goblins:
        return [ResourceType.Ore, ResourceType.Charcoal, ResourceType.BasicWeapons, ResourceType.BronzeTools];
      case RaceType.Halflings:
        return [ResourceType.Grain, ResourceType.Berries, ResourceType.Rations, ResourceType.Planks];
      case RaceType.Nomads:
        return [ResourceType.Horses, ResourceType.Livestock, ResourceType.Meat, ResourceType.Grain];
      case RaceType.Darkfolk:
        return [ResourceType.Ore, ResourceType.Bricks, ResourceType.Charcoal, ResourceType.MetalArmor];
      default:
        return [ResourceType.Rations];
    }
  }

  private minimumTradeReserve(tribe: TribeState, type: ResourceType): number {
    const population = this.populationOf(tribe.id);
    switch (type) {
      case ResourceType.Rations:
        return Math.max(72, Math.floor(population * 5));
      case ResourceType.Grain:
      case ResourceType.Berries:
      case ResourceType.Fish:
      case ResourceType.Meat:
        return Math.max(24, Math.floor(population * 1.5));
      case ResourceType.Wood:
      case ResourceType.Stone:
        return Math.max(48, Math.floor(population * 2.5));
      case ResourceType.Ore:
        return tribe.age >= AgeType.Bronze ? Math.max(22, Math.floor(population * 1.2)) : 0;
      case ResourceType.Planks:
      case ResourceType.Bricks:
      case ResourceType.Charcoal:
        return tribe.age >= AgeType.Bronze ? 14 : 6;
      case ResourceType.StoneTools:
      case ResourceType.BronzeTools:
      case ResourceType.IronTools:
        return Math.max(6, Math.floor(population * 0.25));
      case ResourceType.BasicWeapons:
      case ResourceType.BasicArmor:
        return Math.max(6, Math.floor(population * 0.25));
      case ResourceType.MetalWeapons:
      case ResourceType.MetalArmor:
        return tribe.age >= AgeType.Iron ? Math.max(8, Math.floor(population * 0.18)) : 0;
      case ResourceType.Horses:
      case ResourceType.Livestock:
        return 4;
      default:
        return 8;
    }
  }

  private primaryInputResource(inputs: Partial<Record<ResourceType, number>>): ResourceType {
    let bestResource = ResourceType.None;
    let bestAmount = -1;
    for (const [resource, amount] of Object.entries(inputs)) {
      const numericResource = Number(resource) as ResourceType;
      const numericAmount = amount ?? 0;
      if (numericAmount > bestAmount) {
        bestAmount = numericAmount;
        bestResource = numericResource;
      }
    }
    return bestResource;
  }

  private tradePreferenceBonus(tribe: TribeState, type: ResourceType): number {
    const order = this.tradePreferenceForRace(tribe.race.type);
    const index = order.indexOf(type);
    return index >= 0 ? Math.max(0, order.length - index) * 3 : 0;
  }

  private tradeNeedScore(tribe: TribeState, type: ResourceType): number {
    const reserve = this.minimumTradeReserve(tribe, type);
    return Math.max(0, reserve - tribe.resources[type]) + this.tradePreferenceBonus(tribe, type);
  }

  private chooseTradeCargo(tribe: TribeState, partner?: TribeState): ResourceType {
    const candidates = new Set<ResourceType>([
      ...this.tradePreferenceForRace(tribe.race.type),
      ResourceType.Rations,
      ResourceType.Grain,
      ResourceType.Wood,
      ResourceType.Stone,
      ResourceType.Ore,
      ResourceType.Planks,
      ResourceType.Bricks,
      ResourceType.Charcoal,
      ResourceType.Horses,
      ResourceType.Livestock,
      ResourceType.BasicWeapons,
      ResourceType.MetalWeapons,
    ]);

    let bestResource = ResourceType.Rations;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const resource of candidates) {
      const surplus = tribe.resources[resource] - this.minimumTradeReserve(tribe, resource);
      if (surplus <= 0) continue;
      const partnerNeed = partner ? this.tradeNeedScore(partner, resource) : 0;
      const score = surplus * 0.7 + partnerNeed * 1.2 + this.tradePreferenceBonus(tribe, resource);
      if (score > bestScore) {
        bestScore = score;
        bestResource = resource;
      }
    }
    return bestResource;
  }

  private chooseTradeCargoAmount(exporter: TribeState, importer: TribeState, resource: ResourceType): number {
    const reserve = this.minimumTradeReserve(exporter, resource);
    const surplus = Math.max(0, exporter.resources[resource] - reserve);
    const need = Math.max(0, this.minimumTradeReserve(importer, resource) - importer.resources[resource]);
    const desired = Math.max(4, Math.floor(need * 0.6) + 4);
    return clamp(Math.min(surplus, desired), 4, 18);
  }

  private ensureCaravansForTribe(tribe: TribeState): void {
    if (tribe.age < AgeType.Stone) {
      return;
    }
    const partners = this.tribes
      .filter((other) => other.id !== tribe.id && tribe.discovered[other.id] && tribe.tradePacts[other.id] && diplomacyStateFromScore(tribe.relations[other.id]!) >= DiplomacyState.Neutral)
      .sort((a, b) => manhattan(tribe.capitalX, tribe.capitalY, a.capitalX, a.capitalY) - manhattan(tribe.capitalX, tribe.capitalY, b.capitalX, b.capitalY));
    if (partners.length === 0) {
      return;
    }
    const desired = Math.min(3 + this.buildingCount(tribe.id, BuildingType.Airfield), partners.length + (this.buildingCount(tribe.id, BuildingType.Airfield) > 0 ? 1 : 0));
    const existing = this.caravans.filter((caravan) => caravan.tribeId === tribe.id).length;
    if (existing >= desired) {
      return;
    }
    if (!(this.hasBuilt(tribe.id, BuildingType.Stockpile) || this.hasBuilt(tribe.id, BuildingType.Warehouse)) || !this.hasBuilt(tribe.id, BuildingType.House)) {
      return;
    }

    const partner = partners.find((other) => !this.caravans.some((caravan) => caravan.tribeId === tribe.id && caravan.partnerTribeId === other.id)) ?? partners[0];
    if (!partner) return;

    const tribeBuildings = this.buildingsForTribe(tribe.id);
    const stock = tribeBuildings.find((building) => building.type === BuildingType.Warehouse)
      ?? tribeBuildings.find((building) => building.type === BuildingType.Stockpile)
      ?? tribeBuildings.find((building) => building.type === BuildingType.CapitalHall);
    if (!stock) return;

    const cargoType = this.chooseTradeCargo(tribe, partner);
    const cargoAmount = this.chooseTradeCargoAmount(tribe, partner, cargoType);
    if (tribe.resources[cargoType] < cargoAmount) {
      return;
    }
    const startX = stock.x + Math.floor(stock.width / 2);
    const startY = stock.y + Math.floor(stock.height / 2);
    const path = findPath(this.world, startX, startY, partner.capitalX, partner.capitalY);
    if (path.length <= 1) {
      return;
    }
    tribe.resources[cargoType] -= cargoAmount;
    this.caravans.push({
      id: this.nextCaravanId++,
      tribeId: tribe.id,
      partnerTribeId: partner.id,
      x: startX,
      y: startY,
      homeX: startX,
      homeY: startY,
      targetX: partner.capitalX,
      targetY: partner.capitalY,
      path,
      pathIndex: 0,
      cargoType,
      cargoAmount,
      task: CaravanTaskType.ToPartner,
      moveCooldown: 0,
    });
  }

  private militaryObjectivePriority(type: BuildingType): number {
    switch (type) {
      case BuildingType.Warehouse:
      case BuildingType.Stockpile:
        return 18;
      case BuildingType.Farm:
      case BuildingType.Orchard:
      case BuildingType.FishingHut:
      case BuildingType.Fishery:
        return 16;
      case BuildingType.LumberCamp:
      case BuildingType.Quarry:
      case BuildingType.Mine:
      case BuildingType.DeepMine:
        return 15;
      case BuildingType.Barracks:
      case BuildingType.Armory:
      case BuildingType.Watchtower:
      case BuildingType.Castle:
        return 17;
      case BuildingType.CapitalHall:
        return 12;
      default:
        return 8;
    }
  }

  private chooseMilitaryObjective(tribe: TribeState, enemy: TribeState): { x: number; y: number } {
    const enemyBuildings = this.buildingsForTribe(enemy.id)
      .filter((building) => building.type !== BuildingType.House && building.type !== BuildingType.MountainHall)
      .sort((a, b) => {
        const centerA = buildingCenter(a);
        const centerB = buildingCenter(b);
        const scoreA = this.militaryObjectivePriority(a.type) - manhattan(tribe.capitalX, tribe.capitalY, centerA.x, centerA.y) * 0.02;
        const scoreB = this.militaryObjectivePriority(b.type) - manhattan(tribe.capitalX, tribe.capitalY, centerB.x, centerB.y) * 0.02;
        return scoreB - scoreA;
      });
    const target = enemyBuildings[0];
    if (target) {
      return buildingCenter(target);
    }
    return {
      x: Math.floor((tribe.capitalX + enemy.capitalX) / 2),
      y: Math.floor((tribe.capitalY + enemy.capitalY) / 2),
    };
  }

  private militaryFormationPoint(originX: number, originY: number, targetX: number, targetY: number, index: number, total: number, spacing = 2): { x: number; y: number } {
    const dx = Math.sign(targetX - originX);
    const dy = Math.sign(targetY - originY);
    const lineX = dy === 0 ? 0 : -dy;
    const lineY = dx === 0 ? 0 : dx;
    const centerOffset = index - Math.floor((total - 1) / 2);
    const rank = Math.floor(index / 3);
    return {
      x: clamp(originX + lineX * centerOffset * spacing - dx * rank, 1, this.world.width - 2),
      y: clamp(originY + lineY * centerOffset * spacing - dy * rank, 1, this.world.height - 2),
    };
  }

  private canSustainCampaign(tribe: TribeState, enemy: TribeState): boolean {
    const population = this.populationOf(tribe.id);
    const fighters = this.agentsForTribe(tribe.id).filter((agent) => agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider || agent.role === AgentRole.Mage).length;
    const foodSecure = tribe.resources[ResourceType.Rations] > population * 4.2;
    const waterSecure = tribe.water > Math.max(16, population * 0.55);
    const ownPower = this.tribeStrategicPower(tribe);
    const enemyPower = this.tribeStrategicPower(enemy);
    return fighters >= 4 && foodSecure && waterSecure && tribe.morale > 42 && ownPower >= enemyPower * 0.78;
  }

  private ensureSiegeForTribe(tribe: TribeState): void {
    if (tribe.age < AgeType.Medieval) {
      return;
    }
    if (!this.hasBuilt(tribe.id, BuildingType.Barracks) || !(this.hasBuilt(tribe.id, BuildingType.Workshop) || this.hasBuilt(tribe.id, BuildingType.Armory) || this.hasBuilt(tribe.id, BuildingType.Foundry) || this.hasBuilt(tribe.id, BuildingType.Factory))) {
      return;
    }
    const enemies = tribe.relations.filter((score, index) => index !== tribe.id && diplomacyStateFromScore(score) >= DiplomacyState.Hostile).length;
    if (enemies === 0) {
      return;
    }
    const desired = Math.min(4, 1 + Math.floor(enemies / 2));
    const existing = this.siegeEngines.filter((engine) => engine.tribeId === tribe.id).length;
    if (existing >= desired) {
      return;
    }
    const type = this.chooseSiegeEngineType(tribe, existing);
    const cost =
      type === SiegeEngineType.Trebuchet ? { wood: 24, stone: 14, ore: 0 }
      : type === SiegeEngineType.Ballista ? { wood: 20, stone: 10, ore: 6 }
      : type === SiegeEngineType.Cannon ? { wood: 12, stone: 10, ore: 18 }
      : type === SiegeEngineType.Mortar ? { wood: 10, stone: 14, ore: 22 }
      : type === SiegeEngineType.Tank ? { wood: 4, stone: 10, ore: 30 }
      : type === SiegeEngineType.Zeppelin ? { wood: 16, stone: 8, ore: 24 }
      : type === SiegeEngineType.SiegeTower ? { wood: 28, stone: 8, ore: 0 }
      : { wood: 24, stone: 14, ore: 0 };
    if (tribe.resources[ResourceType.Wood] < cost.wood || tribe.resources[ResourceType.Stone] < cost.stone || tribe.resources[ResourceType.Ore] < cost.ore) {
      return;
    }

    const yard = this.buildings.find((building) =>
      building.tribeId === tribe.id
      && building.type === (
        type === SiegeEngineType.Cannon ? BuildingType.Foundry
        : type === SiegeEngineType.Mortar || type === SiegeEngineType.Tank ? BuildingType.Factory
        : type === SiegeEngineType.Zeppelin ? BuildingType.Airfield
        : BuildingType.Barracks
      ))
      ?? this.buildings.find((building) => building.tribeId === tribe.id && building.type === BuildingType.Barracks)
      ?? this.buildings.find((building) => building.tribeId === tribe.id && building.type === BuildingType.Workshop);
    if (!yard) return;

    tribe.resources[ResourceType.Wood] -= cost.wood;
    tribe.resources[ResourceType.Stone] -= cost.stone;
    tribe.resources[ResourceType.Ore] -= cost.ore;
    this.siegeEngines.push({
      id: this.nextSiegeEngineId++,
      tribeId: tribe.id,
      type,
      x: yard.x + Math.floor(yard.width / 2),
      y: yard.y + Math.floor(yard.height / 2),
      targetX: tribe.capitalX,
      targetY: tribe.capitalY,
      path: [],
      pathIndex: 0,
      hp:
        type === SiegeEngineType.Trebuchet ? 80
        : type === SiegeEngineType.Ballista ? 76
        : type === SiegeEngineType.Cannon ? 88
        : type === SiegeEngineType.Mortar ? 92
        : type === SiegeEngineType.Tank ? 124
        : type === SiegeEngineType.Zeppelin ? 84
        : type === SiegeEngineType.SiegeTower ? 110
        : 100,
      moveCooldown: 0,
      task: "idle",
    });
  }

  private chooseSiegeEngineType(tribe: TribeState, existing: number): SiegeEngineType {
    if (tribe.age >= AgeType.Modern && (tribe.race.type === RaceType.Humans || tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Goblins || tribe.race.type === RaceType.Nomads)) {
      if (tribe.race.type === RaceType.Nomads) {
        return existing % 2 === 0 ? SiegeEngineType.Zeppelin : SiegeEngineType.Cannon;
      }
      return existing % 4 === 0 ? SiegeEngineType.Zeppelin : existing % 3 === 0 ? SiegeEngineType.Mortar : existing % 2 === 0 ? SiegeEngineType.Tank : SiegeEngineType.Cannon;
    }
    if (tribe.age >= AgeType.Industrial && (tribe.race.type === RaceType.Humans || tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Goblins)) {
      return existing % 3 === 0 ? SiegeEngineType.Mortar : existing % 2 === 0 ? SiegeEngineType.Cannon : tribe.race.type === RaceType.Dwarves ? SiegeEngineType.Ballista : SiegeEngineType.Trebuchet;
    }
    if (tribe.age >= AgeType.Gunpowder && (tribe.race.type === RaceType.Humans || tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Goblins)) {
      return existing % 2 === 0 ? SiegeEngineType.Cannon : tribe.race.type === RaceType.Dwarves ? SiegeEngineType.Ballista : SiegeEngineType.Trebuchet;
    }
    if (tribe.race.type === RaceType.Dwarves) return existing % 2 === 0 ? SiegeEngineType.Ballista : SiegeEngineType.Trebuchet;
    if (tribe.race.type === RaceType.Orcs || tribe.race.type === RaceType.Goblins) return existing % 2 === 0 ? SiegeEngineType.BatteringRam : SiegeEngineType.SiegeTower;
    if (tribe.race.type === RaceType.Elves) return SiegeEngineType.Ballista;
    if (tribe.race.type === RaceType.Humans) return existing % 2 === 0 ? SiegeEngineType.Trebuchet : SiegeEngineType.SiegeTower;
    return existing % 2 === 0 ? SiegeEngineType.Trebuchet : SiegeEngineType.BatteringRam;
  }

  private findDockWaterTile(dock: BuildingState): { x: number; y: number } | null {
    for (let radius = 1; radius <= 3; radius += 1) {
      for (let dy = -radius; dy <= dock.height + radius; dy += 1) {
        for (let dx = -radius; dx <= dock.width + radius; dx += 1) {
          const x = dock.x + dx;
          const y = dock.y + dy;
          if (!inBounds(x, y, this.world.width, this.world.height)) continue;
          const terrain = this.world.terrain[indexOf(x, y, this.world.width)];
          if (isWaterTerrain(terrain)) {
            return { x, y };
          }
        }
      }
    }
    return null;
  }

  private assignBoatRoute(boat: BoatState, dock: BuildingState): void {
    const target = this.findNearestFishWaterTile(dock.x, dock.y, 56);
    if (!target) {
      boat.path = [];
      boat.pathIndex = 0;
      boat.targetX = boat.dockX;
      boat.targetY = boat.dockY;
      boat.task = BoatTaskType.Idle;
      return;
    }

    const path = findPath(this.world, boat.x, boat.y, target.x, target.y, "water", 180);
    if (path.length <= 1) {
      boat.task = BoatTaskType.Idle;
      return;
    }
    boat.targetX = target.x;
    boat.targetY = target.y;
    boat.path = path;
    boat.pathIndex = 0;
    boat.task = BoatTaskType.ToFish;
  }

  private findNearestFishWaterTile(originX: number, originY: number, radius: number): { x: number; y: number } | null {
    let best: { x: number; y: number; score: number } | null = null;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = originX + dx;
        const y = originY + dy;
        if (!inBounds(x, y, this.world.width, this.world.height)) continue;
        const tileIndex = indexOf(x, y, this.world.width);
        if (!isWaterTerrain(this.world.terrain[tileIndex])) continue;
        if (this.world.feature[tileIndex] !== FeatureType.FishShoal && this.world.resourceType[tileIndex] !== ResourceType.Fish) continue;
        const score = manhattan(originX, originY, x, y) - this.world.resourceAmount[tileIndex] * 0.02;
        if (!best || score < best.score) {
          best = { x, y, score };
        }
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  private harvestBoatFish(x: number, y: number): number {
    const targetIndex = indexOf(x, y, this.world.width);
    const available = this.world.resourceAmount[targetIndex];
    if (available > 0) {
      const amount = Math.min(18, available);
      this.world.resourceAmount[targetIndex] -= amount;
      if (this.world.resourceAmount[targetIndex] <= 0) {
        this.world.feature[targetIndex] = FeatureType.None;
        this.world.resourceType[targetIndex] = ResourceType.None;
      }
      this.markDirty(targetIndex);
      return amount;
    }
    return 8;
  }

  private generateMilitaryPlans(tribe: TribeState): void {
    if (tribe.age < AgeType.Bronze || this.currentYear < 2) {
      return;
    }
    const fighters = this.agentsForTribe(tribe.id).filter((agent) => agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider || agent.role === AgentRole.Mage).length;
    if (fighters < 3) {
      return;
    }
    const enemies = this.tribes
      .filter((other) => other.id !== tribe.id && tribe.discovered[other.id] && diplomacyStateFromScore(tribe.relations[other.id]!) >= DiplomacyState.Hostile)
      .sort((a, b) => manhattan(tribe.capitalX, tribe.capitalY, a.capitalX, a.capitalY) - manhattan(tribe.capitalX, tribe.capitalY, b.capitalX, b.capitalY));

    if (enemies.length === 0) {
      return;
    }

    const enemy = enemies[0]!;
    const state = diplomacyStateFromScore(tribe.relations[enemy.id]!);
    const objective = this.chooseMilitaryObjective(tribe, enemy);
    const canAttack = state === DiplomacyState.War && this.canSustainCampaign(tribe, enemy);
    if (!canAttack && state !== DiplomacyState.Hostile) {
      return;
    }
    const kind: JobKind = canAttack ? "attack" : "patrol";
    const frontX = canAttack ? clamp(objective.x - Math.sign(objective.x - tribe.capitalX) * 2, 1, this.world.width - 2) : Math.floor((tribe.capitalX + enemy.capitalX) / 2);
    const frontY = canAttack ? clamp(objective.y - Math.sign(objective.y - tribe.capitalY) * 2, 1, this.world.height - 2) : Math.floor((tribe.capitalY + enemy.capitalY) / 2);
    const desiredJobs = clamp(Math.floor(fighters * (canAttack ? 0.55 : 0.35)), canAttack ? 4 : 3, canAttack ? 8 : 5);
    for (let i = 0; i < desiredJobs; i += 1) {
      const rally = this.militaryFormationPoint(frontX, frontY, objective.x, objective.y, i, desiredJobs);
      this.jobs.push({
        id: this.nextJobId++,
        tribeId: tribe.id,
        kind,
        x: rally.x,
        y: rally.y,
        priority: kind === "attack" ? 10 : 6,
        claimedBy: null,
        payload: { targetTribeId: enemy.id, targetX: objective.x, targetY: objective.y },
      });
    }
  }

  private generateAdventurePlans(tribe: TribeState): void {
    if (tribe.age < AgeType.Bronze) {
      return;
    }
    if (this.jobs.filter((job) => job.tribeId === tribe.id && job.kind === "dungeon").length >= 2) {
      return;
    }
    const candidates = this.dungeons
      .filter((dungeon) => dungeon.exploredBy !== tribe.id)
      .sort((a, b) => manhattan(tribe.capitalX, tribe.capitalY, a.x, a.y) - manhattan(tribe.capitalX, tribe.capitalY, b.x, b.y));
    const target = candidates[0];
    if (!target) return;
    this.jobs.push({
      id: this.nextJobId++,
      tribeId: tribe.id,
      kind: "dungeon",
      x: target.x,
      y: target.y,
      priority: 4 + target.lootTier,
      claimedBy: null,
    });
  }

  private generateDelvePlans(tribe: TribeState): void {
    if (!(this.hasBuilt(tribe.id, BuildingType.TunnelEntrance) || this.hasBuilt(tribe.id, BuildingType.DeepMine))) {
      return;
    }
    const existing = this.jobs.filter((job) => job.tribeId === tribe.id && job.kind === "delve").length;
    const desired = tribe.age >= AgeType.Iron ? 2 : 1;
    if (existing >= desired) {
      return;
    }

    const sites = this.buildings
      .filter((building) => building.tribeId === tribe.id && (building.type === BuildingType.TunnelEntrance || building.type === BuildingType.DeepMine))
      .sort((a, b) => Number(b.type === BuildingType.DeepMine) - Number(a.type === BuildingType.DeepMine));
    if (sites.length === 0) {
      return;
    }

    for (let i = existing; i < desired; i += 1) {
      const site = sites[i % sites.length]!;
      const center = buildingCenter(site);
      if (this.jobs.some((job) => job.tribeId === tribe.id && job.kind === "delve" && job.x === center.x && job.y === center.y)) {
        continue;
      }
      const pressure = tribe.resources[ResourceType.Ore] < 50 ? 3 : 0;
      const science = this.hasBuilt(tribe.id, BuildingType.School) ? 1 : 0;
      this.jobs.push({
        id: this.nextJobId++,
        tribeId: tribe.id,
        kind: "delve",
        x: center.x,
        y: center.y,
        priority: 4 + pressure + science + (site.type === BuildingType.DeepMine ? 2 : 0),
        claimedBy: null,
      });
    }
  }

  private enqueueEarthworkJob(tribe: TribeState, x: number, y: number, kind: EarthworkKind, priority: number): void {
    if (this.jobs.some((job) => job.tribeId === tribe.id && job.kind === "earthwork" && job.x === x && job.y === y)) {
      return;
    }
    this.jobs.push({
      id: this.nextJobId++,
      tribeId: tribe.id,
      kind: "earthwork",
      x,
      y,
      priority,
      claimedBy: null,
      payload: { kind },
    });
  }

  private canPlaceEarthwork(x: number, y: number, kind: EarthworkKind): boolean {
    if (!inBounds(x, y, this.world.width, this.world.height)) return false;
    const index = indexOf(x, y, this.world.width);
    const terrain = this.world.terrain[index];
    const feature = this.world.feature[index];
    if (this.world.buildingByTile[index] >= 0) return false;
    if (terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow || terrain === TerrainType.River || terrain === TerrainType.Lava || terrain === TerrainType.Mountain) return false;
    if (feature === FeatureType.Volcano || feature === FeatureType.Trees || feature === FeatureType.OreVein || feature === FeatureType.StoneOutcrop) return false;
    if (kind === "canal") {
      return feature !== FeatureType.IrrigationCanal && feature !== FeatureType.Palisade && feature !== FeatureType.StoneWall && feature !== FeatureType.Gate;
    }
    if (kind === "trench") {
      return feature === FeatureType.None || feature === FeatureType.Trench;
    }
    return feature === FeatureType.None || feature === FeatureType.Trench || feature === FeatureType.Palisade || feature === FeatureType.Gate;
  }

  private enqueueNearbyFeatureJobs(tribe: TribeState, feature: FeatureType, kind: JobKind, radius: number, limit: number): void {
    this.enqueueFeatureJobsAround(tribe, tribe.capitalX, tribe.capitalY, feature, kind, radius, limit);
  }

  private enqueueFeatureJobsAround(
    tribe: TribeState,
    originX: number,
    originY: number,
    feature: FeatureType,
    kind: JobKind,
    radius: number,
    limit: number,
  ): number {
    let count = 0;
    for (let dy = -radius; dy <= radius && count < limit; dy += 1) {
      for (let dx = -radius; dx <= radius && count < limit; dx += 1) {
        const x = originX + dx;
        const y = originY + dy;
        if (!inBounds(x, y, this.world.width, this.world.height)) continue;
        const index = indexOf(x, y, this.world.width);
        if (this.world.feature[index] !== feature) continue;
        if (this.jobs.some((job) => job.x === x && job.y === y && job.kind === kind && job.tribeId === tribe.id)) continue;
        this.jobs.push({
          id: this.nextJobId++,
          tribeId: tribe.id,
          kind,
          x,
          y,
          priority: 4 + Math.max(0, radius - manhattan(originX, originY, x, y)) * 0.1,
          claimedBy: null,
        });
        count += 1;
      }
    }
    return count;
  }

  private enqueueNearbyResourceJobs(tribe: TribeState, resourceTypes: ResourceType[], kind: JobKind, radius: number, limit: number): void {
    this.enqueueResourceJobsAround(tribe, tribe.capitalX, tribe.capitalY, resourceTypes, kind, radius, limit);
  }

  private enqueueResourceJobsAround(
    tribe: TribeState,
    originX: number,
    originY: number,
    resourceTypes: ResourceType[],
    kind: JobKind,
    radius: number,
    limit: number,
  ): number {
    let count = 0;
    for (let dy = -radius; dy <= radius && count < limit; dy += 1) {
      for (let dx = -radius; dx <= radius && count < limit; dx += 1) {
        const x = originX + dx;
        const y = originY + dy;
        if (!inBounds(x, y, this.world.width, this.world.height)) continue;
        const index = indexOf(x, y, this.world.width);
        const resourceType = this.world.resourceType[index] as ResourceType;
        if (!resourceTypes.includes(resourceType) || this.world.resourceAmount[index] <= 0) continue;
        if (this.jobs.some((job) => job.x === x && job.y === y && job.kind === kind && job.tribeId === tribe.id)) continue;
        this.jobs.push({
          id: this.nextJobId++,
          tribeId: tribe.id,
          kind,
          x,
          y,
          priority: 4.5 + Math.max(0, radius - manhattan(originX, originY, x, y)) * 0.12,
          claimedBy: null,
          payload: {
            resourceType,
          },
        });
        count += 1;
      }
    }
    return count;
  }

  private enqueueNearbyWaterJobs(tribe: TribeState, kind: JobKind, limit: number): void {
    this.enqueueWaterJobsAround(tribe, tribe.capitalX, tribe.capitalY, kind, MAX_JOB_RADIUS, limit);
  }

  private enqueueWaterJobsAround(tribe: TribeState, originX: number, originY: number, kind: JobKind, radius: number, limit: number): number {
    let count = 0;
    for (let dy = -radius; dy <= radius && count < limit; dy += 1) {
      for (let dx = -radius; dx <= radius && count < limit; dx += 1) {
        const x = originX + dx;
        const y = originY + dy;
        if (!inBounds(x, y, this.world.width, this.world.height)) continue;
        const index = indexOf(x, y, this.world.width);
        if (!isWaterTerrain(this.world.terrain[index])) continue;
        if (this.jobs.some((job) => job.x === x && job.y === y && job.kind === kind && job.tribeId === tribe.id)) continue;
        this.jobs.push({
          id: this.nextJobId++,
          tribeId: tribe.id,
          kind,
          x,
          y,
          priority: 4 + Math.max(0, radius - manhattan(originX, originY, x, y)) * 0.08,
          claimedBy: null,
        });
        count += 1;
      }
    }
    return count;
  }

  private enqueueAnimalJobs(tribe: TribeState, types: AnimalType[], kind: JobKind, radius: number, limit: number): void {
    let count = 0;
    for (const animal of this.animals) {
      if (count >= limit) break;
      if (!types.includes(animal.type)) continue;
      if (manhattan(tribe.capitalX, tribe.capitalY, animal.x, animal.y) > radius) continue;
      if (this.jobs.some((job) => job.x === animal.x && job.y === animal.y && job.kind === kind && job.tribeId === tribe.id)) continue;
      this.jobs.push({
        id: this.nextJobId++,
        tribeId: tribe.id,
        kind,
        x: animal.x,
        y: animal.y,
        priority: 5,
        claimedBy: null,
      });
      count += 1;
    }
  }

  private enqueueReplantJobs(tribe: TribeState, limit: number): void {
    let count = 0;
    for (let dy = -16; dy <= 16 && count < limit; dy += 1) {
      for (let dx = -16; dx <= 16 && count < limit; dx += 1) {
        const x = tribe.capitalX + dx;
        const y = tribe.capitalY + dy;
        if (!inBounds(x, y, this.world.width, this.world.height)) continue;
        const index = indexOf(x, y, this.world.width);
        if (this.world.terrain[index] !== TerrainType.ForestFloor && this.world.biome[index] !== BiomeType.DeepForest) continue;
        if (this.world.feature[index] !== FeatureType.None) continue;
        if (this.jobs.some((job) => job.x === x && job.y === y && job.kind === "replant_tree" && job.tribeId === tribe.id)) continue;
        this.jobs.push({
          id: this.nextJobId++,
          tribeId: tribe.id,
          kind: "replant_tree",
          x,
          y,
          priority: 3,
          claimedBy: null,
        });
        count += 1;
      }
    }
  }

  private enqueueCraftJob(
    tribe: TribeState,
    output: ResourceType,
    amount: number,
    inputs: Partial<Record<ResourceType, number>>,
    preferredBuildingType: BuildingType,
    limit = 3,
  ): void {
    if (this.jobs.filter((job) => job.tribeId === tribe.id && job.kind === "craft").length >= limit) {
      return;
    }
    if (this.jobs.some((job) => job.tribeId === tribe.id && job.kind === "craft" && (job.payload as CraftPayload | undefined)?.output === output)) {
      return;
    }

    for (const [resource, needed] of Object.entries(inputs)) {
      if (tribe.resources[Number(resource)] < (needed ?? 0)) {
        return;
      }
    }

    const building = this.buildings.find((entry) => entry.tribeId === tribe.id && entry.type === preferredBuildingType)
      ?? this.buildings.find((entry) => entry.tribeId === tribe.id && entry.type === BuildingType.Workshop)
      ?? this.buildings.find((entry) => entry.tribeId === tribe.id && entry.type === BuildingType.CapitalHall);

    if (!building) return;

    const stock = this.findNearestStorageSite(tribe.id, building.x, building.y, this.primaryInputResource(inputs));
    const haulSpecs = this.constructionHaulPlan(inputs);

    for (const [resource, amountNeeded] of Object.entries(inputs)) {
      tribe.resources[Number(resource)] -= amountNeeded ?? 0;
    }

    const center = buildingCenter(building);
    const craftJobId = this.nextJobId++;

    this.jobs.push({
      id: craftJobId,
      tribeId: tribe.id,
      kind: "craft",
      x: center.x,
      y: center.y,
      priority: 5,
      claimedBy: null,
      payload: {
        buildingId: building.id,
        output,
        amount,
        inputs,
        supplied: 0,
        supplyNeeded: Math.max(1, haulSpecs.length),
        stockX: stock.x,
        stockY: stock.y,
      },
    });
    for (const haul of haulSpecs) {
      const sourceBuilding = this.findStockedSourceBuilding(tribe.id, center.x, center.y, haul.resourceType);
      const sourceSite = sourceBuilding ? buildingCenter(sourceBuilding) : this.findNearestStorageSite(tribe.id, center.x, center.y, haul.resourceType);
      this.jobs.push({
        id: this.nextJobId++,
        tribeId: tribe.id,
        kind: "haul",
        x: sourceSite.x,
        y: sourceSite.y,
        priority: 4,
        claimedBy: null,
        payload: {
          sourceX: sourceSite.x,
          sourceY: sourceSite.y,
          sourceBuildingId: sourceBuilding?.id ?? null,
          dropX: center.x,
          dropY: center.y,
          resourceType: haul.resourceType,
          amount: haul.amount,
          targetJobId: craftJobId,
        },
      });
    }
  }

  private tryPlanBuilding(tribe: TribeState, type: BuildingType, priority: number): void {
    const existingPlan = this.jobs.find((job) => job.tribeId === tribe.id && job.kind === "build" && (job.payload as BuildPayload | undefined)?.buildingType === type);
    if (existingPlan) return;
    if (this.buildingCount(tribe.id, type) >= this.maxBuildingCountForTribe(tribe, type)) return;
    if (
      this.hasBuilt(tribe.id, type) &&
      type !== BuildingType.House &&
      type !== BuildingType.Watchtower &&
      type !== BuildingType.Farm &&
      type !== BuildingType.Orchard &&
      type !== BuildingType.Stockpile &&
      type !== BuildingType.Warehouse
    ) {
      return;
    }

    const def = getBuildingDef(type);
    if (tribe.age < def.minAge) return;
    if (!this.canAfford(tribe, def.cost)) return;
    const site = this.findBuildingSite(tribe, def);
    if (!site) return;
    const haulSpecs = this.constructionHaulPlan(def.cost);

    for (const [resource, amount] of Object.entries(def.cost)) {
      tribe.resources[Number(resource)] -= amount ?? 0;
    }

    const buildJob: JobState = {
      id: this.nextJobId++,
      tribeId: tribe.id,
      kind: "build",
      x: site.x,
      y: site.y,
      priority,
      claimedBy: null,
      payload: {
        buildingType: type,
        width: def.size[0],
        height: def.size[1],
        supplied: 0,
        supplyNeeded: Math.max(1, haulSpecs.length),
        stockX: site.x + Math.floor(def.size[0] / 2),
        stockY: site.y + Math.floor(def.size[1] / 2),
      },
    };
    this.jobs.push(buildJob);
    for (const haul of haulSpecs) {
      const sourceBuilding = this.findStockedSourceBuilding(tribe.id, site.x, site.y, haul.resourceType);
      const sourceSite = sourceBuilding ? buildingCenter(sourceBuilding) : this.findConstructionSource(tribe.id, type);
      this.jobs.push({
        id: this.nextJobId++,
        tribeId: tribe.id,
        kind: "haul",
        x: sourceSite.x,
        y: sourceSite.y,
        priority: Math.max(4, priority - 1),
        claimedBy: null,
        payload: {
          sourceX: sourceSite.x,
          sourceY: sourceSite.y,
          sourceBuildingId: sourceBuilding?.id ?? null,
          dropX: site.x + Math.floor(def.size[0] / 2),
          dropY: site.y + Math.floor(def.size[1] / 2),
          resourceType: haul.resourceType,
          amount: haul.amount,
          targetJobId: buildJob.id,
        },
      });
    }
  }

  private maxBuildingCountForTribe(tribe: TribeState, type: BuildingType): number {
    const population = this.populationOf(tribe.id);
    if (type === BuildingType.Stockpile) {
      return tribe.age === AgeType.Primitive ? 2 : tribe.age === AgeType.Stone ? (population >= 28 ? 3 : 2) : population >= 48 ? 4 : 3;
    }
    if (type === BuildingType.Warehouse) {
      if (tribe.age < AgeType.Bronze) return 0;
      if (tribe.age < AgeType.Iron) return population >= 34 ? 1 : 0;
      if (tribe.age < AgeType.Industrial) return population >= 52 ? 2 : 1;
      return population >= 72 ? 3 : 2;
    }
    if (type === BuildingType.Cistern) {
      return population >= 42 ? 3 : 2;
    }
    return Number.POSITIVE_INFINITY;
  }

  private constructionHaulPlan(cost: Partial<Record<ResourceType, number>>): Array<{ resourceType: ResourceType; amount: number }> {
    const deliveries: Array<{ resourceType: ResourceType; amount: number }> = [];
    for (const [resource, amount] of Object.entries(cost)) {
      if (!amount || amount <= 0) continue;
      const resourceType = Number(resource) as ResourceType;
      const chunks = Math.max(1, Math.ceil(amount / 24));
      for (let i = 0; i < chunks; i += 1) {
        deliveries.push({ resourceType, amount: Math.ceil(amount / chunks) });
      }
    }
    return deliveries.slice(0, 4);
  }

  private findConstructionSource(tribeId: number, buildingType: BuildingType): { x: number; y: number } {
    const preferred =
      buildingType === BuildingType.Farm || buildingType === BuildingType.Orchard
        ? [BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
        : buildingType === BuildingType.Dock || buildingType === BuildingType.FishingHut || buildingType === BuildingType.Fishery
          ? [BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.LumberCamp, BuildingType.CapitalHall]
          : buildingType === BuildingType.Warehouse
            ? [BuildingType.Stockpile, BuildingType.CapitalHall]
            : buildingType === BuildingType.Cistern
              ? [BuildingType.Stockpile, BuildingType.Warehouse, BuildingType.CapitalHall]
            : buildingType === BuildingType.MountainHall
              ? [BuildingType.Quarry, BuildingType.Mine, BuildingType.CapitalHall]
              : buildingType === BuildingType.DeepMine
                ? [BuildingType.MountainHall, BuildingType.Mine, BuildingType.Quarry]
                : buildingType === BuildingType.TunnelEntrance
                  ? [BuildingType.MountainHall, BuildingType.Quarry, BuildingType.Mine]
            : buildingType === BuildingType.School || buildingType === BuildingType.Tavern || buildingType === BuildingType.Shrine
              ? [BuildingType.CapitalHall, BuildingType.House, BuildingType.Stockpile]
              : buildingType === BuildingType.Armory
                ? [BuildingType.Smithy, BuildingType.Barracks, BuildingType.Workshop]
              : buildingType === BuildingType.ArcaneSanctum
                ? [BuildingType.MageTower, BuildingType.School, BuildingType.Castle]
              : buildingType === BuildingType.Foundry
                ? [BuildingType.Smithy, BuildingType.Warehouse, BuildingType.Workshop]
              : buildingType === BuildingType.Factory
                ? [BuildingType.Foundry, BuildingType.Warehouse, BuildingType.Workshop]
              : buildingType === BuildingType.RailDepot
                ? [BuildingType.Warehouse, BuildingType.Stable, BuildingType.Barracks]
              : buildingType === BuildingType.PowerPlant
                ? [BuildingType.Factory, BuildingType.Foundry, BuildingType.Warehouse]
              : buildingType === BuildingType.Airfield
                ? [BuildingType.RailDepot, BuildingType.Barracks, BuildingType.Warehouse]
          : buildingType === BuildingType.Infirmary
            ? [BuildingType.Stockpile, BuildingType.CapitalHall, BuildingType.House]
            : buildingType === BuildingType.MageTower
              ? [BuildingType.Castle, BuildingType.Workshop, BuildingType.CapitalHall]
          : [BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.Workshop, BuildingType.CapitalHall];
    for (const type of preferred) {
      const building = this.buildingsForTribe(tribeId).find((entry) => entry.type === type);
      if (building) {
        return { x: building.x + Math.floor(building.width / 2), y: building.y + Math.floor(building.height / 2) };
      }
    }
    const tribe = this.tribes[tribeId]!;
    return { x: tribe.capitalX, y: tribe.capitalY };
  }

  private canAfford(tribe: TribeState, cost: Partial<Record<ResourceType, number>>): boolean {
    return Object.entries(cost).every(([resource, amount]) => tribe.resources[Number(resource)] >= (amount ?? 0));
  }

  private nearbyBuildingCount(tribeId: number, type: BuildingType, x: number, y: number, radius: number): number {
    return this.buildingsForTribe(tribeId).filter((entry) => entry.type === type && manhattan(entry.x, entry.y, x, y) <= radius).length;
  }

  private nearestBuildingDistance(tribeId: number, type: BuildingType, x: number, y: number): number {
    let best = Number.POSITIVE_INFINITY;
    for (const building of this.buildingsForTribe(tribeId)) {
      if (building.type !== type) continue;
      best = Math.min(best, manhattan(building.x, building.y, x, y));
    }
    return best;
  }

  private nearbyRoadScore(x: number, y: number, radius: number): number {
    let score = 0;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, this.world.width, this.world.height)) continue;
        const road = this.world.road[indexOf(nx, ny, this.world.width)];
        if (road > 0) score += 1;
      }
    }
    return score;
  }

  private findBuildingSite(tribe: TribeState, def: { type: BuildingType; size: [number, number] }): { x: number; y: number } | null {
    const radius = this.siteSearchRadius(tribe, def.type);
    let best: { x: number; y: number; score: number } | null = null;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = tribe.capitalX + dx;
        const y = tribe.capitalY + dy;
        if (!this.canPlaceBuilding(def.type, x, y, def.size[0], def.size[1])) continue;
        const score = this.scoreBuildingSite(tribe, def.type, x, y);
        if (!best || score > best.score) {
          best = { x, y, score };
        }
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  private siteSearchRadius(tribe: TribeState, type: BuildingType): number {
    if (this.isBootstrapPhase(tribe)) {
      if (type === BuildingType.Farm || type === BuildingType.Orchard) return 12;
      if (type === BuildingType.LumberCamp || type === BuildingType.Quarry) return 14;
      if (type === BuildingType.Cistern || type === BuildingType.Stockpile || type === BuildingType.House) return 10;
    }
    if (type === BuildingType.Dock || type === BuildingType.FishingHut || type === BuildingType.Fishery) return Math.min(MAX_JOB_RADIUS, 24);
    return MAX_JOB_RADIUS;
  }

  private findBuildingSiteForSeed(tribeId: number, def: { type: BuildingType; size: [number, number] }): { x: number; y: number } | null {
    const tribe = this.tribes[tribeId]!;
    let best: { x: number; y: number; score: number } | null = null;
    for (let dy = -18; dy <= 18; dy += 1) {
      for (let dx = -18; dx <= 18; dx += 1) {
        const x = tribe.capitalX + dx;
        const y = tribe.capitalY + dy;
        if (!this.canPlaceBuilding(def.type, x, y, def.size[0], def.size[1])) continue;
        const score = this.scoreBuildingSite(tribe, def.type, x, y);
        if (!best || score > best.score) {
          best = { x, y, score };
        }
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  private canPlaceBuilding(type: BuildingType, x: number, y: number, width: number, height: number): boolean {
    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        const tx = x + dx;
        const ty = y + dy;
        if (!inBounds(tx, ty, this.world.width, this.world.height)) return false;
        const index = indexOf(tx, ty, this.world.width);
        if (this.world.buildingByTile[index] >= 0) return false;
        const terrain = this.world.terrain[index];
        if (type === BuildingType.Dock || type === BuildingType.FishingHut || type === BuildingType.Fishery) {
          if (!hasAdjacentWater(this.world, tx, ty, 1)) return false;
        } else if (type === BuildingType.LumberCamp) {
          if (distanceToNearestFeature(this.world, tx, ty, (feature) => feature === FeatureType.Trees, 8) > 5) {
            return false;
          }
        } else if (type === BuildingType.Cistern) {
          if (!hasAdjacentWater(this.world, tx, ty, 7) && this.world.moisture[index] < 120 && this.world.owner[index] < 0) {
            return false;
          }
        } else if (type === BuildingType.Mine) {
          if (terrain !== TerrainType.Rocky && terrain !== TerrainType.Mountain && this.world.feature[index] !== FeatureType.OreVein) {
            return false;
          }
        } else if (type === BuildingType.DeepMine) {
          if (terrain !== TerrainType.Rocky && terrain !== TerrainType.Mountain) {
            return false;
          }
        } else if (type === BuildingType.TunnelEntrance) {
          if (terrain !== TerrainType.Rocky && terrain !== TerrainType.Mountain) {
            return false;
          }
        } else if (type === BuildingType.Quarry) {
          if (terrain !== TerrainType.Rocky && terrain !== TerrainType.Mountain && this.world.feature[index] !== FeatureType.StoneOutcrop && this.world.feature[index] !== FeatureType.ClayDeposit) {
            return false;
          }
        } else if (type === BuildingType.MountainHall) {
          if (terrain !== TerrainType.Rocky && terrain !== TerrainType.Mountain) {
            return false;
          }
        } else if (type === BuildingType.Warehouse || type === BuildingType.School || type === BuildingType.Armory || type === BuildingType.Tavern || type === BuildingType.Shrine || type === BuildingType.Foundry || type === BuildingType.Factory || type === BuildingType.RailDepot || type === BuildingType.PowerPlant || type === BuildingType.Airfield) {
          if (terrain === TerrainType.Mountain || terrain === TerrainType.Ashland) {
            return false;
          }
        } else if (type === BuildingType.House || type === BuildingType.Farm || type === BuildingType.Orchard || type === BuildingType.CapitalHall || type === BuildingType.Castle || type === BuildingType.Infirmary) {
          if (terrain === TerrainType.Rocky || terrain === TerrainType.Mountain || terrain === TerrainType.Ashland) {
            return false;
          }
        } else if (type === BuildingType.MageTower || type === BuildingType.ArcaneSanctum) {
          if (terrain === TerrainType.Mountain || terrain === TerrainType.Lava) {
            return false;
          }
        } else if (!isBuildableTerrain(terrain)) {
          return false;
        }
      }
    }
    return true;
  }

  private pushEvent(event: Omit<EventState, "id" | "tick">): void {
    this.events.unshift({
      id: this.nextEventId++,
      tick: this.tickCount,
      ...event,
    });
    if (this.events.length > 24) {
      this.events.length = 24;
    }
  }

  private findNearestTribe(x: number, y: number): TribeState | null {
    let best: TribeState | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const tribe of this.tribes) {
      const distance = manhattan(x, y, tribe.capitalX, tribe.capitalY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = tribe;
      }
    }
    return best;
  }

  private findBiomeLocation(match: (biome: BiomeType, terrain: TerrainType) => boolean): { x: number; y: number } | null {
    for (let i = 0; i < 2400; i += 1) {
      const x = randInt(this.random, 4, this.world.width - 5);
      const y = randInt(this.random, 4, this.world.height - 5);
      const index = indexOf(x, y, this.world.width);
      if (match(this.world.biome[index] as BiomeType, this.world.terrain[index] as TerrainType)) {
        return { x, y };
      }
    }
    return null;
  }

  private tribeActivity(tribe: TribeState): string {
    const population = this.populationOf(tribe.id);
    const tribeAgents = this.agentsForTribe(tribe.id);
    if (tribe.resources[ResourceType.Rations] < population * 3) return "Securing food";
    if (tribe.water < Math.max(10, population * 0.45)) return "Securing water";
    if (tribe.discovered.some((known, index) => index !== tribe.id && !known) && this.jobs.some((job) => job.tribeId === tribe.id && job.kind === "patrol")) return "Exploring frontiers";
    if (this.jobs.some((job) => job.tribeId === tribe.id && job.kind === "haul")) return "Hauling supplies";
    if (tribe.faith >= 40 && this.hasBuilt(tribe.id, BuildingType.Shrine)) return "Raising blessings";
    if (this.jobs.some((job) => job.tribeId === tribe.id && job.kind === "delve")) return "Running deep delves";
    if (this.hasBuilt(tribe.id, BuildingType.TunnelEntrance) || this.hasBuilt(tribe.id, BuildingType.DeepMine)) return "Delving underground";
    if (tribeAgents.filter((agent) => agent.wounds > 0).length > 4) return "Recovering from war";
    if (this.meanHostility(tribe) > 25) return "Preparing for war";
    if (tribe.age >= AgeType.Modern && this.hasBuilt(tribe.id, BuildingType.Airfield)) return "Launching air patrols";
    if (tribe.age >= AgeType.Modern && this.hasBuilt(tribe.id, BuildingType.PowerPlant)) return "Electrifying industry";
    if (tribe.age >= AgeType.Industrial && this.hasBuilt(tribe.id, BuildingType.Factory)) return "Driving industry";
    if (this.hasBuilt(tribe.id, BuildingType.ArcaneSanctum) && tribeAgents.some((agent) => agent.role === AgentRole.Mage)) return "Unleashing archmagic";
    if (this.hasBuilt(tribe.id, BuildingType.MageTower) && tribeAgents.some((agent) => agent.role === AgentRole.Mage)) return "Channeling high magic";
    if (tribeAgents.some((agent) => agent.role === AgentRole.Mage)) return "Training mages";
    if (this.computeHousing(tribe.id) < population + 2) return "Expanding housing";
    if (tribe.age >= AgeType.Gunpowder && this.hasBuilt(tribe.id, BuildingType.Foundry)) return "Forging powder wargear";
    if (tribe.age < AgeType.Iron) return "Researching and building";
    if (tribe.resources[ResourceType.Ore] < 40) return "Extracting ore";
    return "Growing territory";
  }

  private tribeDoctrine(tribe: TribeState): string {
    if (tribe.race.type === RaceType.Elves) return tribe.age >= AgeType.Modern ? "Luminous Canopy" : tribe.age >= AgeType.Industrial ? "Sunrail Sanctum" : tribe.age >= AgeType.Gunpowder ? "Star Sanctum" : tribe.age >= AgeType.Iron ? "Arcane Grove" : "Greenwardens";
    if (tribe.race.type === RaceType.Darkfolk) return tribe.age >= AgeType.Modern ? "Umbral Grid" : tribe.age >= AgeType.Industrial ? "Void Foundries" : tribe.age >= AgeType.Gunpowder ? "Night Sanctum" : tribe.age >= AgeType.Iron ? "Shadow Cabal" : "Ash Covenant";
    if (tribe.race.type === RaceType.Dwarves) return tribe.age >= AgeType.Modern ? "Iron Skyholds" : tribe.age >= AgeType.Industrial ? "Steamforged Holds" : tribe.age >= AgeType.Gunpowder ? "Thunderforged Holds" : tribe.age >= AgeType.Bronze ? "Runeforge Holds" : "Stone Clans";
    if (tribe.race.type === RaceType.Orcs) return tribe.age >= AgeType.Medieval ? "War Horde" : "Raider Clans";
    if (tribe.race.type === RaceType.Goblins) return tribe.age >= AgeType.Modern ? "Burst Swarm" : "Scrap Swarm";
    if (tribe.race.type === RaceType.Halflings) return "Hearth Commons";
    if (tribe.race.type === RaceType.Nomads) return tribe.age >= AgeType.Modern ? "Sky Caravanate" : tribe.resources[ResourceType.Horses] > 2 ? "Horse Caravans" : "Dune Caravans";
    if (tribe.race.type === RaceType.Humans) return tribe.age >= AgeType.Modern ? "Aerial Directorate" : tribe.age >= AgeType.Industrial ? "Iron Directorate" : tribe.age >= AgeType.Gunpowder ? "Powder Crown" : this.buildingCount(tribe.id, BuildingType.Shrine) > 0 ? "Crown Communion" : this.buildingCount(tribe.id, BuildingType.Barracks) + this.buildingCount(tribe.id, BuildingType.Workshop) > 2 ? "Banner Kingdom" : "Free Marches";
    return "Clan Domain";
  }

  private tribeTechs(tribe: TribeState): string[] {
    const techs = new Set<string>([
      "Shelter Craft",
      "Foraging Lore",
      "Hunting Bands",
      "Pack Hauling",
    ]);
    const unlock = (condition: boolean, ...names: string[]) => {
      if (!condition) return;
      for (const name of names) {
        techs.add(name);
      }
    };

    if (tribe.age >= AgeType.Stone) {
      unlock(true, "Stone Tools");
      unlock(this.hasBuilt(tribe.id, BuildingType.LumberCamp), "Tree Felling");
      unlock(this.hasBuilt(tribe.id, BuildingType.Farm), "Field Farming", "Water Catching");
      unlock(this.hasBuilt(tribe.id, BuildingType.Orchard), "Orchard Keeping");
      unlock(this.hasBuilt(tribe.id, BuildingType.Quarry), "Quarrying");
      unlock(this.hasBuilt(tribe.id, BuildingType.Mine), "Surface Mining");
      unlock(this.hasBuilt(tribe.id, BuildingType.Workshop), "Basic Workshops", "Wood Shaping");
      unlock(this.hasBuilt(tribe.id, BuildingType.Cistern), "Cisterns");
      unlock(this.hasBuilt(tribe.id, BuildingType.MountainHall), "Mountain Halls");
      unlock(this.hasBuilt(tribe.id, BuildingType.Stable), "Animal Pens");
      unlock(this.hasBuilt(tribe.id, BuildingType.Stockpile), "Smokehouses", "Cart Paths");
      unlock(this.resourceStored(tribe.id, ResourceType.Clay) > 10, "Clay Works");
      unlock(this.hasFeatureInTerritory(tribe.id, FeatureType.Trench), "Defensive Ditches");
      unlock(this.hasBuilt(tribe.id, BuildingType.Shrine), "Shrines");
    }

    if (tribe.age >= AgeType.Bronze) {
      unlock(this.hasBuilt(tribe.id, BuildingType.Mine), "Deep Mining");
      unlock(this.hasBuilt(tribe.id, BuildingType.Workshop), "Wheelwrighting");
      unlock(this.hasBuilt(tribe.id, BuildingType.Warehouse), "Warehouses", "Storehouse Logistics");
      unlock(this.hasBuilt(tribe.id, BuildingType.School), "Schools");
      unlock(this.hasBuilt(tribe.id, BuildingType.Tavern), "Taverns");
      unlock(this.hasBuilt(tribe.id, BuildingType.Barracks), "Bronze Arms", "Barracks Training");
      unlock(this.hasBuilt(tribe.id, BuildingType.Armory), "Bronze Mail");
      unlock(this.resourceStored(tribe.id, ResourceType.Livestock) >= 4, "Livestock Breeding");
      unlock(this.buildingCount(tribe.id, BuildingType.TunnelEntrance) > 0, "Tunnel Mapping", "Dungeon Delving");
      unlock(this.hasFeatureInTerritory(tribe.id, FeatureType.IrrigationCanal), "Canal Keeping");
    }

    if (tribe.age >= AgeType.Iron) {
      unlock(this.hasBuilt(tribe.id, BuildingType.Smithy), "Iron Smithing", "Reinforced Tools");
      unlock(this.hasBuilt(tribe.id, BuildingType.Armory), "Heavy Armor", "Militia Drills");
      unlock(this.hasBuilt(tribe.id, BuildingType.Watchtower), "Watchtowers");
      unlock(this.hasBuilt(tribe.id, BuildingType.DeepMine), "Deep Mines", "Deep Delves", "Delve Salvage");
      unlock(this.hasBuilt(tribe.id, BuildingType.TunnelEntrance), "Tunnel Works", "Underway Patrols");
      unlock(this.resourceStored(tribe.id, ResourceType.Horses) > 0 || this.hasBuilt(tribe.id, BuildingType.Stable), "Horse Taming");
      unlock(this.hasBuilt(tribe.id, BuildingType.Stable), "Mounted Patrols");
      unlock(this.hasFeatureInTerritory(tribe.id, FeatureType.StoneWall), "Stone Forts", "Wall Masonry");
      unlock(this.hasBuilt(tribe.id, BuildingType.Workshop), "Guild Craft");
      unlock(this.hasBuilt(tribe.id, BuildingType.MageTower) || this.hasBuilt(tribe.id, BuildingType.ArcaneSanctum), "Rune Etching");
      unlock(this.hasBuilt(tribe.id, BuildingType.Infirmary), "Battle Surgery", "Herbal Clinics");
      unlock(this.wagons.some((wagon) => wagon.tribeId === tribe.id), "Supply Wagons");
      unlock(this.hasBuilt(tribe.id, BuildingType.Cistern), "Reservoir Discipline");
    }

    if (tribe.age >= AgeType.Medieval) {
      unlock(this.hasBuilt(tribe.id, BuildingType.Castle), "Castle Engineering", "Knight Orders", "Fortified Gates");
      unlock(this.hasBuilt(tribe.id, BuildingType.Dock), "Docks", "Fishing Fleets");
      unlock(this.hasBuilt(tribe.id, BuildingType.Fishery), "Fisheries");
      unlock(this.tradePartnerCount(tribe.id) > 0, "Trade Ledgers");
      unlock(this.siegeEngines.some((engine) => engine.tribeId === tribe.id && engine.type === SiegeEngineType.Trebuchet), "Trebuchets");
      unlock(this.siegeEngines.some((engine) => engine.tribeId === tribe.id && engine.type === SiegeEngineType.BatteringRam), "Battering Rams");
      unlock(this.siegeEngines.some((engine) => engine.tribeId === tribe.id && engine.type === SiegeEngineType.Ballista), "Ballistae");
      unlock(this.siegeEngines.some((engine) => engine.tribeId === tribe.id && engine.type === SiegeEngineType.SiegeTower), "Siege Towers");
      unlock(this.hasBuilt(tribe.id, BuildingType.Shrine), "War Banners");
      unlock(this.dungeons.some((dungeon) => dungeon.exploredBy === tribe.id), "Relic Forging");
      unlock(this.hasBuilt(tribe.id, BuildingType.School), "Grand Archives");
      unlock(this.hasBuilt(tribe.id, BuildingType.MageTower), "Arcane Towers");
      unlock(this.hasBuilt(tribe.id, BuildingType.Infirmary), "Field Hospitals");
      unlock(this.roadTilesForTribe(tribe.id) > 18, "Long Roads");
      unlock(this.hasBuilt(tribe.id, BuildingType.Warehouse), "Granary Seals");
    }

    if (tribe.age >= AgeType.Gunpowder) {
      unlock(this.hasBuilt(tribe.id, BuildingType.Foundry), "Foundries", "Gun Casting", "Bastion Guns");
      unlock(this.resourceStored(tribe.id, ResourceType.Charcoal) > 8, "Powder Drill", "Charcoal Burning");
      unlock(this.resourceStored(tribe.id, ResourceType.Bricks) > 6, "Brick Kilns");
      unlock(this.wagons.some((wagon) => wagon.tribeId === tribe.id), "Shot Wagons");
      unlock(this.siegeEngines.some((engine) => engine.tribeId === tribe.id && engine.type === SiegeEngineType.Cannon), "Smoke Screens");
    }

    if (tribe.age >= AgeType.Industrial) {
      unlock(this.hasBuilt(tribe.id, BuildingType.Factory), "Factories", "Machine Shops", "Mass Logistics");
      unlock(this.hasBuilt(tribe.id, BuildingType.RailDepot), "Rail Depots", "Steel Harness");
      unlock(this.siegeEngines.some((engine) => engine.tribeId === tribe.id && engine.type === SiegeEngineType.Mortar), "Mortar Batteries");
      unlock(this.hasBuilt(tribe.id, BuildingType.Infirmary), "Industrial Clinics");
      unlock(this.hasBuilt(tribe.id, BuildingType.Factory), "Repeater Arms");
    }

    if (tribe.age >= AgeType.Modern) {
      unlock(this.hasBuilt(tribe.id, BuildingType.PowerPlant), "Power Grids", "Searchlights", "Field Radios");
      unlock(this.hasBuilt(tribe.id, BuildingType.Airfield), "Airfields", "Aerial Recon");
      unlock(this.siegeEngines.some((engine) => engine.tribeId === tribe.id && engine.type === SiegeEngineType.Tank), "Armored Columns", "Motorized Hauling");
      unlock(this.siegeEngines.some((engine) => engine.tribeId === tribe.id && engine.type === SiegeEngineType.Zeppelin), "Signal Corps");
      unlock(this.hasBuilt(tribe.id, BuildingType.PowerPlant) && this.hasBuilt(tribe.id, BuildingType.Factory), "Modern Logistics");
    }

    if (tribe.race.type === RaceType.Elves) {
      unlock(tribe.age >= AgeType.Stone, "Grove Magic", "Living Timber", "Leaf Weaving");
      unlock(tribe.age >= AgeType.Iron, "Moon Arrows", "Spirit Wards", "Star Gardens");
      unlock(this.hasBuilt(tribe.id, BuildingType.ArcaneSanctum), "Sunfire Circles", "Archmage Conclaves");
      unlock(tribe.age >= AgeType.Modern, "Skyglass Lenses", "Canopy Beacons");
    }
    if (tribe.race.type === RaceType.Darkfolk) {
      unlock(tribe.age >= AgeType.Stone, "Shadow Rites", "Ash Sorcery", "Blood Oaths", "Underpaths");
      unlock(tribe.age >= AgeType.Iron, "Dread Wards", "Nightfire", "Hex Libraries");
      unlock(this.hasBuilt(tribe.id, BuildingType.ArcaneSanctum), "Void Lenses", "Night Cataclysms", "Umbral Coils");
      unlock(tribe.age >= AgeType.Modern, "Black Lantern Flight");
    }
    if (tribe.race.type === RaceType.Dwarves) {
      unlock(tribe.age >= AgeType.Stone, "Deep Masonry", "Vault Locks", "Hall Carving");
      unlock(tribe.age >= AgeType.Iron, "Runed Plate", "Tunnel Warfare", "Mountain Clinics", "Bolt Throwers");
      unlock(this.hasBuilt(tribe.id, BuildingType.Foundry), "Thunder Forges", "Breach Guns");
      unlock(this.hasBuilt(tribe.id, BuildingType.RailDepot), "Steam Hammers", "Tunnel Rails", "Rail Carbines");
      unlock(tribe.age >= AgeType.Modern, "Sky Dockyards");
    }
    if (tribe.race.type === RaceType.Orcs) {
      unlock(tribe.age >= AgeType.Stone, "War Drums", "Brutal Charges");
      unlock(tribe.age >= AgeType.Iron, "Ash Steel", "Siege Rush");
      unlock(this.resourceStored(tribe.id, ResourceType.Livestock) >= 6, "War Breeding");
      unlock(this.hasBuilt(tribe.id, BuildingType.Smithy), "Blood Smithing");
    }
    if (tribe.race.type === RaceType.Humans) {
      unlock(tribe.age >= AgeType.Stone, "Charters", "Banner Diplomacy", "Road Levies");
      unlock(this.tradePartnerCount(tribe.id) > 0, "Civic Markets", "Mercenary Bands");
      unlock(this.hasBuilt(tribe.id, BuildingType.Infirmary), "Stone Hospices");
      unlock(this.hasBuilt(tribe.id, BuildingType.Foundry), "Arquebusiers", "Powder Trains");
      unlock(this.hasBuilt(tribe.id, BuildingType.RailDepot), "Iron Rails", "Factory Charters", "Rifle Columns");
      unlock(this.hasBuilt(tribe.id, BuildingType.PowerPlant), "Electric Dispatch");
      unlock(this.hasBuilt(tribe.id, BuildingType.Airfield), "Air Marshals");
    }
    if (tribe.race.type === RaceType.Halflings) {
      unlock(tribe.age >= AgeType.Stone, "Herbal Tonic", "Seed Banks", "Hearth Feasts");
      unlock(this.hasBuilt(tribe.id, BuildingType.Stable), "Pony Carts");
      unlock(this.hasBuilt(tribe.id, BuildingType.Orchard), "Cider Pressing");
      unlock(this.hasBuilt(tribe.id, BuildingType.Infirmary), "Hedgerow Medicine");
    }
    if (tribe.race.type === RaceType.Nomads) {
      unlock(tribe.age >= AgeType.Stone, "Dune Paths", "Water Finding", "Leatherwork");
      unlock(this.resourceStored(tribe.id, ResourceType.Horses) > 0 || this.hasBuilt(tribe.id, BuildingType.Stable), "Skirmish Riding");
      unlock(this.hasBuilt(tribe.id, BuildingType.Infirmary), "Field Triage");
      unlock(tribe.age >= AgeType.Modern, "Sky Watch");
    }
    if (tribe.race.type === RaceType.Goblins) {
      unlock(tribe.age >= AgeType.Stone, "Scrap Craft", "Trap Pits", "Night Raids");
      unlock(this.hasBuilt(tribe.id, BuildingType.Warehouse), "Burrow Stores");
      unlock(this.hasBuilt(tribe.id, BuildingType.Barracks), "Sting Bows", "Rope Towers");
      unlock(this.hasBuilt(tribe.id, BuildingType.Foundry), "Spark Powder", "Crank Guns", "Smoke Mills");
    }

    return Array.from(techs);
  }

  private scoreBuildingSite(tribe: TribeState, type: BuildingType, x: number, y: number): number {
    const centerDistance = manhattan(tribe.capitalX, tribe.capitalY, x, y);
    const index = indexOf(x, y, this.world.width);
    const roadScore = this.nearbyRoadScore(x, y, 2);
    let score = -centerDistance * 0.6 + this.world.fertility[index] * 0.02 + roadScore * 2.2;

    if (type === BuildingType.Farm || type === BuildingType.Orchard) {
      score += this.world.fertility[index] * 0.45 + (hasAdjacentWater(this.world, x, y, 5) ? 14 : 0);
      if (this.world.terrain[index] === TerrainType.Grass || this.world.terrain[index] === TerrainType.ForestFloor) score += 40;
      score += 28 - Math.abs(centerDistance - 9) * 2.8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Farm, x, y, 10) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Orchard, x, y, 10) * 6;
    }
    if (type === BuildingType.LumberCamp) {
      score -= distanceToNearestFeature(this.world, x, y, (feature) => feature === FeatureType.Trees, 14) * 3;
      score += 24 - Math.abs(centerDistance - 10) * 2.2;
    }
    if (type === BuildingType.Quarry) {
      score -= distanceToNearestFeature(this.world, x, y, (feature) => feature === FeatureType.StoneOutcrop || feature === FeatureType.ClayDeposit, 14) * 3;
      score += 20 - Math.abs(centerDistance - 11) * 2.1;
    }
    if (type === BuildingType.Mine) {
      score -= distanceToNearestFeature(this.world, x, y, (feature) => feature === FeatureType.OreVein, 16) * 4;
      score += Math.max(0, centerDistance - 14) * 0.7;
    }
    if (type === BuildingType.MountainHall) {
      const terrain = this.world.terrain[index];
      score += terrain === TerrainType.Mountain ? 85 : terrain === TerrainType.Rocky ? 60 : -120;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.MountainHall, x, y, 8) * 9;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Mine, x, y, 10) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Quarry, x, y, 10) * 7;
      score += tribe.race.type === RaceType.Dwarves ? 18 : tribe.race.type === RaceType.Darkfolk ? 10 : -8;
      score += this.world.elevation[index] * 0.08;
    }
    if (type === BuildingType.DeepMine) {
      const terrain = this.world.terrain[index];
      score += terrain === TerrainType.Mountain ? 70 : terrain === TerrainType.Rocky ? 55 : -140;
      score -= distanceToNearestFeature(this.world, x, y, (feature) => feature === FeatureType.OreVein, 18) * 4;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.MountainHall, x, y, 10) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Mine, x, y, 8) * 6;
      score += this.world.elevation[index] * 0.1;
    }
    if (type === BuildingType.TunnelEntrance) {
      const terrain = this.world.terrain[index];
      score += terrain === TerrainType.Mountain ? 62 : terrain === TerrainType.Rocky ? 48 : -140;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.MountainHall, x, y, 10) * 9;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.DeepMine, x, y, 8) * 6;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Quarry, x, y, 8) * 5;
      score += tribe.race.type === RaceType.Dwarves ? 16 : tribe.race.type === RaceType.Darkfolk ? 12 : -6;
      score += this.world.elevation[index] * 0.08;
    }
    if (type === BuildingType.Dock || type === BuildingType.FishingHut || type === BuildingType.Fishery) {
      score += hasAdjacentWater(this.world, x, y, 2) ? 120 : -200;
      score += 50 - centerDistance * 0.5;
      score += Math.max(0, 16 - this.nearestBuildingDistance(tribe.id, BuildingType.Dock, x, y));
      score += this.nearbyRoadScore(x, y, 3) * 1.6;
    }
    if (type === BuildingType.Cistern) {
      score += (hasAdjacentWater(this.world, x, y, 7) ? 48 : 0) + this.world.moisture[index] * 0.12;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Farm, x, y, 10) * 7;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Orchard, x, y, 10) * 6;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 10) * 4;
      score += this.nearbyRoadScore(x, y, 3) * 1.2;
      score += 26 - Math.abs(centerDistance - 7) * 2.4;
    }
    if (type === BuildingType.Stable) {
      score += this.animals.some((animal) => animal.type === AnimalType.Horse && manhattan(animal.x, animal.y, x, y) < 18) ? 60 : -60;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Farm, x, y, 12) * 5;
    }
    if (type === BuildingType.Castle) {
      score += 30 - centerDistance * 0.2;
    }
    if (type === BuildingType.Watchtower) {
      score += centerDistance * 0.15;
    }
    if (type === BuildingType.Infirmary) {
      score += 70 - Math.abs(centerDistance - 7) * 4;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 8) * 10;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Castle, x, y, 10) * 12;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.Mine, x, y, 8) * 12;
    }
    if (type === BuildingType.MageTower) {
      score += 55 - Math.abs(centerDistance - 9) * 3;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Workshop, x, y, 10) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Castle, x, y, 12) * 10;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.MageTower, x, y, 16) * 18;
      score += this.world.elevation[index] * 0.08;
    }
    if (type === BuildingType.ArcaneSanctum) {
      score += 62 - Math.abs(centerDistance - 10) * 3;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.MageTower, x, y, 12) * 12;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.School, x, y, 10) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Castle, x, y, 14) * 10;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.ArcaneSanctum, x, y, 18) * 22;
      score += this.world.elevation[index] * 0.1;
    }
    if (type === BuildingType.Foundry) {
      score += 58 - Math.abs(centerDistance - 9) * 4;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Smithy, x, y, 8) * 10;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Armory, x, y, 8) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Warehouse, x, y, 10) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Workshop, x, y, 10) * 7;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 6) * 10;
    }
    if (type === BuildingType.Factory) {
      score += 60 - Math.abs(centerDistance - 10) * 4;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Foundry, x, y, 10) * 12;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Warehouse, x, y, 10) * 9;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.RailDepot, x, y, 12) * 10;
      score += this.nearbyRoadScore(x, y, 4) * 2.2;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 8) * 12;
    }
    if (type === BuildingType.RailDepot) {
      score += 68 - Math.abs(centerDistance - 8) * 4;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Warehouse, x, y, 10) * 10;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Stable, x, y, 10) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Factory, x, y, 12) * 9;
      score += this.nearbyRoadScore(x, y, 4) * 2.5;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 8) * 8;
    }
    if (type === BuildingType.PowerPlant) {
      score += 64 - Math.abs(centerDistance - 12) * 4;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Factory, x, y, 12) * 13;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Foundry, x, y, 10) * 11;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.RailDepot, x, y, 12) * 9;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Warehouse, x, y, 10) * 8;
      score += this.nearbyRoadScore(x, y, 4) * 2.4;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 10) * 13;
    }
    if (type === BuildingType.Airfield) {
      score += 58 - Math.abs(centerDistance - 14) * 3;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.RailDepot, x, y, 12) * 12;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Barracks, x, y, 10) * 9;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Warehouse, x, y, 10) * 8;
      score += this.nearbyRoadScore(x, y, 5) * 2.1;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 12) * 10;
      score -= this.world.elevation[index] * 0.04;
    }
    if (type === BuildingType.House) {
      score += 80 - Math.abs(centerDistance - 10) * 4;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 8) * 10;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.MountainHall, x, y, 8) * 6;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.Mine, x, y, 10) * 20;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.Quarry, x, y, 10) * 14;
    }
    if (type === BuildingType.Stockpile) {
      score += 60 - Math.abs(centerDistance - 6) * 6;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Workshop, x, y, 8) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Smithy, x, y, 8) * 8;
    }
    if (type === BuildingType.Warehouse) {
      score += 62 - Math.abs(centerDistance - 6) * 5;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 10) * 6;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Workshop, x, y, 10) * 7;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Stockpile, x, y, 10) * 8;
      score += this.nearbyRoadScore(x, y, 3) * 1.8;
    }
    if (type === BuildingType.School) {
      score += 55 - Math.abs(centerDistance - 7) * 4;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 10) * 7;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Workshop, x, y, 8) * 6;
    }
    if (type === BuildingType.Shrine) {
      score += 65 - Math.abs(centerDistance - 7) * 3;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 8) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Castle, x, y, 10) * 8;
    }
    if (type === BuildingType.Tavern) {
      score += 60 - Math.abs(centerDistance - 8) * 4;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 8) * 10;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Stockpile, x, y, 10) * 4;
    }
    if (type === BuildingType.Workshop || type === BuildingType.Smithy || type === BuildingType.Barracks || type === BuildingType.MageTower || type === BuildingType.Armory) {
      score += 50 - Math.abs(centerDistance - 8) * 5;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Stockpile, x, y, 8) * 10;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Warehouse, x, y, 10) * 8;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Workshop, x, y, 8) * 6;
      score += this.nearbyBuildingCount(tribe.id, BuildingType.Smithy, x, y, 8) * 6;
      score -= this.nearbyBuildingCount(tribe.id, BuildingType.House, x, y, 6) * 8;
    }
    return score;
  }

  private placeBuilding(tribeId: number, type: BuildingType, x: number, y: number): BuildingState {
    const def = getBuildingDef(type);
    const building: BuildingState = {
      id: this.nextBuildingId++,
      tribeId,
      type,
      x,
      y,
      width: def.size[0],
      height: def.size[1],
      hp: 60 + buildingColorStrength(type) * 40,
      stock: resourceArray(),
    };
    this.buildings.push(building);
    this.invalidateSummaryCaches();

    for (let dy = 0; dy < building.height; dy += 1) {
      for (let dx = 0; dx < building.width; dx += 1) {
        const tx = x + dx;
        const ty = y + dy;
        const index = indexOf(tx, ty, this.world.width);
        this.world.buildingByTile[index] = building.id;
        if (type === BuildingType.Farm || type === BuildingType.Orchard) {
          this.world.terrain[index] = TerrainType.Farmland;
          this.world.feature[index] = FeatureType.None;
          this.world.resourceType[index] = ResourceType.Grain;
          this.world.resourceAmount[index] = 240;
        }
        this.world.owner[index] = tribeId;
        this.markDirty(index);
      }
    }

    this.claimTerritory(tribeId, x + Math.floor(building.width / 2), y + Math.floor(building.height / 2), Math.max(7, 4 + buildingColorStrength(type) * 4));
    this.connectBuildingRoads(building);
    if (type === BuildingType.Stable) {
      this.tribes[tribeId]!.stableCount += 1;
    }
    this.carveUndergroundAccess(building);
    return building;
  }

  private connectBuildingRoads(building: BuildingState): void {
    const tribe = this.tribes[building.tribeId];
    if (!tribe) return;
    const center = buildingCenter(building);
    const anchor = this.findRoadAnchor(building) ?? { x: tribe.capitalX, y: tribe.capitalY };
    this.layRoad(anchor.x, anchor.y, center.x, center.y);
    if (building.type === BuildingType.FishingHut || building.type === BuildingType.Dock) {
      this.layRoad(tribe.capitalX, tribe.capitalY, center.x, center.y);
    }
  }

  private findRoadAnchor(building: BuildingState): { x: number; y: number } | null {
    const preferred =
      building.type === BuildingType.Farm || building.type === BuildingType.Orchard || building.type === BuildingType.Stable
        ? [BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.House, BuildingType.CapitalHall]
        : building.type === BuildingType.Dock || building.type === BuildingType.FishingHut || building.type === BuildingType.Fishery
          ? [BuildingType.Dock, BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.CapitalHall]
          : building.type === BuildingType.Warehouse
            ? [BuildingType.Stockpile, BuildingType.CapitalHall]
            : building.type === BuildingType.Cistern
              ? [BuildingType.Farm, BuildingType.Orchard, BuildingType.Warehouse, BuildingType.Stockpile]
            : building.type === BuildingType.MountainHall
              ? [BuildingType.Quarry, BuildingType.Mine, BuildingType.CapitalHall]
              : building.type === BuildingType.DeepMine
                ? [BuildingType.MountainHall, BuildingType.Mine, BuildingType.Quarry]
                : building.type === BuildingType.TunnelEntrance
                  ? [BuildingType.MountainHall, BuildingType.DeepMine, BuildingType.Quarry]
            : building.type === BuildingType.Shrine || building.type === BuildingType.Tavern || building.type === BuildingType.School
              ? [BuildingType.House, BuildingType.CapitalHall, BuildingType.Stockpile]
              : building.type === BuildingType.Armory
                ? [BuildingType.Barracks, BuildingType.Smithy, BuildingType.Workshop]
              : building.type === BuildingType.Foundry
                ? [BuildingType.Smithy, BuildingType.Armory, BuildingType.Warehouse]
              : building.type === BuildingType.Factory
                ? [BuildingType.Foundry, BuildingType.RailDepot, BuildingType.Warehouse]
              : building.type === BuildingType.RailDepot
                ? [BuildingType.Warehouse, BuildingType.Stable, BuildingType.Barracks]
              : building.type === BuildingType.PowerPlant
                ? [BuildingType.Factory, BuildingType.Foundry, BuildingType.RailDepot, BuildingType.Warehouse]
              : building.type === BuildingType.Airfield
                ? [BuildingType.RailDepot, BuildingType.Barracks, BuildingType.Warehouse]
          : building.type === BuildingType.Infirmary
            ? [BuildingType.House, BuildingType.Castle, BuildingType.CapitalHall]
            : building.type === BuildingType.MageTower
              ? [BuildingType.Castle, BuildingType.Workshop, BuildingType.CapitalHall]
              : building.type === BuildingType.ArcaneSanctum
                ? [BuildingType.MageTower, BuildingType.School, BuildingType.Castle]
              : [BuildingType.Warehouse, BuildingType.Stockpile, BuildingType.Workshop, BuildingType.CapitalHall];

    let best: BuildingState | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const center = buildingCenter(building);
    for (const type of preferred) {
      for (const entry of this.buildingsForTribe(building.tribeId)) {
        if (entry.id === building.id || entry.type !== type) continue;
        const target = buildingCenter(entry);
        const distance = manhattan(center.x, center.y, target.x, target.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = entry;
        }
      }
      if (best) break;
    }
    return best ? buildingCenter(best) : null;
  }

  private layRoad(startX: number, startY: number, endX: number, endY: number): void {
    const path = findPath(this.world, startX, startY, endX, endY);
    for (const tile of path) {
      if (tile === indexOf(startX, startY, this.world.width)) continue;
      this.world.road[tile] = Math.max(this.world.road[tile], 1);
      this.markDirty(tile);
    }
  }

  private claimTerritory(tribeId: number, x: number, y: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, this.world.width, this.world.height)) continue;
        if (Math.hypot(dx, dy) > radius) continue;
        const index = indexOf(nx, ny, this.world.width);
        this.world.owner[index] = tribeId;
        this.markDirty(index);
      }
    }
  }

  private spawnAgent(tribeId: number, x: number, y: number): void {
    this.agents.push({
      id: this.nextAgentId++,
      tribeId,
      name: agentNameForRace(this.random, this.tribes[tribeId]!.race.type),
      title: "",
      hero: false,
      blessed: false,
      level: 1,
      kills: 0,
      wounds: 0,
      status: "Ready",
      condition: AgentConditionType.Steady,
      role: AgentRole.Worker,
      x: clamp(x, 1, this.world.width - 2),
      y: clamp(y, 1, this.world.height - 2),
      path: [],
      pathIndex: 0,
      task: null,
      health: 100,
      hunger: 0,
      warmth: 100,
      fatigue: randInt(this.random, 3, 12),
      sickness: 0,
      inspiration: randInt(this.random, 0, 10),
      morale: 82,
      underground: false,
      carrying: ResourceType.None,
      carryingAmount: 0,
      moveCooldown: 0,
      spellCooldown: 0,
      ageTicks: 0,
      gear: gearForRole(AgentRole.Worker, this.tribes[tribeId]!.age, this.tribes[tribeId]!.race.type),
    });
    this.invalidateSummaryCaches();
    this.assignRolesForTribe(this.tribes[tribeId]!);
  }

  private buildingCount(tribeId: number, type: BuildingType): number {
    this.ensureSummaryCaches();
    return this.cachedBuildingCountsByTribe[tribeId]?.[type] ?? 0;
  }

  private hasBuilt(tribeId: number, type: BuildingType): boolean {
    return this.buildingCount(tribeId, type) > 0;
  }

  private resourceStored(tribeId: number, type: ResourceType): number {
    return this.tribes[tribeId]?.resources[type] ?? 0;
  }

  private hasFeatureInTerritory(tribeId: number, feature: FeatureType): boolean {
    for (let i = 0; i < this.world.feature.length; i += 1) {
      if (this.world.owner[i] !== tribeId) continue;
      if (this.world.feature[i] === feature) {
        return true;
      }
    }
    return false;
  }

  private roadTilesForTribe(tribeId: number): number {
    let count = 0;
    for (let i = 0; i < this.world.road.length; i += 1) {
      if (this.world.owner[i] === tribeId && this.world.road[i] > 0) {
        count += 1;
      }
    }
    return count;
  }

  private populationOf(tribeId: number): number {
    this.ensureSummaryCaches();
    return this.cachedPopulationByTribe[tribeId] ?? 0;
  }

  private buildingsForTribe(tribeId: number): readonly BuildingState[] {
    this.ensureSummaryCaches();
    return this.cachedBuildingsByTribe[tribeId] ?? [];
  }

  private agentsForTribe(tribeId: number): readonly AgentState[] {
    this.ensureSummaryCaches();
    return this.cachedAgentsByTribe[tribeId] ?? [];
  }

  private invalidateSummaryCaches(): void {
    this.summaryRevision += 1;
  }

  private ensureSummaryCaches(): void {
    if (this.summaryCacheRevision === this.summaryRevision) {
      return;
    }
    const tribeCount = this.tribes.length;
    this.cachedBuildingsByTribe = Array.from({ length: tribeCount }, () => []);
    this.cachedAgentsByTribe = Array.from({ length: tribeCount }, () => []);
    this.cachedBuildingCountsByTribe = Array.from({ length: tribeCount }, () => new Uint16Array(BUILDING_DEFS.length));
    this.cachedPopulationByTribe = new Uint16Array(tribeCount);

    for (const building of this.buildings) {
      const list = this.cachedBuildingsByTribe[building.tribeId];
      if (!list) continue;
      list.push(building);
      this.cachedBuildingCountsByTribe[building.tribeId]![building.type] += 1;
    }

    for (const agent of this.agents) {
      const list = this.cachedAgentsByTribe[agent.tribeId];
      if (!list) continue;
      list.push(agent);
      this.cachedPopulationByTribe[agent.tribeId] += 1;
    }

    this.summaryCacheRevision = this.summaryRevision;
  }

  private computeHousing(tribeId: number): number {
    return this.buildingsForTribe(tribeId)
      .reduce((sum, building) => sum + buildingProvidesHousing(building.type), 0);
  }

  private irrigationBonusForTribe(tribeId: number): number {
    const farms = this.buildingsForTribe(tribeId).filter((building) => building.type === BuildingType.Farm || building.type === BuildingType.Orchard);
    let canals = 0;
    for (const farm of farms) {
      for (let dy = -1; dy <= farm.height; dy += 1) {
        for (let dx = -1; dx <= farm.width; dx += 1) {
          const x = farm.x + dx;
          const y = farm.y + dy;
          if (!inBounds(x, y, this.world.width, this.world.height)) continue;
          if (this.world.feature[indexOf(x, y, this.world.width)] === FeatureType.IrrigationCanal) {
            canals += 1;
          }
        }
      }
    }
    return canals * 0.35;
  }

  private surfaceWaterFarmSupportForTribe(tribeId: number): number {
    let supported = 0;
    for (const building of this.buildingsForTribe(tribeId)) {
      if (building.type !== BuildingType.Farm && building.type !== BuildingType.Orchard) continue;
      let wetTiles = 0;
      let floodedTiles = 0;
      for (let dy = 0; dy < building.height; dy += 1) {
        for (let dx = 0; dx < building.width; dx += 1) {
          const index = indexOf(building.x + dx, building.y + dy, this.world.width);
          const depth = this.world.surfaceWater[index]!;
          if (depth >= 16 && depth < 96) wetTiles += 1;
          if (depth >= 96) floodedTiles += 1;
        }
      }
      if (wetTiles > 0 && floodedTiles === 0) supported += wetTiles * 0.35;
    }
    return supported;
  }

  private floodedFarmCountForTribe(tribeId: number): number {
    let flooded = 0;
    for (const building of this.buildingsForTribe(tribeId)) {
      if (building.type !== BuildingType.Farm && building.type !== BuildingType.Orchard) continue;
      for (let dy = 0; dy < building.height; dy += 1) {
        for (let dx = 0; dx < building.width; dx += 1) {
          const index = indexOf(building.x + dx, building.y + dy, this.world.width);
          if (this.world.surfaceWater[index]! >= 96) {
            flooded += 1;
            dy = building.height;
            break;
          }
        }
      }
    }
    return flooded;
  }

  private floodedBuildingCountForTribe(tribeId: number): number {
    let flooded = 0;
    for (const building of this.buildingsForTribe(tribeId)) {
      if (building.type === BuildingType.Dock || building.type === BuildingType.FishingHut || building.type === BuildingType.Fishery) continue;
      for (let dy = 0; dy < building.height; dy += 1) {
        for (let dx = 0; dx < building.width; dx += 1) {
          const index = indexOf(building.x + dx, building.y + dy, this.world.width);
          if (this.world.surfaceWater[index]! >= 112) {
            flooded += 1;
            dy = building.height;
            break;
          }
        }
      }
    }
    return flooded;
  }

  private cisternBonusForTribe(tribeId: number): number {
    const cisterns = this.buildingsForTribe(tribeId).filter((building) => building.type === BuildingType.Cistern);
    let waterScore = cisterns.length * 0.5;
    for (const cistern of cisterns) {
      const center = buildingCenter(cistern);
      if (hasAdjacentWater(this.world, center.x, center.y, 8)) {
        waterScore += 0.8;
      }
      waterScore += this.nearbyBuildingCount(tribeId, BuildingType.Farm, center.x, center.y, 8) * 0.12;
      waterScore += this.nearbyBuildingCount(tribeId, BuildingType.Orchard, center.x, center.y, 8) * 0.1;
    }
    return waterScore;
  }

  private waterworksScoreForTribe(tribeId: number): number {
    let score = 0;
    for (const building of this.buildingsForTribe(tribeId)) {
      if (building.type !== BuildingType.Farm && building.type !== BuildingType.Orchard && building.type !== BuildingType.Cistern) continue;
      for (let dy = -1; dy <= building.height; dy += 1) {
        for (let dx = -1; dx <= building.width; dx += 1) {
          const x = building.x + dx;
          const y = building.y + dy;
          if (!inBounds(x, y, this.world.width, this.world.height)) continue;
          const index = indexOf(x, y, this.world.width);
          const feature = this.world.feature[index] as FeatureType;
          const depth = this.world.surfaceWater[index]!;
          if (feature === FeatureType.IrrigationCanal && depth >= 16) score += 1;
          if (feature === FeatureType.Trench && depth >= 10) score += 0.6;
        }
      }
    }
    return Math.floor(score + this.buildingCount(tribeId, BuildingType.Cistern) * 2);
  }

  private waterCapacityForTribe(tribeId: number, population: number): number {
    const cisterns = this.buildingCount(tribeId, BuildingType.Cistern);
    const canals = this.irrigationBonusForTribe(tribeId);
    const wellsOfTown = this.buildingCount(tribeId, BuildingType.CapitalHall) + this.buildingCount(tribeId, BuildingType.Castle);
    const pumps = this.buildingCount(tribeId, BuildingType.PowerPlant);
    return Math.floor(46 + cisterns * 82 + canals * 7 + wellsOfTown * 26 + pumps * 30 + population * 1.9);
  }

  private waterIncomeForTribe(tribeId: number, weather: WeatherKind): number {
    const tribe = this.tribes[tribeId]!;
    const cisterns = this.buildingCount(tribeId, BuildingType.Cistern);
    const townDraw = this.buildingCount(tribeId, BuildingType.CapitalHall) * (tribe.age === AgeType.Primitive ? 8 : 5);
    const canals = this.irrigationBonusForTribe(tribeId);
    const waterworks = this.waterworksScoreForTribe(tribeId);
    const pumps = this.buildingCount(tribeId, BuildingType.PowerPlant);
    const surfaceRunoff = this.surfaceWaterFarmSupportForTribe(tribeId);
    const nearbyWater = hasAdjacentWater(this.world, tribe.capitalX, tribe.capitalY, 10) ? 10 : 6;
    const springMelt = this.season === SeasonType.Spring && (tribe.race.type === RaceType.Dwarves || tribe.race.type === RaceType.Darkfolk) ? 3 : 0;
    const weatherGain =
      weather === WeatherKind.Storm ? 12
      : weather === WeatherKind.Rain ? 8
      : weather === WeatherKind.Blizzard ? 5
      : weather === WeatherKind.Fog ? 2
      : weather === WeatherKind.Heatwave ? -2
      : 0;
    return Math.max(0, Math.floor(4 + townDraw + cisterns * 3.5 + canals * 0.8 + waterworks * 0.45 + pumps * 1.8 + surfaceRunoff * 0.45 + nearbyWater + springMelt + weatherGain));
  }

  private waterDemandForTribe(tribeId: number, population: number, weather: WeatherKind): number {
    const farms = this.buildingCount(tribeId, BuildingType.Farm);
    const orchards = this.buildingCount(tribeId, BuildingType.Orchard);
    const stables = this.buildingCount(tribeId, BuildingType.Stable);
    const baseline = population * 0.24 + farms * 0.9 + orchards * 0.55 + stables * 0.25;
    const weatherPressure =
      weather === WeatherKind.Heatwave ? 6
      : weather === WeatherKind.Storm || weather === WeatherKind.Rain ? -2
      : 0;
    return Math.max(1, Math.floor(baseline + weatherPressure));
  }

  private markDirty(index: number): void {
    this.dirtyTiles.add(index);
  }

  private serializeTribes(): TribeSummary[] {
    return this.tribes.map((tribe) => {
      const tribeAgents = this.agentsForTribe(tribe.id);
      const ruler = tribe.rulerAgentId !== null ? tribeAgents.find((agent) => agent.id === tribe.rulerAgentId) : null;
      const conditions = this.conditionCountsForTribe(tribe.id);
      const flooded = this.floodedBuildingCountForTribe(tribe.id);
      const soldierCount = tribeAgents.filter((agent) => agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider).length;
      const heroes = tribeAgents.filter((agent) => agent.hero).length;
      const wounded = tribeAgents.filter((agent) => agent.wounds > 0).length;
      const builders = tribeAgents.filter((agent) => agent.role === AgentRole.Builder).length;
      const farmers = tribeAgents.filter((agent) => agent.role === AgentRole.Farmer).length;
      const fishers = tribeAgents.filter((agent) => agent.role === AgentRole.Fisher).length;
      const miners = tribeAgents.filter((agent) => agent.role === AgentRole.Miner).length;
      const crafters = tribeAgents.filter((agent) => agent.role === AgentRole.Crafter).length;
      const scholars = tribeAgents.filter((agent) => agent.role === AgentRole.Scholar).length;
      const armyAgents = tribeAgents.filter((agent) => agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider || agent.role === AgentRole.Mage);
      return {
        rulerName: ruler?.name ?? "Vacant",
        rulerTitle: ruler ? this.rulerTitleForTribe(tribe) : "Interregnum",
        successionCount: tribe.successionCount,
        id: tribe.id,
        race: tribe.race.type,
        name: `${tribe.race.name} ${tribe.name}`,
        color: tribe.color,
        age: tribe.age,
        population: this.populationOf(tribe.id),
        housing: this.computeHousing(tribe.id),
        food: Math.floor(tribe.resources[ResourceType.Rations]),
        wood: Math.floor(tribe.resources[ResourceType.Wood]),
        stone: Math.floor(tribe.resources[ResourceType.Stone]),
        ore: Math.floor(tribe.resources[ResourceType.Ore]),
        research: Math.floor(tribe.research),
        faith: Math.floor(tribe.faith),
        water: Math.floor(tribe.water),
        morale: Math.floor(tribe.morale),
        horses: Math.floor(tribe.resources[ResourceType.Horses]),
        boats: this.boats.filter((boat) => boat.tribeId === tribe.id).length,
        wagons: this.wagons.filter((wagon) => wagon.tribeId === tribe.id).length,
        livestock: Math.floor(tribe.resources[ResourceType.Livestock]),
        flooded,
        delves: this.buildingCount(tribe.id, BuildingType.TunnelEntrance) + this.buildingCount(tribe.id, BuildingType.DeepMine),
        undergroundTiles: this.excavatedUndergroundTilesForTribe(tribe.id),
        waterworks: this.waterworksScoreForTribe(tribe.id),
        powerPlants: this.buildingCount(tribe.id, BuildingType.PowerPlant),
        airfields: this.buildingCount(tribe.id, BuildingType.Airfield),
        contacts: this.contactCount(tribe),
        allies: tribe.relations.filter((score, index) => index !== tribe.id && tribe.discovered[index] && diplomacyStateFromScore(score) === DiplomacyState.Alliance).length,
        tradePartners: this.tradePartnerCount(tribe.id),
        tributeTo: tribe.tributeTo,
        tributaries: this.tributaryCount(tribe.id),
        siege: tribe.age >= AgeType.Medieval ? Math.floor(this.buildingCount(tribe.id, BuildingType.Barracks) + this.buildingCount(tribe.id, BuildingType.Armory) + this.buildingCount(tribe.id, BuildingType.Workshop) / 2 + this.buildingCount(tribe.id, BuildingType.Foundry) * 2 + this.buildingCount(tribe.id, BuildingType.Factory) * 3 + this.buildingCount(tribe.id, BuildingType.RailDepot) + this.buildingCount(tribe.id, BuildingType.PowerPlant) * 2 + this.buildingCount(tribe.id, BuildingType.Airfield) * 2 + this.siegeEngines.filter((engine) => engine.tribeId === tribe.id).length * 2 + this.buildingCount(tribe.id, BuildingType.Castle)) : 0,
        magic: (tribe.race.type === RaceType.Elves || tribe.race.type === RaceType.Darkfolk) ? Math.max(0, tribe.age - AgeType.Stone + 1 + this.buildingCount(tribe.id, BuildingType.MageTower) + this.buildingCount(tribe.id, BuildingType.ArcaneSanctum) * 3) : 0,
        activity: this.tribeActivity(tribe),
        doctrine: this.tribeDoctrine(tribe),
        soldiers: soldierCount,
        heroes,
        wounded,
        armyPower: Math.floor(armyAgents
          .reduce((sum, agent) => sum + agent.gear.power + agent.level * 2 + (agent.hero ? 8 : 0), 0)
          + this.siegeEngines.filter((engine) => engine.tribeId === tribe.id).reduce((sum, engine) =>
            sum + (
              engine.type === SiegeEngineType.Trebuchet ? 18
              : engine.type === SiegeEngineType.Ballista ? 16
              : engine.type === SiegeEngineType.Cannon ? 22
              : engine.type === SiegeEngineType.Mortar ? 26
              : engine.type === SiegeEngineType.Tank ? 34
              : engine.type === SiegeEngineType.Zeppelin ? 28
              : engine.type === SiegeEngineType.SiegeTower ? 15
              : 14
            ), 0)),
        builders,
        farmers,
        fishers,
        miners,
        crafters,
        scholars,
        sick: conditions.sick,
        exhausted: conditions.exhausted,
        inspired: conditions.inspired,
        enemyCount: tribe.relations.filter((score, index) => index !== tribe.id && tribe.discovered[index] && diplomacyStateFromScore(score) >= DiplomacyState.Hostile).length,
        weather: this.weatherAt(tribe.capitalX, tribe.capitalY),
        techs: this.tribeTechs(tribe),
        capitalX: tribe.capitalX,
        capitalY: tribe.capitalY,
        diplomacy: tribe.relations.map((score) => diplomacyStateFromScore(score)),
      };
    });
  }

  private createSnapshot(): DynamicSnapshot {
    const tileUpdates: TileUpdate[] = [];
    for (const index of this.dirtyTiles) {
      tileUpdates.push({
        index,
        terrain: this.world.terrain[index]!,
        feature: this.world.feature[index]!,
        surfaceWater: this.world.surfaceWater[index]!,
        undergroundTerrain: this.world.undergroundTerrain[index]!,
        undergroundFeature: this.world.undergroundFeature[index]!,
        undergroundResourceType: this.world.undergroundResourceType[index]!,
        undergroundResourceAmount: this.world.undergroundResourceAmount[index]!,
        resourceType: this.world.resourceType[index]!,
        resourceAmount: this.world.resourceAmount[index]!,
        road: this.world.road[index]!,
        owner: this.world.owner[index]!,
      });
    }
    this.dirtyTiles.clear();

    const agents: AgentSnapshot[] = this.agents.map((agent) => ({
      id: agent.id,
      tribeId: agent.tribeId,
      name: agent.name,
      title: agent.title,
      hero: agent.hero,
      blessed: agent.blessed,
      level: agent.level,
      kills: agent.kills,
      wounds: agent.wounds,
      status: agent.status,
      condition: agent.condition,
      ageYears: Math.floor(agent.ageTicks / YEAR_TICKS) + 18,
      role: agent.role,
      x: agent.x,
      y: agent.y,
      targetX: agent.task?.targetX ?? agent.x,
      targetY: agent.task?.targetY ?? agent.y,
      health: Math.max(0, Math.floor(agent.health)),
      fatigue: Math.floor(agent.fatigue),
      sickness: Math.floor(agent.sickness),
      inspiration: Math.floor(agent.inspiration),
      task: agent.task?.kind ?? "idle",
      underground: agent.underground,
      carrying: agent.carrying,
      carryingAmount: agent.carryingAmount,
      gear: { ...agent.gear },
    }));

    const buildings: BuildingSnapshot[] = this.buildings.map((building) => ({
      id: building.id,
      tribeId: building.tribeId,
      type: building.type,
      x: building.x,
      y: building.y,
      width: building.width,
      height: building.height,
      hp: Math.max(0, Math.floor(building.hp)),
      stockResource: this.topStoredResource(building).resourceType,
      stockAmount: this.topStoredResource(building).amount,
    }));

    const plannedSites: PlannedSiteSnapshot[] = this.jobs
      .filter((job) => job.kind === "build")
      .map((job) => {
        const payload = job.payload as BuildPayload;
        return {
          tribeId: job.tribeId,
          type: payload.buildingType,
          x: job.x,
          y: job.y,
          width: payload.width,
          height: payload.height,
          supplied: payload.supplied,
          supplyNeeded: payload.supplyNeeded,
        };
      });

    const animals: AnimalSnapshot[] = this.animals.map((animal) => ({
      id: animal.id,
      type: animal.type,
      x: animal.x,
      y: animal.y,
    }));

    const boats: BoatSnapshot[] = this.boats.map((boat) => ({
      id: boat.id,
      tribeId: boat.tribeId,
      x: boat.x,
      y: boat.y,
      cargo: boat.cargo,
      task: boat.task,
    }));

    const wagons: WagonSnapshot[] = this.wagons.map((wagon) => ({
      id: wagon.id,
      tribeId: wagon.tribeId,
      x: wagon.x,
      y: wagon.y,
      cargoType: wagon.cargoType,
      cargoAmount: wagon.cargoAmount,
      task: wagon.task,
    }));

    const caravans: CaravanSnapshot[] = this.caravans.map((caravan) => ({
      id: caravan.id,
      tribeId: caravan.tribeId,
      partnerTribeId: caravan.partnerTribeId,
      x: caravan.x,
      y: caravan.y,
      cargoType: caravan.cargoType,
      cargoAmount: caravan.cargoAmount,
      task: caravan.task,
    }));

    const siegeEngines: SiegeEngineSnapshot[] = this.siegeEngines.map((engine) => ({
      id: engine.id,
      tribeId: engine.tribeId,
      type: engine.type,
      x: engine.x,
      y: engine.y,
      targetX: engine.targetX,
      targetY: engine.targetY,
      hp: engine.hp,
      task: engine.task,
    }));

    const weather: WeatherCellSnapshot[] = this.weatherCells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      radius: cell.radius,
      intensity: cell.intensity,
      kind: cell.kind,
    }));

    const events: EventSnapshot[] = this.events.map((event) => ({ ...event }));

    const creatures: LegendaryCreatureSnapshot[] = this.creatures.map((creature) => ({
      id: creature.id,
      type: creature.type,
      name: creature.name,
      x: creature.x,
      y: creature.y,
      hp: creature.hp,
      lairX: creature.lairX,
      lairY: creature.lairY,
      active: creature.active,
    }));

    const dungeons: DungeonSnapshot[] = this.dungeons.map((dungeon) => ({
      id: dungeon.id,
      type: dungeon.type,
      name: dungeon.name,
      x: dungeon.x,
      y: dungeon.y,
      exploredBy: dungeon.exploredBy,
      lootTier: dungeon.lootTier,
    }));

    return {
      tick: this.tickCount,
      year: this.currentYear,
      season: this.season,
      tileUpdates,
      tribes: this.serializeTribes(),
      agents,
      buildings,
      plannedSites,
      animals,
      boats,
      wagons,
      caravans,
      siegeEngines,
      weather,
      events,
      creatures,
      dungeons,
    };
  }
}

export function createSimulation(seed: string, options?: { width?: number; height?: number }): Simulation {
  return new Simulation(seed, options?.width, options?.height);
}

export function describeAge(age: AgeType): string {
  return AGE_NAMES[age] ?? "Unknown";
}
