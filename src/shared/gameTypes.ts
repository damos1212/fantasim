export enum TerrainType {
  WaterDeep,
  WaterShallow,
  River,
  Beach,
  Grass,
  ForestFloor,
  Marsh,
  Desert,
  Rocky,
  Mountain,
  Snow,
  Ashland,
  Lava,
  Farmland,
}

export enum BiomeType {
  TemperatePlains,
  DeepForest,
  Alpine,
  SnowyForest,
  Tundra,
  Desert,
  Scrubland,
  Marshland,
  Coastline,
  Archipelago,
  VolcanicHighland,
  AshWaste,
}

export enum FeatureType {
  None,
  Trees,
  BerryPatch,
  StoneOutcrop,
  OreVein,
  ClayDeposit,
  FishShoal,
  Volcano,
  Reeds,
  Trench,
  IrrigationCanal,
  Palisade,
  Gate,
  StoneWall,
}

export enum UndergroundTerrainType {
  SolidRock,
  Tunnel,
  Cavern,
  UndergroundRiver,
  Magma,
  Ruins,
}

export enum UndergroundFeatureType {
  None,
  OreSeam,
  CrystalCluster,
  MushroomGrove,
  RootTangle,
  AncientRemains,
}

export enum ResourceType {
  None,
  Berries,
  Grain,
  Wood,
  Stone,
  Ore,
  Clay,
  Fish,
  Meat,
  Hides,
  Horses,
  Livestock,
  Rations,
  Planks,
  Bricks,
  Charcoal,
  StoneTools,
  BronzeTools,
  IronTools,
  BasicWeapons,
  MetalWeapons,
  BasicArmor,
  MetalArmor,
}

export enum BuildingType {
  CapitalHall,
  House,
  Stockpile,
  Warehouse,
  Cistern,
  Farm,
  Orchard,
  LumberCamp,
  Quarry,
  Mine,
  Workshop,
  School,
  Smithy,
  Armory,
  Dock,
  FishingHut,
  Fishery,
  Stable,
  Barracks,
  Watchtower,
  MountainHall,
  DeepMine,
  TunnelEntrance,
  Shrine,
  Tavern,
  Infirmary,
  MageTower,
  ArcaneSanctum,
  Foundry,
  Factory,
  RailDepot,
  PowerPlant,
  Airfield,
  Castle,
}

export enum AgeType {
  Primitive,
  Stone,
  Bronze,
  Iron,
  Medieval,
  Gunpowder,
  Industrial,
  Modern,
}

export enum RaceType {
  Humans,
  Elves,
  Dwarves,
  Orcs,
  Goblins,
  Halflings,
  Nomads,
  Darkfolk,
}

export enum AgentRole {
  Worker,
  Farmer,
  Woodcutter,
  Miner,
  Builder,
  Hauler,
  Fisher,
  Crafter,
  Scholar,
  Soldier,
  Rider,
  Mage,
}

export enum AgentConditionType {
  Steady,
  Hungry,
  Cold,
  Weary,
  Exhausted,
  Sick,
  Feverish,
  Inspired,
}

export enum AnimalType {
  Deer,
  Boar,
  Wolf,
  Horse,
  Sheep,
  Goat,
}

export enum BoatTaskType {
  Idle,
  ToFish,
  ReturnToDock,
}

export enum CaravanTaskType {
  ToPartner,
  ReturnHome,
}

export enum WagonTaskType {
  Idle,
  ToSource,
  ToDrop,
}

export enum WeatherKind {
  Clear,
  Rain,
  Storm,
  Blizzard,
  Heatwave,
  AshStorm,
  Fog,
}

export enum LegendaryCreatureType {
  Dragon,
  SeaSerpent,
  ForestSpirit,
  AshTitan,
}

export enum DungeonType {
  Cave,
  Ruin,
  Crypt,
  DeepDelve,
}

export enum SiegeEngineType {
  BatteringRam,
  Trebuchet,
  Ballista,
  SiegeTower,
  Cannon,
  Mortar,
  Tank,
  Zeppelin,
}

export enum DiplomacyState {
  Alliance,
  Friendly,
  Neutral,
  Suspicious,
  Hostile,
  War,
}

export enum SeasonType {
  Spring,
  Summer,
  Autumn,
  Winter,
}

export type Personality = {
  aggression: number;
  expansion: number;
  industry: number;
  diplomacy: number;
  ecology: number;
  militarism: number;
  trade: number;
  risk: number;
};

export type RaceDef = {
  type: RaceType;
  name: string;
  preferredBiomes: BiomeType[];
  color: number;
  personality: Personality;
  foodBias: number;
  buildBias: number;
  militaryBias: number;
  diplomacyBias: number;
};

export type BuildingDef = {
  type: BuildingType;
  name: string;
  size: [number, number];
  minAge: AgeType;
  cost: Partial<Record<ResourceType, number>>;
};

export type ResourceBag = Record<number, number>;

export type TileUpdate = {
  index: number;
  terrain: TerrainType;
  feature: FeatureType;
  surfaceWater: number;
  undergroundTerrain: UndergroundTerrainType;
  undergroundFeature: UndergroundFeatureType;
  undergroundResourceType: ResourceType;
  undergroundResourceAmount: number;
  resourceType: ResourceType;
  resourceAmount: number;
  road: number;
  owner: number;
};

export type StaticWorldData = {
  width: number;
  height: number;
  elevation: Uint8Array;
  terrain: Uint8Array;
  biome: Uint8Array;
  feature: Uint8Array;
  surfaceWater: Uint8Array;
  undergroundTerrain: Uint8Array;
  undergroundFeature: Uint8Array;
  undergroundResourceType: Uint8Array;
  undergroundResourceAmount: Uint16Array;
  fertility: Uint8Array;
  temperature: Uint8Array;
  moisture: Uint8Array;
};

export type TribeSummary = {
  id: number;
  race: RaceType;
  name: string;
  color: number;
  age: AgeType;
  population: number;
  housing: number;
  rulerName: string;
  rulerTitle: string;
  successionCount: number;
  food: number;
  wood: number;
  stone: number;
  ore: number;
  research: number;
  faith: number;
  water: number;
  morale: number;
  horses: number;
  boats: number;
  wagons: number;
  livestock: number;
  flooded: number;
  delves: number;
  undergroundTiles: number;
  waterworks: number;
  powerPlants: number;
  airfields: number;
  contacts: number;
  allies: number;
  tradePartners: number;
  tributeTo: number | null;
  tributaries: number;
  siege: number;
  magic: number;
  activity: string;
  doctrine: string;
  soldiers: number;
  heroes: number;
  wounded: number;
  armyPower: number;
  builders: number;
  farmers: number;
  fishers: number;
  miners: number;
  crafters: number;
  scholars: number;
  sick: number;
  exhausted: number;
  inspired: number;
  enemyCount: number;
  weather: WeatherKind;
  techs: string[];
  capitalX: number;
  capitalY: number;
  diplomacy: DiplomacyState[];
};

export type GearSnapshot = {
  weapon: string;
  armor: string;
  trinket: string;
  power: number;
  rarity: string;
};

export type AgentSnapshot = {
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
  ageYears: number;
  role: AgentRole;
  x: number;
  y: number;
  moveToX: number;
  moveToY: number;
  targetX: number;
  targetY: number;
  health: number;
  fatigue: number;
  sickness: number;
  inspiration: number;
  task: string;
  underground: boolean;
  carrying: ResourceType;
  carryingAmount: number;
  gear: GearSnapshot;
};

export type BuildingSnapshot = {
  id: number;
  tribeId: number;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  level: number;
  stockResource: ResourceType;
  stockAmount: number;
};

export type PlannedSiteSnapshot = {
  tribeId: number;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  supplied: number;
  supplyNeeded: number;
};

export type AnimalSnapshot = {
  id: number;
  type: AnimalType;
  x: number;
  y: number;
  moveToX: number;
  moveToY: number;
};

export type BoatSnapshot = {
  id: number;
  tribeId: number;
  x: number;
  y: number;
  moveToX: number;
  moveToY: number;
  cargo: number;
  task: BoatTaskType;
};

export type CaravanSnapshot = {
  id: number;
  tribeId: number;
  partnerTribeId: number;
  x: number;
  y: number;
  moveToX: number;
  moveToY: number;
  cargoType: ResourceType;
  cargoAmount: number;
  task: CaravanTaskType;
};

export type WagonSnapshot = {
  id: number;
  tribeId: number;
  x: number;
  y: number;
  moveToX: number;
  moveToY: number;
  cargoType: ResourceType;
  cargoAmount: number;
  task: WagonTaskType;
};

export type SiegeEngineSnapshot = {
  id: number;
  tribeId: number;
  type: SiegeEngineType;
  x: number;
  y: number;
  moveToX: number;
  moveToY: number;
  targetX: number;
  targetY: number;
  hp: number;
  task: string;
};

export type WeatherCellSnapshot = {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  kind: WeatherKind;
};

export type EventSnapshot = {
  id: number;
  tick: number;
  kind: string;
  title: string;
  description: string;
  x: number;
  y: number;
  tribeId: number | null;
};

export type LegendaryCreatureSnapshot = {
  id: number;
  type: LegendaryCreatureType;
  name: string;
  x: number;
  y: number;
  hp: number;
  lairX: number;
  lairY: number;
  active: boolean;
};

export type DungeonSnapshot = {
  id: number;
  type: DungeonType;
  name: string;
  x: number;
  y: number;
  exploredBy: number | null;
  lootTier: number;
};

export type DynamicSnapshot = {
  tick: number;
  year: number;
  season: SeasonType;
  tileUpdates: TileUpdate[];
  tribes: TribeSummary[];
  agents: AgentSnapshot[];
  buildings: BuildingSnapshot[];
  plannedSites: PlannedSiteSnapshot[];
  animals: AnimalSnapshot[];
  boats: BoatSnapshot[];
  wagons: WagonSnapshot[];
  caravans: CaravanSnapshot[];
  siegeEngines: SiegeEngineSnapshot[];
  weather: WeatherCellSnapshot[];
  events: EventSnapshot[];
  creatures: LegendaryCreatureSnapshot[];
  dungeons: DungeonSnapshot[];
};

export type InitMessage = {
  type: "init";
  seed: string;
};

export type ControlMessage = {
  type: "control";
  paused?: boolean;
  speed?: 1 | 2 | 4 | 8;
};

export type WorkerInboundMessage = InitMessage | ControlMessage;

export type WorldMessage =
  | {
      type: "world-init";
      world: StaticWorldData;
      tribes: TribeSummary[];
    }
  | {
      type: "snapshot";
      snapshot: DynamicSnapshot;
    };

export const BUILDING_DEFS: BuildingDef[] = [
  { type: BuildingType.CapitalHall, name: "Capital Hall", size: [3, 3], minAge: AgeType.Primitive, cost: { [ResourceType.Wood]: 36, [ResourceType.Stone]: 20 } },
  { type: BuildingType.House, name: "House", size: [2, 2], minAge: AgeType.Primitive, cost: { [ResourceType.Wood]: 16 } },
  { type: BuildingType.Stockpile, name: "Stockpile", size: [2, 2], minAge: AgeType.Primitive, cost: { [ResourceType.Wood]: 10 } },
  { type: BuildingType.Warehouse, name: "Warehouse", size: [3, 2], minAge: AgeType.Stone, cost: { [ResourceType.Wood]: 20, [ResourceType.Stone]: 8 } },
  { type: BuildingType.Cistern, name: "Cistern", size: [2, 2], minAge: AgeType.Primitive, cost: { [ResourceType.Stone]: 12, [ResourceType.Clay]: 6 } },
  { type: BuildingType.Farm, name: "Farm", size: [3, 3], minAge: AgeType.Primitive, cost: { [ResourceType.Wood]: 10 } },
  { type: BuildingType.Orchard, name: "Orchard", size: [3, 3], minAge: AgeType.Stone, cost: { [ResourceType.Wood]: 12 } },
  { type: BuildingType.LumberCamp, name: "Lumber Camp", size: [2, 2], minAge: AgeType.Primitive, cost: { [ResourceType.Wood]: 12, [ResourceType.Stone]: 8 } },
  { type: BuildingType.Quarry, name: "Quarry", size: [2, 2], minAge: AgeType.Primitive, cost: { [ResourceType.Wood]: 10, [ResourceType.Stone]: 4 } },
  { type: BuildingType.Mine, name: "Mine", size: [2, 2], minAge: AgeType.Stone, cost: { [ResourceType.Wood]: 16, [ResourceType.Stone]: 10 } },
  { type: BuildingType.Workshop, name: "Workshop", size: [2, 2], minAge: AgeType.Stone, cost: { [ResourceType.Wood]: 20, [ResourceType.Stone]: 8 } },
  { type: BuildingType.School, name: "School", size: [2, 2], minAge: AgeType.Bronze, cost: { [ResourceType.Wood]: 18, [ResourceType.Stone]: 6 } },
  { type: BuildingType.Smithy, name: "Smithy", size: [2, 2], minAge: AgeType.Iron, cost: { [ResourceType.Wood]: 16, [ResourceType.Stone]: 16, [ResourceType.Ore]: 8 } },
  { type: BuildingType.Armory, name: "Armory", size: [2, 2], minAge: AgeType.Iron, cost: { [ResourceType.Wood]: 14, [ResourceType.Stone]: 14, [ResourceType.Ore]: 8 } },
  { type: BuildingType.Dock, name: "Dock", size: [2, 3], minAge: AgeType.Medieval, cost: { [ResourceType.Wood]: 30, [ResourceType.Planks]: 12 } },
  { type: BuildingType.FishingHut, name: "Fishing Hut", size: [2, 2], minAge: AgeType.Medieval, cost: { [ResourceType.Wood]: 14, [ResourceType.Planks]: 8 } },
  { type: BuildingType.Fishery, name: "Fishery", size: [3, 2], minAge: AgeType.Medieval, cost: { [ResourceType.Wood]: 18, [ResourceType.Planks]: 10, [ResourceType.Stone]: 6 } },
  { type: BuildingType.Stable, name: "Stable", size: [2, 3], minAge: AgeType.Medieval, cost: { [ResourceType.Wood]: 22, [ResourceType.Planks]: 8 } },
  { type: BuildingType.Barracks, name: "Barracks", size: [3, 2], minAge: AgeType.Bronze, cost: { [ResourceType.Wood]: 18, [ResourceType.Stone]: 12 } },
  { type: BuildingType.Watchtower, name: "Watchtower", size: [1, 1], minAge: AgeType.Iron, cost: { [ResourceType.Wood]: 10, [ResourceType.Stone]: 10 } },
  { type: BuildingType.MountainHall, name: "Mountain Hall", size: [2, 2], minAge: AgeType.Primitive, cost: { [ResourceType.Wood]: 10, [ResourceType.Stone]: 18 } },
  { type: BuildingType.DeepMine, name: "Deep Mine", size: [2, 2], minAge: AgeType.Iron, cost: { [ResourceType.Wood]: 12, [ResourceType.Stone]: 16, [ResourceType.Ore]: 6 } },
  { type: BuildingType.TunnelEntrance, name: "Tunnel Entrance", size: [2, 2], minAge: AgeType.Bronze, cost: { [ResourceType.Wood]: 10, [ResourceType.Stone]: 14 } },
  { type: BuildingType.Shrine, name: "Shrine", size: [2, 2], minAge: AgeType.Stone, cost: { [ResourceType.Wood]: 14, [ResourceType.Stone]: 8 } },
  { type: BuildingType.Tavern, name: "Tavern", size: [2, 2], minAge: AgeType.Bronze, cost: { [ResourceType.Wood]: 16, [ResourceType.Stone]: 6 } },
  { type: BuildingType.Infirmary, name: "Infirmary", size: [2, 2], minAge: AgeType.Iron, cost: { [ResourceType.Wood]: 18, [ResourceType.Stone]: 10, [ResourceType.Clay]: 6 } },
  { type: BuildingType.MageTower, name: "Mage Tower", size: [2, 3], minAge: AgeType.Medieval, cost: { [ResourceType.Wood]: 24, [ResourceType.Stone]: 22, [ResourceType.Ore]: 8 } },
  { type: BuildingType.ArcaneSanctum, name: "Arcane Sanctum", size: [3, 3], minAge: AgeType.Gunpowder, cost: { [ResourceType.Wood]: 20, [ResourceType.Stone]: 26, [ResourceType.Ore]: 10, [ResourceType.Bricks]: 8 } },
  { type: BuildingType.Foundry, name: "Foundry", size: [3, 2], minAge: AgeType.Gunpowder, cost: { [ResourceType.Wood]: 18, [ResourceType.Stone]: 18, [ResourceType.Ore]: 12, [ResourceType.Bricks]: 10 } },
  { type: BuildingType.Factory, name: "Factory", size: [3, 3], minAge: AgeType.Industrial, cost: { [ResourceType.Wood]: 22, [ResourceType.Stone]: 24, [ResourceType.Ore]: 18, [ResourceType.Bricks]: 12 } },
  { type: BuildingType.RailDepot, name: "Rail Depot", size: [3, 2], minAge: AgeType.Industrial, cost: { [ResourceType.Wood]: 18, [ResourceType.Stone]: 14, [ResourceType.Ore]: 14, [ResourceType.Planks]: 8 } },
  { type: BuildingType.PowerPlant, name: "Power Plant", size: [3, 3], minAge: AgeType.Modern, cost: { [ResourceType.Stone]: 26, [ResourceType.Ore]: 24, [ResourceType.Bricks]: 14 } },
  { type: BuildingType.Airfield, name: "Airfield", size: [4, 3], minAge: AgeType.Modern, cost: { [ResourceType.Wood]: 14, [ResourceType.Stone]: 20, [ResourceType.Ore]: 22, [ResourceType.Bricks]: 10 } },
  { type: BuildingType.Castle, name: "Castle", size: [4, 4], minAge: AgeType.Medieval, cost: { [ResourceType.Wood]: 40, [ResourceType.Stone]: 70, [ResourceType.Planks]: 20 } },
];

export const RACE_DEFS: RaceDef[] = [
  {
    type: RaceType.Humans,
    name: "Humans",
    preferredBiomes: [BiomeType.TemperatePlains, BiomeType.Coastline, BiomeType.Archipelago],
    color: 0xe2c37a,
    personality: { aggression: 0.45, expansion: 0.6, industry: 0.6, diplomacy: 0.7, ecology: 0.4, militarism: 0.55, trade: 0.75, risk: 0.55 },
    foodBias: 1,
    buildBias: 1,
    militaryBias: 1,
    diplomacyBias: 1.2,
  },
  {
    type: RaceType.Elves,
    name: "Elves",
    preferredBiomes: [BiomeType.DeepForest, BiomeType.SnowyForest],
    color: 0x71c08d,
    personality: { aggression: 0.28, expansion: 0.45, industry: 0.5, diplomacy: 0.45, ecology: 0.95, militarism: 0.45, trade: 0.45, risk: 0.35 },
    foodBias: 1.1,
    buildBias: 0.95,
    militaryBias: 0.9,
    diplomacyBias: 1,
  },
  {
    type: RaceType.Dwarves,
    name: "Dwarves",
    preferredBiomes: [BiomeType.Alpine, BiomeType.Tundra],
    color: 0x9bb6c8,
    personality: { aggression: 0.35, expansion: 0.5, industry: 0.95, diplomacy: 0.4, ecology: 0.3, militarism: 0.65, trade: 0.55, risk: 0.4 },
    foodBias: 0.85,
    buildBias: 1.25,
    militaryBias: 1.1,
    diplomacyBias: 0.8,
  },
  {
    type: RaceType.Orcs,
    name: "Orcs",
    preferredBiomes: [BiomeType.VolcanicHighland, BiomeType.AshWaste],
    color: 0xb85645,
    personality: { aggression: 0.9, expansion: 0.7, industry: 0.65, diplomacy: 0.2, ecology: 0.1, militarism: 0.95, trade: 0.15, risk: 0.85 },
    foodBias: 0.95,
    buildBias: 1,
    militaryBias: 1.35,
    diplomacyBias: 0.4,
  },
  {
    type: RaceType.Goblins,
    name: "Goblins",
    preferredBiomes: [BiomeType.Scrubland, BiomeType.AshWaste],
    color: 0x9bc459,
    personality: { aggression: 0.65, expansion: 0.85, industry: 0.5, diplomacy: 0.25, ecology: 0.25, militarism: 0.7, trade: 0.2, risk: 0.95 },
    foodBias: 0.95,
    buildBias: 0.9,
    militaryBias: 1,
    diplomacyBias: 0.55,
  },
  {
    type: RaceType.Halflings,
    name: "Halflings",
    preferredBiomes: [BiomeType.TemperatePlains, BiomeType.Coastline],
    color: 0xd0db85,
    personality: { aggression: 0.18, expansion: 0.45, industry: 0.6, diplomacy: 0.65, ecology: 0.75, militarism: 0.2, trade: 0.6, risk: 0.3 },
    foodBias: 1.25,
    buildBias: 0.95,
    militaryBias: 0.65,
    diplomacyBias: 1.1,
  },
  {
    type: RaceType.Nomads,
    name: "Nomads",
    preferredBiomes: [BiomeType.Desert, BiomeType.Scrubland],
    color: 0xd29a63,
    personality: { aggression: 0.45, expansion: 0.8, industry: 0.45, diplomacy: 0.5, ecology: 0.25, militarism: 0.55, trade: 0.5, risk: 0.8 },
    foodBias: 0.9,
    buildBias: 0.8,
    militaryBias: 1,
    diplomacyBias: 0.9,
  },
  {
    type: RaceType.Darkfolk,
    name: "Darkfolk",
    preferredBiomes: [BiomeType.AshWaste, BiomeType.VolcanicHighland],
    color: 0x8f77b5,
    personality: { aggression: 0.7, expansion: 0.55, industry: 0.8, diplomacy: 0.15, ecology: 0.15, militarism: 0.8, trade: 0.1, risk: 0.55 },
    foodBias: 0.9,
    buildBias: 1.1,
    militaryBias: 1.15,
    diplomacyBias: 0.45,
  },
];

export const RACE_NAMES = RACE_DEFS.map((race) => race.name);

export const AGE_NAMES = ["Primitive", "Stone", "Bronze", "Iron", "Medieval", "Gunpowder", "Industrial", "Modern"] as const;
export const SEASON_NAMES = ["Spring", "Summer", "Autumn", "Winter"] as const;
