import { Application, Container, Graphics, Sprite, Text, TextStyle, Texture, type TextStyleOptions } from "pixi.js";

import { SIM_TICKS_PER_SECOND, SNAPSHOT_TICKS, TILE_SIZE } from "../shared/config";
import { indexOf } from "../shared/grid";
import {
  AgentConditionType,
  AgentRole,
  AgentSnapshot,
  AgeType,
  AnimalSnapshot,
  AnimalType,
  BiomeType,
  BranchSnapshot,
  BoatSnapshot,
  BoatTaskType,
  BuildingSnapshot,
  BuildingType,
  CaravanSnapshot,
  CaravanTaskType,
  DynamicSnapshot,
  DungeonSnapshot,
  DungeonType,
  EventSnapshot,
  FeatureType,
  LegendaryCreatureSnapshot,
  LegendaryCreatureType,
  PlannedSiteSnapshot,
  RaceType,
  ResourceType,
  SeasonType,
  SiegeEngineSnapshot,
  SiegeEngineType,
  StaticWorldData,
  TerrainType,
  TribeSummary,
  UndergroundFeatureType,
  UndergroundTerrainType,
  WagonSnapshot,
  WagonTaskType,
  WeatherCellSnapshot,
  WeatherKind,
} from "../shared/gameTypes";

const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.WaterDeep]: 0x1b4261,
  [TerrainType.WaterShallow]: 0x377aa1,
  [TerrainType.River]: 0x4e96bf,
  [TerrainType.Beach]: 0xd6c08f,
  [TerrainType.Grass]: 0x6a9553,
  [TerrainType.ForestFloor]: 0x35573a,
  [TerrainType.Marsh]: 0x4a6853,
  [TerrainType.Desert]: 0xbf9555,
  [TerrainType.Rocky]: 0x717d85,
  [TerrainType.Mountain]: 0x98a0a7,
  [TerrainType.Snow]: 0xd9e5ef,
  [TerrainType.Ashland]: 0x4e4949,
  [TerrainType.Lava]: 0xdb5c2f,
  [TerrainType.Farmland]: 0x7ea347,
};

const UNDERGROUND_TERRAIN_COLORS: Record<UndergroundTerrainType, number> = {
  [UndergroundTerrainType.SolidRock]: 0x2a3138,
  [UndergroundTerrainType.Tunnel]: 0x60574a,
  [UndergroundTerrainType.Cavern]: 0x444d57,
  [UndergroundTerrainType.UndergroundRiver]: 0x225d7d,
  [UndergroundTerrainType.Magma]: 0x8e3d22,
  [UndergroundTerrainType.Ruins]: 0x585166,
};

const FEATURE_NAMES = ["None", "Trees", "Berry Patch", "Stone", "Ore", "Clay", "Fish", "Volcano", "Reeds", "Trench", "Canal", "Palisade", "Gate", "Stone Wall"] as const;
const UNDERGROUND_FEATURE_NAMES = ["None", "Ore Seam", "Crystal Cluster", "Mushroom Grove", "Root Tangle", "Ancient Remains"] as const;
const TERRAIN_NAMES = ["Deep Water", "Shallow Water", "River", "Beach", "Grass", "Forest Floor", "Marsh", "Desert", "Rocky", "Mountain", "Snow", "Ashland", "Lava", "Farmland"] as const;
const UNDERGROUND_TERRAIN_NAMES = ["Solid Rock", "Tunnel", "Cavern", "Underground River", "Magma", "Ruins"] as const;
const BIOME_NAMES = ["Temperate Plains", "Deep Forest", "Alpine", "Snowy Forest", "Tundra", "Desert", "Scrubland", "Marshland", "Coastline", "Archipelago", "Volcanic Highland", "Ash Waste"] as const;
const BUILDING_NAMES = ["Capital Hall", "House", "Stockpile", "Warehouse", "Cistern", "Farm", "Orchard", "Lumber Camp", "Quarry", "Mine", "Workshop", "School", "Smithy", "Armory", "Dock", "Fishing Hut", "Fishery", "Stable", "Barracks", "Watchtower", "Mountain Hall", "Deep Mine", "Tunnel Entrance", "Shrine", "Tavern", "Infirmary", "Mage Tower", "Arcane Sanctum", "Foundry", "Factory", "Rail Depot", "Power Plant", "Airfield", "Castle"] as const;
const AGE_NAMES = ["Primitive", "Stone", "Bronze", "Iron", "Medieval", "Gunpowder", "Industrial", "Modern"] as const;
const SEASON_NAMES = ["Spring", "Summer", "Autumn", "Winter"] as const;
const RACE_NAMES = ["Humans", "Elves", "Dwarves", "Orcs", "Goblins", "Halflings", "Nomads", "Darkfolk"] as const;
const WEATHER_NAMES = ["Clear", "Rain", "Storm", "Blizzard", "Heatwave", "Ash Storm", "Fog"] as const;
const DUNGEON_NAMES = ["Cave", "Ruin", "Crypt", "Deep Delve"] as const;
const CONDITION_NAMES = ["Steady", "Hungry", "Cold", "Weary", "Exhausted", "Sick", "Feverish", "Inspired"] as const;

const ROLE_ACCENTS: Record<AgentRole, number> = {
  [AgentRole.Worker]: 0xf0efe8,
  [AgentRole.Farmer]: 0xb9d760,
  [AgentRole.Woodcutter]: 0x6ac16c,
  [AgentRole.Miner]: 0xb0c7d7,
  [AgentRole.Builder]: 0xf1c574,
  [AgentRole.Hauler]: 0xd7c6ae,
  [AgentRole.Fisher]: 0x76cee0,
  [AgentRole.Crafter]: 0xd89360,
  [AgentRole.Scholar]: 0xc9a0e9,
  [AgentRole.Soldier]: 0xde6c62,
  [AgentRole.Rider]: 0xca8ff0,
  [AgentRole.Mage]: 0x7fafff,
};

const ANIMAL_COLORS: Record<AnimalType, number> = {
  [AnimalType.Deer]: 0xc6a16a,
  [AnimalType.Boar]: 0x7e6554,
  [AnimalType.Wolf]: 0x93a0b0,
  [AnimalType.Horse]: 0xa8794e,
  [AnimalType.Sheep]: 0xe7ecef,
  [AnimalType.Goat]: 0xd9d1c0,
};

type Selection = {
  x: number;
  y: number;
};

type SidebarTab = "inspect" | "tribes" | "events" | "legends" | "world";
type ViewMode = "surface" | "underground";
type RenderFilterKey = "armies" | "trade" | "weather" | "underground" | "creatures";

type MotionState = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

type PixelTarget = Graphics | CanvasRenderingContext2D;

const STATIC_CHUNK_TILES = 16;

type StaticChunkCache = {
  key: string;
  chunkX: number;
  chunkY: number;
  lodStep: number;
  viewMode: ViewMode;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: Texture;
  sprite: Sprite;
  dirty: boolean;
};

type IconSpriteState = {
  sprite: Sprite;
  textureKey: string;
};

type RenderFilters = Record<RenderFilterKey, boolean>;

type RenderState = {
  world: StaticWorldData | null;
  terrain: Uint8Array | null;
  elevation: Uint8Array | null;
  biome: Uint8Array | null;
  feature: Uint8Array | null;
  surfaceWater: Uint8Array | null;
  undergroundTerrain: Uint8Array | null;
  undergroundFeature: Uint8Array | null;
  undergroundResourceType: Uint8Array | null;
  undergroundResourceAmount: Uint16Array | null;
  fertility: Uint8Array | null;
  moisture: Uint8Array | null;
  temperature: Uint8Array | null;
  road: Uint8Array | null;
  owner: Int16Array | null;
  resourceType: Uint8Array | null;
  resourceAmount: Uint16Array | null;
  tribes: TribeSummary[];
  branches: BranchSnapshot[];
  buildings: BuildingSnapshot[];
  plannedSites: PlannedSiteSnapshot[];
  agents: AgentSnapshot[];
  animals: AnimalSnapshot[];
  boats: BoatSnapshot[];
  wagons: WagonSnapshot[];
  caravans: CaravanSnapshot[];
  siegeEngines: SiegeEngineSnapshot[];
  weather: WeatherCellSnapshot[];
  events: EventSnapshot[];
  creatures: LegendaryCreatureSnapshot[];
  dungeons: DungeonSnapshot[];
  tick: number;
  year: number;
  season: SeasonType;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lighten(color: number, amount: number): number {
  const r = clamp(((color >> 16) & 0xff) + amount, 0, 255);
  const g = clamp(((color >> 8) & 0xff) + amount, 0, 255);
  const b = clamp((color & 0xff) + amount, 0, 255);
  return (r << 16) | (g << 8) | b;
}

function darken(color: number, amount: number): number {
  return lighten(color, -amount);
}

function raceMaterial(race: RaceType, age: AgeType, tribeColor: number): { wall: number; roof: number; trim: number; banner: number } {
  switch (race) {
    case RaceType.Elves:
      return { wall: lighten(tribeColor, 8), roof: age >= AgeType.Iron ? 0x426d4e : 0x5b8b64, trim: 0xc6ddb1, banner: 0x9be6b2 };
    case RaceType.Dwarves:
      return { wall: age >= AgeType.Bronze ? 0x6f7986 : 0x7d7368, roof: 0x4b4f58, trim: 0xcfd6dc, banner: 0xe1b866 };
    case RaceType.Orcs:
      return { wall: darken(tribeColor, 12), roof: 0x533223, trim: 0xd99757, banner: 0xcf5447 };
    case RaceType.Goblins:
      return { wall: darken(tribeColor, 20), roof: 0x5c5c49, trim: 0x9ac27d, banner: 0xd8c76d };
    case RaceType.Halflings:
      return { wall: lighten(tribeColor, 20), roof: 0x8e5a39, trim: 0xf7e4a1, banner: 0xc68552 };
    case RaceType.Nomads:
      return { wall: 0xc4a57a, roof: age >= AgeType.Iron ? 0x7c5438 : 0xa16f44, trim: 0xf5d9a6, banner: 0x7bc9d5 };
    case RaceType.Darkfolk:
      return { wall: darken(tribeColor, 24), roof: 0x2e2737, trim: 0xbca7e3, banner: 0x8e73de };
    case RaceType.Humans:
    default:
      return { wall: 0xc39b68, roof: age >= AgeType.Medieval ? 0x6a4430 : 0x8a613d, trim: 0xf0dfbf, banner: 0xb24d36 };
  }
}

function gearAccent(agent: AgentSnapshot, race: RaceType): { weapon: number; armor: number; cloth: number } {
  const weapon = agent.gear.weapon.includes("Steel") || agent.gear.weapon.includes("Iron")
    ? 0xc5d2da
    : agent.gear.weapon.includes("Bronze")
      ? 0xc39a5a
      : race === RaceType.Orcs ? 0x9c7851 : 0xb79262;
  const armor = agent.gear.armor.includes("Knight") ? 0xbecad4 : agent.gear.armor.includes("Iron") ? 0x9eacb8 : agent.gear.armor.includes("Bronze") ? 0xb18758 : 0x8b7458;
  const cloth = race === RaceType.Elves ? 0x8dd0a1 : race === RaceType.Darkfolk ? 0x9d87d7 : race === RaceType.Nomads ? 0xd2bb83 : 0xf0efe8;
  return { weapon, armor, cloth };
}

function shieldColor(race: RaceType): number {
  if (race === RaceType.Dwarves) return 0x6d7784;
  if (race === RaceType.Humans) return 0xa56b43;
  return 0x9a845e;
}

function entityPosition(
  motion: Map<number, MotionState>,
  id: number,
  fallbackX: number,
  fallbackY: number,
  alpha: number,
  previewX = fallbackX,
  previewY = fallbackY,
): { x: number; y: number } {
  const state = motion.get(id);
  if (!state) {
    const previewEase = alpha <= 0 ? 0 : alpha >= 1 ? 1 : alpha * alpha * (3 - 2 * alpha);
    return {
      x: fallbackX + (previewX - fallbackX) * previewEase,
      y: fallbackY + (previewY - fallbackY) * previewEase,
    };
  }
  const eased = alpha <= 0 ? 0 : alpha >= 1 ? 1 : alpha * alpha * (3 - 2 * alpha);
  if (state.fromX === state.toX && state.fromY === state.toY && (previewX !== state.toX || previewY !== state.toY)) {
    const previewEase = eased * 0.92;
    return {
      x: state.toX + (previewX - state.toX) * previewEase,
      y: state.toY + (previewY - state.toY) * previewEase,
    };
  }
  return {
    x: state.fromX + (state.toX - state.fromX) * eased,
    y: state.fromY + (state.toY - state.fromY) * eased,
  };
}

function resourceVisualColor(resourceType: ResourceType): number {
  switch (resourceType) {
    case ResourceType.Wood:
    case ResourceType.Planks:
      return 0x9b7145;
    case ResourceType.Stone:
    case ResourceType.BasicArmor:
    case ResourceType.MetalArmor:
      return 0xb8c1c8;
    case ResourceType.Ore:
    case ResourceType.MetalWeapons:
      return 0xc08a56;
    case ResourceType.Clay:
    case ResourceType.Bricks:
      return 0xa66c4a;
    case ResourceType.Grain:
    case ResourceType.Rations:
      return 0xf0d780;
    case ResourceType.Berries:
      return 0xc64a70;
    case ResourceType.Fish:
      return 0x9ddff3;
    case ResourceType.Meat:
      return 0xc76e5f;
    case ResourceType.StoneTools:
    case ResourceType.BronzeTools:
    case ResourceType.IronTools:
      return 0xd2d7dc;
    default:
      return 0xf4d36c;
  }
}

function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function drawPixelRect(target: PixelTarget, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  if ("fillRect" in target) {
    const previousAlpha = target.globalAlpha;
    target.globalAlpha = previousAlpha * alpha;
    target.fillStyle = colorHex(color);
    target.fillRect(x, y, w, h);
    target.globalAlpha = previousAlpha;
    return;
  }
  target.beginFill(color, alpha);
  target.drawRect(x, y, w, h);
  target.endFill();
}

export class GameRenderer {
  readonly root: HTMLElement;
  readonly app = new Application();
  readonly shell = document.createElement("div");
  readonly hud = document.createElement("div");
  readonly topbar = document.createElement("div");
  readonly sidebar = document.createElement("div");
  readonly sidebarTabs = document.createElement("div");
  readonly sidebarBody = document.createElement("div");
  readonly minimap = document.createElement("canvas");
  readonly minimapBackdrop = document.createElement("canvas");
  readonly loadingOverlay = document.createElement("div");

  readonly worldContainer = new Container();
  readonly staticChunkLayer = new Container();
  readonly terrainGraphics = new Graphics();
  readonly overlayGraphics = new Graphics();
  readonly buildingGraphics = new Graphics();
  readonly atmosphereGraphics = new Graphics();
  readonly iconLayer = new Container();
  readonly unitGraphics = new Graphics();
  readonly selectionGraphics = new Graphics();
  readonly labelLayer = new Container();
  readonly labelSprites = new Map<number, Text>();
  readonly labelStyleCache = new Map<string, TextStyle>();
  readonly labelStyleKeyByAgentId = new Map<number, string>();
  readonly staticChunks = new Map<string, StaticChunkCache>();
  readonly iconTextures = new Map<string, Texture>();
  readonly iconSprites = new Map<string, IconSpriteState>();

  readonly state: RenderState = {
    world: null,
    terrain: null,
    elevation: null,
    biome: null,
    feature: null,
    surfaceWater: null,
    undergroundTerrain: null,
    undergroundFeature: null,
    undergroundResourceType: null,
    undergroundResourceAmount: null,
    fertility: null,
    moisture: null,
    temperature: null,
    road: null,
    owner: null,
    resourceType: null,
    resourceAmount: null,
    tribes: [],
    branches: [],
    buildings: [],
    plannedSites: [],
    agents: [],
    animals: [],
    boats: [],
    wagons: [],
    caravans: [],
    siegeEngines: [],
    weather: [],
    events: [],
    creatures: [],
    dungeons: [],
    tick: 0,
    year: 0,
    season: SeasonType.Spring,
  };

  readonly agentMotion = new Map<number, MotionState>();
  readonly animalMotion = new Map<number, MotionState>();
  readonly boatMotion = new Map<number, MotionState>();
  readonly wagonMotion = new Map<number, MotionState>();
  readonly caravanMotion = new Map<number, MotionState>();
  readonly siegeMotion = new Map<number, MotionState>();
  workerPort: Worker | null = null;

  cameraX = 0;
  cameraY = 0;
  zoom = 1.18;
  dragging = false;
  dragMoved = false;
  lastPointer = { x: 0, y: 0 };
  selection: Selection | null = null;
  selectedTribeId: number | null = null;
  compareTribeId: number | null = null;
  selectedUnitId: number | null = null;
  followSelectedUnit = false;
  sidebarTab: SidebarTab = "inspect";
  renderedSidebarTab: SidebarTab = "inspect";
  viewMode: ViewMode = "surface";
  simSpeed: 1 | 2 | 4 | 8 = 1;
  paused = false;
  eventKindFilter = "all";
  renderFilters: RenderFilters = {
    armies: true,
    trade: true,
    weather: true,
    underground: true,
    creatures: true,
  };
  lastSnapshotAt = performance.now();
  lastFrameAt = performance.now();
  presentationClock = 0;
  lastHudRenderAt = 0;
  hudDirty = true;
  lastTopbarMarkup = "";
  lastSidebarTabsMarkup = "";
  lastSidebarBodyMarkup = "";
  sidebarScrollTopByTab: Record<SidebarTab, number> = {
    inspect: 0,
    tribes: 0,
    events: 0,
    legends: 0,
    world: 0,
  };
  minimapDirty = true;
  minimapTerrainDirty = true;
  lastMinimapDrawAt = 0;
  lastMinimapCameraX = Number.NaN;
  lastMinimapCameraY = Number.NaN;
  lastMinimapZoom = Number.NaN;
  staticSceneDirty = true;
  lastStaticViewportSignature = "";
  lastStaticRenderAt = 0;
  atmosphereDirty = true;
  lastAtmosphereRenderAt = 0;
  lastAtmosphereViewportSignature = "";

  constructor(root: HTMLElement) {
    this.root = root;
    this.shell.className = "shell";
    this.hud.className = "hud";
    this.topbar.className = "topbar";
    this.sidebar.className = "sidebar";
    this.sidebarTabs.className = "sidebar__tabs";
    this.sidebarBody.className = "sidebar__body";
    this.minimap.width = 360;
    this.minimap.height = 360;
    this.minimap.className = "minimap";
    this.minimapBackdrop.width = this.minimap.width;
    this.minimapBackdrop.height = this.minimap.height;
    this.loadingOverlay.className = "loading-overlay";
    this.loadingOverlay.innerHTML = `
      <div class="loading-overlay__panel">
        <div class="loading-overlay__title">Generating World</div>
        <div class="loading-overlay__bar"><span class="loading-overlay__fill"></span></div>
        <div class="loading-overlay__status">Preparing terrain, tribes, and simulation...</div>
      </div>
    `;
  }

  bindWorker(worker: Worker): void {
    this.workerPort = worker;
  }

  private postControl(update: { paused?: boolean; speed?: 1 | 2 | 4 | 8 }): void {
    this.workerPort?.postMessage({
      type: "control",
      ...update,
    });
  }

  async init(): Promise<void> {
    await this.app.init({
      resizeTo: window,
      antialias: false,
      backgroundAlpha: 0,
      resolution: 1,
    });

    this.app.ticker.maxFPS = 60;

    this.worldContainer.addChild(this.staticChunkLayer);
    this.worldContainer.addChild(this.terrainGraphics);
    this.worldContainer.addChild(this.overlayGraphics);
    this.worldContainer.addChild(this.buildingGraphics);
    this.worldContainer.addChild(this.atmosphereGraphics);
    this.worldContainer.addChild(this.iconLayer);
    this.worldContainer.addChild(this.unitGraphics);
    this.worldContainer.addChild(this.selectionGraphics);
    this.worldContainer.addChild(this.labelLayer);
    this.app.stage.addChild(this.worldContainer);

    this.shell.appendChild(this.app.canvas);
    this.hud.appendChild(this.topbar);
    this.sidebar.appendChild(this.sidebarTabs);
    this.sidebar.appendChild(this.sidebarBody);
    this.hud.appendChild(this.sidebar);
    this.hud.appendChild(this.minimap);
    this.hud.appendChild(this.loadingOverlay);
    this.shell.appendChild(this.hud);
    this.root.appendChild(this.shell);

    this.attachInput();
    this.sidebarBody.addEventListener("scroll", () => {
      this.sidebarScrollTopByTab[this.sidebarTab] = this.sidebarBody.scrollTop;
    });
    this.sidebar.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>("[data-tribe-id]");
      if (button) {
        this.selectedTribeId = Number(button.dataset.tribeId);
        const tribe = this.state.tribes.find((entry) => entry.id === this.selectedTribeId);
        if (tribe) {
          this.focusWorld(tribe.capitalX, tribe.capitalY);
        }
        this.sidebarTab = "tribes";
        this.updateHud();
        return;
      }
      const compareButton = target?.closest<HTMLButtonElement>("[data-compare-tribe-id]");
      if (compareButton) {
        this.compareTribeId = Number(compareButton.dataset.compareTribeId);
        this.sidebarTab = "tribes";
        this.updateHud();
        return;
      }
      const branchButton = target?.closest<HTMLButtonElement>("[data-branch-hall-id]");
      if (branchButton) {
        const hallId = Number(branchButton.dataset.branchHallId);
        const branch = this.state.branches.find((entry) => entry.hallId === hallId);
        if (branch) {
          this.selectedTribeId = branch.tribeId;
          this.focusWorld(branch.x, branch.y);
          this.selection = { x: Math.floor(branch.x), y: Math.floor(branch.y) };
        }
        this.sidebarTab = "tribes";
        this.updateHud();
        this.drawMinimap();
        return;
      }
      const eventButton = target?.closest<HTMLButtonElement>("[data-event-index]");
      if (eventButton) {
        const eventIndex = Number(eventButton.dataset.eventIndex);
        const worldEvent = this.state.events[eventIndex];
        if (worldEvent) {
          this.focusWorld(worldEvent.x, worldEvent.y);
          this.selection = { x: Math.floor(worldEvent.x), y: Math.floor(worldEvent.y) };
        }
        this.sidebarTab = "events";
        this.updateHud();
        this.drawMinimap();
        return;
      }
      const eventFilterButton = target?.closest<HTMLButtonElement>("[data-event-filter]");
      if (eventFilterButton) {
        this.eventKindFilter = eventFilterButton.dataset.eventFilter ?? "all";
        this.sidebarTab = "events";
        this.updateHud();
        return;
      }
      const tab = target?.closest<HTMLButtonElement>("[data-tab]");
      if (tab) {
        this.sidebarTab = tab.dataset.tab as SidebarTab;
      }
      this.updateHud();
    });
    this.topbar.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      const viewButton = target?.closest<HTMLButtonElement>("[data-view-mode]");
      if (viewButton) {
        this.viewMode = viewButton.dataset.viewMode as ViewMode;
        this.minimapTerrainDirty = true;
      }
      const speedButton = target?.closest<HTMLButtonElement>("[data-speed]");
      if (speedButton) {
        this.simSpeed = Number(speedButton.dataset.speed) as 1 | 2 | 4 | 8;
        this.postControl({ speed: this.simSpeed, paused: this.paused });
      }
      const pauseButton = target?.closest<HTMLButtonElement>("[data-toggle-pause]");
      if (pauseButton) {
        this.paused = !this.paused;
        this.postControl({ paused: this.paused, speed: this.simSpeed });
      }
      const jumpButton = target?.closest<HTMLButtonElement>("[data-jump-event]");
      if (jumpButton) {
        const latest = this.state.events[0];
        if (latest) {
          this.focusWorld(latest.x, latest.y);
          this.sidebarTab = "events";
        }
      }
      const filterButton = target?.closest<HTMLButtonElement>("[data-filter-key]");
      if (filterButton) {
        const key = filterButton.dataset.filterKey as RenderFilterKey;
        this.renderFilters[key] = !this.renderFilters[key];
        this.staticSceneDirty = true;
        this.atmosphereDirty = true;
      }
      this.updateHud();
      this.drawMinimap();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "1") this.sidebarTab = "inspect";
      if (event.key === "2") this.sidebarTab = "tribes";
      if (event.key === "3") this.sidebarTab = "events";
      if (event.key === "4") this.sidebarTab = "legends";
      if (event.key === "5") this.sidebarTab = "world";
      if (event.key === "Escape") {
        this.selectedUnitId = null;
        this.followSelectedUnit = false;
      }
      if (event.key.toLowerCase() === "f" && this.selectedTribeId !== null) {
        const tribe = this.state.tribes.find((entry) => entry.id === this.selectedTribeId);
        if (tribe) this.focusWorld(tribe.capitalX, tribe.capitalY);
      }
      if (event.key.toLowerCase() === "v" && this.selectedUnitId !== null) {
        this.followSelectedUnit = !this.followSelectedUnit;
      }
      if (event.key.toLowerCase() === "g") {
        this.viewMode = this.viewMode === "surface" ? "underground" : "surface";
        this.minimapTerrainDirty = true;
      }
      if (event.key === " ") {
        event.preventDefault();
        this.paused = !this.paused;
        this.postControl({ paused: this.paused, speed: this.simSpeed });
      }
      if (event.key === "=" || event.key === "+") {
        this.simSpeed = this.simSpeed === 1 ? 2 : this.simSpeed === 2 ? 4 : 8;
        this.postControl({ speed: this.simSpeed, paused: this.paused });
      }
      if (event.key === "-") {
        this.simSpeed = this.simSpeed === 8 ? 4 : this.simSpeed === 4 ? 2 : 1;
        this.postControl({ speed: this.simSpeed, paused: this.paused });
      }
      this.updateHud();
      this.drawMinimap();
    });
    this.minimap.addEventListener("click", (event) => {
      if (!this.state.world) return;
      const rect = this.minimap.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * this.state.world.width;
      const y = ((event.clientY - rect.top) / rect.height) * this.state.world.height;
      this.focusWorld(x, y);
    });
    this.app.ticker.add(() => {
      this.renderScene();
      this.updateHud(false);
      this.drawMinimap(false);
    });
  }

  setLoadingStatus(message: string): void {
    const status = this.loadingOverlay.querySelector<HTMLElement>(".loading-overlay__status");
    const fill = this.loadingOverlay.querySelector<HTMLElement>(".loading-overlay__fill");
    if (status) {
      status.textContent = message;
    }
    if (fill) {
      const next = Math.min(92, (parseFloat(fill.dataset.progress ?? "12") || 12) + 18);
      fill.dataset.progress = `${next}`;
      fill.style.width = `${next}%`;
    }
    this.loadingOverlay.classList.remove("is-hidden");
  }

  hideLoading(): void {
    const fill = this.loadingOverlay.querySelector<HTMLElement>(".loading-overlay__fill");
    if (fill) {
      fill.dataset.progress = "100";
      fill.style.width = "100%";
    }
    this.loadingOverlay.classList.add("is-hidden");
  }

  setWorld(world: StaticWorldData, tribes: TribeSummary[]): void {
    this.clearStaticChunks();
    this.clearIconSprites();
    this.state.world = world;
    this.state.terrain = world.terrain.slice();
    this.state.elevation = world.elevation.slice();
    this.state.biome = world.biome.slice();
    this.state.feature = world.feature.slice();
    this.state.surfaceWater = world.surfaceWater.slice();
    this.state.undergroundTerrain = world.undergroundTerrain.slice();
    this.state.undergroundFeature = world.undergroundFeature.slice();
    this.state.undergroundResourceType = world.undergroundResourceType.slice();
    this.state.undergroundResourceAmount = world.undergroundResourceAmount.slice();
    this.state.fertility = world.fertility.slice();
    this.state.moisture = world.moisture.slice();
    this.state.temperature = world.temperature.slice();
    this.state.road = new Uint8Array(world.width * world.height);
    this.state.owner = new Int16Array(world.width * world.height).fill(-1);
    this.state.resourceType = new Uint8Array(world.width * world.height);
    this.state.resourceAmount = new Uint16Array(world.width * world.height);
    this.state.tribes = tribes;
    const defaultTribe = tribes.find((tribe) => tribe.race === RaceType.Humans) ?? tribes[0];
    this.selectedTribeId = defaultTribe?.id ?? null;
    if (defaultTribe) {
      this.zoom = 0.96;
      this.cameraX = defaultTribe.capitalX * TILE_SIZE - this.app.renderer.width / this.zoom / 2;
      this.cameraY = defaultTribe.capitalY * TILE_SIZE - this.app.renderer.height / this.zoom / 2;
    } else {
      this.zoom = 0.92;
      this.cameraX = world.width * TILE_SIZE * 0.42;
      this.cameraY = world.height * TILE_SIZE * 0.42;
    }
    this.staticSceneDirty = true;
    this.minimapDirty = true;
    this.minimapTerrainDirty = true;
    this.updateHud();
    this.drawMinimap();
  }

  applySnapshot(snapshot: DynamicSnapshot): void {
    const buildingsChanged = snapshot.buildings.length !== this.state.buildings.length;
    const plannedSitesChanged = snapshot.plannedSites.length !== this.state.plannedSites.length;
    this.captureMotion(this.agentMotion, this.state.agents, snapshot.agents);
    this.captureMotion(this.animalMotion, this.state.animals, snapshot.animals);
    this.captureMotion(this.boatMotion, this.state.boats, snapshot.boats);
    this.captureMotion(this.wagonMotion, this.state.wagons, snapshot.wagons);
    this.captureMotion(this.caravanMotion, this.state.caravans, snapshot.caravans);
    this.captureMotion(this.siegeMotion, this.state.siegeEngines, snapshot.siegeEngines);

    this.lastSnapshotAt = performance.now();
    this.state.tick = snapshot.tick;
    this.state.year = snapshot.year;
    this.state.season = snapshot.season;
    this.state.tribes = snapshot.tribes;
    this.state.branches = snapshot.branches;
    this.state.buildings = snapshot.buildings;
    this.state.plannedSites = snapshot.plannedSites;
    this.state.agents = snapshot.agents;
    this.state.animals = snapshot.animals;
    this.state.boats = snapshot.boats;
    this.state.wagons = snapshot.wagons;
    this.state.caravans = snapshot.caravans;
    this.state.siegeEngines = snapshot.siegeEngines;
    this.state.weather = snapshot.weather;
    this.state.events = snapshot.events;
    this.state.creatures = snapshot.creatures;
    this.state.dungeons = snapshot.dungeons;
    this.atmosphereDirty = true;

    const liveAgentIds = new Set(snapshot.agents.map((agent) => agent.id));
    for (const [id, label] of this.labelSprites.entries()) {
      if (liveAgentIds.has(id)) continue;
      this.labelLayer.removeChild(label);
      label.destroy();
      this.labelSprites.delete(id);
      this.labelStyleKeyByAgentId.delete(id);
    }

    if (this.state.world && this.state.terrain && this.state.feature && this.state.surfaceWater && this.state.undergroundTerrain && this.state.undergroundFeature && this.state.undergroundResourceType && this.state.undergroundResourceAmount && this.state.road && this.state.owner && this.state.resourceType && this.state.resourceAmount) {
      for (const update of snapshot.tileUpdates) {
        this.state.terrain[update.index] = update.terrain;
        this.state.feature[update.index] = update.feature;
        this.state.surfaceWater[update.index] = update.surfaceWater;
        this.state.undergroundTerrain[update.index] = update.undergroundTerrain;
        this.state.undergroundFeature[update.index] = update.undergroundFeature;
        this.state.undergroundResourceType[update.index] = update.undergroundResourceType;
        this.state.undergroundResourceAmount[update.index] = update.undergroundResourceAmount;
        this.state.road[update.index] = update.road;
        this.state.owner[update.index] = update.owner;
        this.state.resourceType[update.index] = update.resourceType;
        this.state.resourceAmount[update.index] = update.resourceAmount;
      }
    }

    this.hudDirty = true;
    if (snapshot.tileUpdates.length > 0 || buildingsChanged || plannedSitesChanged) {
      this.markAllStaticChunksDirty();
    }
    this.staticSceneDirty = this.staticSceneDirty || snapshot.tileUpdates.length > 0 || buildingsChanged || plannedSitesChanged;
    if (snapshot.tileUpdates.length > 0 || buildingsChanged || plannedSitesChanged || this.state.tick % 8 === 0) {
      this.minimapDirty = true;
      this.minimapTerrainDirty = this.minimapTerrainDirty || snapshot.tileUpdates.length > 0;
    }
    this.updateHud(false);
    this.drawMinimap(false);
  }

  private captureMotion<T extends { id: number; x: number; y: number }>(store: Map<number, MotionState>, previous: T[], next: T[]): void {
    const previousMap = new Map(previous.map((entry) => [entry.id, entry]));
    store.clear();
    for (const entry of next) {
      const before = previousMap.get(entry.id);
      store.set(entry.id, {
        fromX: before?.x ?? entry.x,
        fromY: before?.y ?? entry.y,
        toX: entry.x,
        toY: entry.y,
      });
    }
  }

  private clearStaticChunks(): void {
    for (const chunk of this.staticChunks.values()) {
      this.staticChunkLayer.removeChild(chunk.sprite);
      chunk.sprite.destroy();
      chunk.texture.destroy(true);
    }
    this.staticChunks.clear();
  }

  private clearIconSprites(): void {
    for (const state of this.iconSprites.values()) {
      this.iconLayer.removeChild(state.sprite);
      state.sprite.destroy();
    }
    this.iconSprites.clear();
    for (const texture of this.iconTextures.values()) {
      texture.destroy(true);
    }
    this.iconTextures.clear();
  }

  private upsertIconSprite(key: string, x: number, y: number, width: number, height: number, tint: number, alpha: number): void {
    let state = this.iconSprites.get(key);
    if (!state) {
      const sprite = new Sprite(Texture.WHITE);
      sprite.visible = false;
      this.iconLayer.addChild(sprite);
      state = { sprite, textureKey: "white" };
      this.iconSprites.set(key, state);
    }
    state.sprite.visible = true;
    state.sprite.position.set(x, y);
    state.sprite.width = width;
    state.sprite.height = height;
    state.sprite.tint = tint;
    state.sprite.alpha = alpha;
  }

  private drawBranchMarkers(minTileX: number, minTileY: number, maxTileX: number, maxTileY: number, tribeById: Map<number, TribeSummary>): void {
    for (const branch of this.state.branches) {
      if (branch.x < minTileX || branch.y < minTileY || branch.x > maxTileX || branch.y > maxTileY) {
        continue;
      }
      const tribe = tribeById.get(branch.tribeId);
      const color = branch.strained ? 0xd45745 : lighten(tribe?.color ?? 0xffffff, 24);
      const px = branch.x * TILE_SIZE + 5;
      const py = branch.y * TILE_SIZE + 1;
      drawPixelRect(this.overlayGraphics, px, py, 2, 9, 0x23160e, 0.75);
      drawPixelRect(this.overlayGraphics, px + 2, py + 1, 6, 4, color, 0.9);
      drawPixelRect(this.overlayGraphics, px + 2, py + 5, 2, 1, darken(color, 24), 0.8);
      if (branch.maturity >= 3) {
        drawPixelRect(this.overlayGraphics, px + 4, py, 2, 1, 0xf5e7b2, 0.95);
      }
    }
  }

  private markAllStaticChunksDirty(): void {
    for (const chunk of this.staticChunks.values()) {
      chunk.dirty = true;
    }
  }

  private attachInput(): void {
    const canvas = this.app.canvas;
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      this.dragging = true;
      this.dragMoved = false;
      this.lastPointer = { x: event.clientX, y: event.clientY };
    });

    window.addEventListener("pointermove", (event) => {
      if (!this.dragging) {
        return;
      }
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        this.dragMoved = true;
      }
      this.cameraX -= dx / this.zoom;
      this.cameraY -= dy / this.zoom;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.minimapDirty = true;
    });

    window.addEventListener("pointerup", (event) => {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      if (!this.dragMoved && event.button === 0) {
        this.handleSelect(event.clientX, event.clientY);
      }
    });

    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.12 : 0.9;
        const previousZoom = this.zoom;
        const nextZoom = clamp(this.zoom * factor, 0.3, 2.8);
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const worldX = this.cameraX + mouseX / previousZoom;
        const worldY = this.cameraY + mouseY / previousZoom;
        this.zoom = nextZoom;
        this.cameraX = worldX - mouseX / this.zoom;
        this.cameraY = worldY - mouseY / this.zoom;
        this.minimapDirty = true;
      },
      { passive: false },
    );
  }

  private handleSelect(clientX: number, clientY: number): void {
    if (!this.state.world) {
      return;
    }
    const rect = this.app.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = this.cameraX + localX / this.zoom;
    const worldY = this.cameraY + localY / this.zoom;
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    if (tileX < 0 || tileY < 0 || tileX >= this.state.world.width || tileY >= this.state.world.height) {
      return;
    }
    this.selection = { x: tileX, y: tileY };
    const owner = this.state.owner?.[indexOf(tileX, tileY, this.state.world.width)] ?? -1;
    this.selectedTribeId = owner >= 0 ? owner : this.selectedTribeId;
    const unit = this.state.agents.find((entry) =>
      Math.round(entry.x) === tileX &&
      Math.round(entry.y) === tileY &&
      (this.viewMode === "surface" || entry.underground),
    );
    this.selectedUnitId = unit?.id ?? null;
    this.followSelectedUnit = Boolean(unit);
    this.sidebarTab = "inspect";
    this.updateHud();
    this.drawMinimap();
  }

  private focusWorld(tileX: number, tileY: number): void {
    const viewportWidth = this.app.renderer.width;
    const viewportHeight = this.app.renderer.height;
    this.cameraX = tileX * TILE_SIZE - viewportWidth / this.zoom / 2;
    this.cameraY = tileY * TILE_SIZE - viewportHeight / this.zoom / 2;
    this.minimapDirty = true;
  }

  private renderScene(): void {
    const world = this.state.world;
    if (!world || !this.state.terrain || !this.state.elevation || !this.state.feature || !this.state.owner || !this.state.road || !this.state.biome || !this.state.undergroundTerrain || !this.state.undergroundFeature || !this.state.undergroundResourceAmount) {
      return;
    }

    const nowMs = performance.now();
    const frameDelta = Math.min(0.05, Math.max(0, (nowMs - this.lastFrameAt) / 1000));
    this.lastFrameAt = nowMs;
    this.presentationClock += frameDelta * (this.paused ? 0.35 : 0.7 + this.simSpeed * 0.18);
    const alpha = clamp((nowMs - this.lastSnapshotAt) / ((1000 / SIM_TICKS_PER_SECOND) * SNAPSHOT_TICKS), 0, 1);
    const tribeById = new Map(this.state.tribes.map((tribe) => [tribe.id, tribe]));
    if (this.followSelectedUnit && this.selectedUnitId !== null) {
      const followed = this.state.agents.find((agent) => agent.id === this.selectedUnitId);
      if (followed && (this.viewMode === "surface" || followed.underground)) {
        const position = entityPosition(this.agentMotion, followed.id, followed.x, followed.y, alpha, followed.moveToX, followed.moveToY);
        this.focusWorld(position.x, position.y);
      } else if (!followed) {
        this.followSelectedUnit = false;
        this.selectedUnitId = null;
      }
    }
    const viewportWidth = this.app.renderer.width;
    const viewportHeight = this.app.renderer.height;
    const minTileX = Math.max(0, Math.floor(this.cameraX / TILE_SIZE));
    const minTileY = Math.max(0, Math.floor(this.cameraY / TILE_SIZE));
    const maxTileX = Math.min(world.width - 1, Math.ceil((this.cameraX + viewportWidth / this.zoom) / TILE_SIZE) + 1);
    const maxTileY = Math.min(world.height - 1, Math.ceil((this.cameraY + viewportHeight / this.zoom) / TILE_SIZE) + 1);
    const lodStep = this.zoom < 0.58 ? 4 : this.zoom < 1.08 ? 2 : 1;
    const staticViewportSignature = `${this.viewMode}:${lodStep}:${minTileX}:${minTileY}:${maxTileX}:${maxTileY}`;
    const atmosphereViewportSignature = `${this.viewMode}:${Math.floor(minTileX / 8)}:${Math.floor(minTileY / 8)}:${Math.floor(maxTileX / 8)}:${Math.floor(maxTileY / 8)}:${lodStep === 1 ? 1 : 0}:${this.zoom > 0.92 ? 1 : 0}`;
    const now = nowMs;
    const redrawStaticScene =
      this.staticSceneDirty ||
      this.lastStaticViewportSignature !== staticViewportSignature ||
      (this.viewMode === "surface" && lodStep === 1 && this.zoom > 1.35 && now - this.lastStaticRenderAt > 1100);
    const redrawAtmosphere =
      this.atmosphereDirty ||
      this.lastAtmosphereViewportSignature !== atmosphereViewportSignature ||
      now - this.lastAtmosphereRenderAt > 140;

    this.worldContainer.scale.set(this.zoom);
    this.worldContainer.position.set(-this.cameraX * this.zoom, -this.cameraY * this.zoom);

    if (redrawStaticScene) {
      this.terrainGraphics.clear();
      this.overlayGraphics.clear();
    }
    if (redrawAtmosphere) {
      this.atmosphereGraphics.clear();
    }
    this.unitGraphics.clear();
    this.selectionGraphics.clear();
    for (const state of this.iconSprites.values()) {
      state.sprite.visible = false;
    }
    for (const label of this.labelSprites.values()) {
      label.visible = false;
    }

    if (redrawStaticScene) {
      this.renderVisibleStaticChunks(minTileX, minTileY, maxTileX, maxTileY, lodStep, tribeById);
      this.staticSceneDirty = false;
      this.lastStaticViewportSignature = staticViewportSignature;
      this.lastStaticRenderAt = now;
    }

    if (redrawAtmosphere) {
      if (this.viewMode === "surface" && this.zoom > 0.92 && lodStep <= 2) {
        this.drawCloudShadowOverlay(minTileX, minTileY, maxTileX, maxTileY);
      }

      if (this.viewMode === "surface" && lodStep === 1) {
        this.drawWeatherOverlay(minTileX, minTileY, maxTileX, maxTileY);
      }
      this.atmosphereDirty = false;
      this.lastAtmosphereRenderAt = now;
      this.lastAtmosphereViewportSignature = atmosphereViewportSignature;
    }

    if (this.viewMode === "surface" && lodStep === 1) {
      const drawLiveBuildings = this.zoom > 1.72;
      for (const building of this.state.buildings) {
        if (building.x + building.width < minTileX || building.y + building.height < minTileY || building.x > maxTileX || building.y > maxTileY) {
          continue;
        }
        if (drawLiveBuildings) {
          this.drawBuilding(this.overlayGraphics, building, tribeById.get(building.tribeId), true, 0, 0, true);
        } else {
          this.drawBuildingDynamicOverlay(this.overlayGraphics, building, tribeById.get(building.tribeId));
        }
      }
    }

    if (this.viewMode === "surface" && this.zoom > 0.9) {
      this.drawBranchMarkers(minTileX, minTileY, maxTileX, maxTileY, tribeById);
    }

    const useDetailedEntities = lodStep === 1 && this.zoom > 1.18;

    for (const animal of this.state.animals) {
      if (this.viewMode === "underground") continue;
      const position = entityPosition(this.animalMotion, animal.id, animal.x, animal.y, alpha, animal.moveToX, animal.moveToY);
      if (position.x < minTileX || position.y < minTileY || position.x > maxTileX || position.y > maxTileY) {
        continue;
      }
      if (!useDetailedEntities) {
        const px = position.x * TILE_SIZE + TILE_SIZE * 0.3;
        const py = position.y * TILE_SIZE + TILE_SIZE * 0.3;
        this.upsertIconSprite(`animal:${animal.id}`, px, py, 4, 4, ANIMAL_COLORS[animal.type], 0.8);
      } else {
        this.drawAnimal(animal, position.x, position.y);
      }
    }

    for (const boat of this.state.boats) {
      if (!this.renderFilters.trade) continue;
      if (this.viewMode === "underground") continue;
      const position = entityPosition(this.boatMotion, boat.id, boat.x, boat.y, alpha, boat.moveToX, boat.moveToY);
      if (position.x < minTileX || position.y < minTileY || position.x > maxTileX || position.y > maxTileY) {
        continue;
      }
      const tribe = tribeById.get(boat.tribeId);
      if (!useDetailedEntities) {
        this.upsertIconSprite(`boat:${boat.id}`, position.x * TILE_SIZE + 3, position.y * TILE_SIZE + 4, 6, 4, tribe?.color ?? 0xffffff, 0.8);
      } else {
        this.drawBoat(boat, tribe?.color ?? 0xffffff, position.x, position.y);
      }
    }

    for (const wagon of this.state.wagons) {
      if (!this.renderFilters.trade) continue;
      if (this.viewMode === "underground") continue;
      const position = entityPosition(this.wagonMotion, wagon.id, wagon.x, wagon.y, alpha, wagon.moveToX, wagon.moveToY);
      if (position.x < minTileX || position.y < minTileY || position.x > maxTileX || position.y > maxTileY) {
        continue;
      }
      const tribe = tribeById.get(wagon.tribeId);
      if (!useDetailedEntities) {
        this.upsertIconSprite(`wagon:${wagon.id}:body`, position.x * TILE_SIZE + 4, position.y * TILE_SIZE + 8, 6, 4, 0x9b7145, 0.82);
        this.upsertIconSprite(`wagon:${wagon.id}:flag`, position.x * TILE_SIZE + 6, position.y * TILE_SIZE + 6, 3, 2, tribe?.color ?? 0xffffff, 0.72);
      } else {
        this.drawWagon(wagon, tribe?.color ?? 0xffffff, position.x, position.y);
      }
    }

    for (const caravan of this.state.caravans) {
      if (!this.renderFilters.trade) continue;
      if (this.viewMode === "underground") continue;
      const position = entityPosition(this.caravanMotion, caravan.id, caravan.x, caravan.y, alpha, caravan.moveToX, caravan.moveToY);
      if (position.x < minTileX || position.y < minTileY || position.x > maxTileX || position.y > maxTileY) {
        continue;
      }
      const tribe = tribeById.get(caravan.tribeId);
      if (!useDetailedEntities) {
        this.upsertIconSprite(`caravan:${caravan.id}:body`, position.x * TILE_SIZE + 4, position.y * TILE_SIZE + 9, 7, 3, 0xa47a4a, 0.82);
        this.upsertIconSprite(`caravan:${caravan.id}:flag`, position.x * TILE_SIZE + 5, position.y * TILE_SIZE + 6, 4, 2, tribe?.color ?? 0xffffff, 0.75);
      } else {
        this.drawCaravan(caravan, tribe?.color ?? 0xffffff, position.x, position.y);
      }
    }

    for (const engine of this.state.siegeEngines) {
      if (!this.renderFilters.armies) continue;
      const position = entityPosition(this.siegeMotion, engine.id, engine.x, engine.y, alpha, engine.moveToX, engine.moveToY);
      if (position.x < minTileX || position.y < minTileY || position.x > maxTileX || position.y > maxTileY) {
        continue;
      }
      const tribe = tribeById.get(engine.tribeId);
      if (!useDetailedEntities) {
        this.upsertIconSprite(`siege:${engine.id}`, position.x * TILE_SIZE + 3, position.y * TILE_SIZE + 9, 9, 4, tribe?.color ?? 0xffffff, 0.82);
      } else {
        this.drawSiegeEngine(engine, tribe?.color ?? 0xffffff, position.x, position.y);
      }
    }

    if (this.viewMode === "surface" && lodStep === 1) {
      for (const site of this.state.plannedSites) {
        if (site.x + site.width < minTileX || site.y + site.height < minTileY || site.x > maxTileX || site.y > maxTileY) {
          continue;
        }
        this.drawPlannedSite(site, tribeById.get(site.tribeId));
      }
    }

    for (const dungeon of this.state.dungeons) {
      if (dungeon.x < minTileX || dungeon.y < minTileY || dungeon.x > maxTileX || dungeon.y > maxTileY) {
        continue;
      }
      if (lodStep > 1) {
        this.upsertIconSprite(`dungeon:${dungeon.id}`, dungeon.x * TILE_SIZE + 5, dungeon.y * TILE_SIZE + 5, 3, 3, 0xd7c78f, 0.8);
      } else {
        const px = dungeon.x * TILE_SIZE;
        const py = dungeon.y * TILE_SIZE;
        drawPixelRect(this.unitGraphics, px + 4, py + 7, 8, 6, 0x6f6256, 0.9);
        drawPixelRect(this.unitGraphics, px + 6, py + 4, 4, 3, 0x9d8a77, 0.92);
      }
    }

    for (const creature of this.state.creatures) {
      if (!this.renderFilters.creatures) continue;
      if (this.viewMode === "underground") continue;
      if (creature.x < minTileX || creature.y < minTileY || creature.x > maxTileX || creature.y > maxTileY) {
        continue;
      }
      if (lodStep > 1 || this.zoom <= 1.02) {
        this.upsertIconSprite(`creature:${creature.id}`, creature.x * TILE_SIZE + 3, creature.y * TILE_SIZE + 5, 10, 8, 0xd06b48, 0.85);
      } else {
        this.drawLegendaryCreature(creature);
      }
    }

    for (const agent of this.state.agents) {
      if (this.viewMode === "underground" && !agent.underground) {
        continue;
      }
      if (this.viewMode === "underground" && !this.renderFilters.underground) {
        continue;
      }
      if (
        !this.renderFilters.armies &&
        (agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider || agent.role === AgentRole.Mage)
      ) {
        continue;
      }
      const position = entityPosition(this.agentMotion, agent.id, agent.x, agent.y, alpha, agent.moveToX, agent.moveToY);
      if (position.x < minTileX || position.y < minTileY || position.x > maxTileX || position.y > maxTileY) {
        continue;
      }
      const tribe = tribeById.get(agent.tribeId);
      const detailedAgent = useDetailedEntities && (this.selectedUnitId === agent.id || agent.hero || this.zoom > 1.72);
      if (!detailedAgent) {
        this.upsertIconSprite(`agent:${agent.id}:body`, position.x * TILE_SIZE + 4, position.y * TILE_SIZE + 4, 4, 4, tribe?.color ?? 0xffffff, 0.9);
        if (agent.role === AgentRole.Soldier || agent.role === AgentRole.Mage || agent.hero) {
          this.upsertIconSprite(`agent:${agent.id}:accent`, position.x * TILE_SIZE + 8, position.y * TILE_SIZE + 3, 2, 2, ROLE_ACCENTS[agent.role], 0.82);
        }
        if (agent.carrying !== ResourceType.None && agent.carryingAmount > 0) {
          this.upsertIconSprite(`agent:${agent.id}:carry`, position.x * TILE_SIZE + 9, position.y * TILE_SIZE + 2, 3, 3, resourceVisualColor(agent.carrying), 0.86);
        }
      } else {
        this.drawAgent(agent, position.x, position.y, tribe, this.zoom > 1.12);
        if (agent.hero || this.selectedUnitId === agent.id) {
          this.drawAgentLabel(agent, position.x, position.y);
        }
      }
    }

    if (this.selection) {
      this.selectionGraphics.lineStyle(2, 0xffffff, 0.95);
      this.selectionGraphics.drawRect(this.selection.x * TILE_SIZE, this.selection.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    const viewportMoved =
      Math.abs(this.cameraX - this.lastMinimapCameraX) > TILE_SIZE * 4 ||
      Math.abs(this.cameraY - this.lastMinimapCameraY) > TILE_SIZE * 4 ||
      Math.abs(this.zoom - this.lastMinimapZoom) > 0.025;
    if (viewportMoved) {
      this.minimapDirty = true;
    }
  }

  private drawTerrainTile(target: PixelTarget, px: number, py: number, terrain: TerrainType, biome: BiomeType, elevation: number, eastElevation: number, southElevation: number, surfaceWater: number, lodStep = 1, detail = true): void {
    const color = TERRAIN_COLORS[terrain] ?? 0xff00ff;
    const size = TILE_SIZE * lodStep;
    const elevatedColor = elevation > 170 ? lighten(color, Math.floor((elevation - 170) * 0.12)) : elevation < 96 ? darken(color, Math.floor((96 - elevation) * 0.08)) : color;
    drawPixelRect(target, px, py, size, size, elevatedColor);
    if (lodStep > 1 || !detail) {
      if (elevation > 190) drawPixelRect(target, px, py, size, Math.max(1, Math.floor(size * 0.18)), lighten(elevatedColor, 12), 0.35);
      if (!detail && terrain !== TerrainType.WaterDeep && terrain !== TerrainType.WaterShallow && terrain !== TerrainType.River && terrain !== TerrainType.Lava && surfaceWater > 18) {
        const alpha = surfaceWater >= 96 ? 0.42 : surfaceWater >= 48 ? 0.24 : 0.14;
        const fill = surfaceWater >= 96 ? 0x76c2ea : surfaceWater >= 48 ? 0x5ea9d6 : 0x4d93c0;
        drawPixelRect(target, px + 1, py + 1, size - 2, size - 2, fill, alpha);
      }
      return;
    }

    const slopeEast = eastElevation - elevation;
    const slopeSouth = southElevation - elevation;
    if (slopeEast > 4) drawPixelRect(target, px + 12, py, 4, 16, darken(elevatedColor, 24), 0.18);
    else if (slopeEast < -4) drawPixelRect(target, px, py, 3, 16, lighten(elevatedColor, 16), 0.16);
    if (slopeSouth > 4) drawPixelRect(target, px, py + 12, 16, 4, darken(elevatedColor, 22), 0.18);
    else if (slopeSouth < -4) drawPixelRect(target, px, py, 16, 3, lighten(elevatedColor, 14), 0.15);

    switch (terrain) {
      case TerrainType.WaterDeep:
      case TerrainType.WaterShallow:
      case TerrainType.River:
        drawPixelRect(target, px + 1, py + 3, 5, 1, lighten(elevatedColor, 20), 0.6);
        drawPixelRect(target, px + 8, py + 8, 6, 1, lighten(elevatedColor, 26), 0.58);
        drawPixelRect(target, px + 4, py + 12, 7, 1, darken(elevatedColor, 10), 0.3);
        break;
      case TerrainType.Beach:
        drawPixelRect(target, px + 2, py + 11, 11, 2, darken(color, 14), 0.45);
        break;
      case TerrainType.Grass:
      case TerrainType.ForestFloor:
      case TerrainType.Farmland:
        drawPixelRect(target, px + 2, py + 10, 2, 3, darken(elevatedColor, 18), 0.5);
        drawPixelRect(target, px + 9, py + 5, 2, 3, lighten(elevatedColor, 10), 0.45);
        drawPixelRect(target, px + 5, py + 3, 1, 2, lighten(elevatedColor, 18), 0.28);
        drawPixelRect(target, px + 12, py + 9, 1, 2, darken(elevatedColor, 12), 0.26);
        if (terrain === TerrainType.Farmland) {
          drawPixelRect(target, px + 1, py + 3, 14, 1, 0x857043, 0.55);
          drawPixelRect(target, px + 2, py + 6, 12, 1, 0x685431, 0.68);
          drawPixelRect(target, px + 2, py + 10, 12, 1, 0x685431, 0.68);
          drawPixelRect(target, px + 2, py + 13, 12, 1, 0x7ca15a, 0.45);
          if (surfaceWater > 18) drawPixelRect(target, px + 3, py + 8, 10, 1, 0x92d8ef, 0.24);
        }
        break;
      case TerrainType.Desert:
        drawPixelRect(target, px + 3, py + 5, 9, 1, lighten(color, 18), 0.45);
        drawPixelRect(target, px + 4, py + 10, 7, 1, darken(color, 18), 0.4);
        drawPixelRect(target, px + 2, py + 8, 12, 1, 0xe1c780, 0.16);
        break;
      case TerrainType.Mountain:
      case TerrainType.Rocky:
        drawPixelRect(target, px + 2, py + 10, 10, 4, darken(elevatedColor, 28), 0.55);
        drawPixelRect(target, px + 5, py + 6, 5, 3, lighten(elevatedColor, 22), 0.58);
        drawPixelRect(target, px + 7, py + 2, 2, 4, lighten(elevatedColor, 30), 0.42);
        drawPixelRect(target, px + 3, py + 12, 10, 1, 0x1c2127, 0.22);
        break;
      case TerrainType.Snow:
        drawPixelRect(target, px + 2, py + 4, 10, 2, 0xffffff, 0.35);
        break;
      case TerrainType.Ashland:
        drawPixelRect(target, px + 3, py + 10, 9, 2, 0x2b2525, 0.5);
        break;
      default:
        break;
    }

    if (biome === BiomeType.Coastline || biome === BiomeType.Archipelago) {
      if (terrain === TerrainType.Beach) drawPixelRect(target, px + 1, py + 2, 14, 1, 0xf2e4b8, 0.22);
      else if (terrain === TerrainType.WaterShallow || terrain === TerrainType.River) drawPixelRect(target, px + 2, py + 2, 10, 1, 0xf4fbff, 0.12);
    }
    if (biome === BiomeType.Marshland && terrain !== TerrainType.WaterDeep && terrain !== TerrainType.WaterShallow && terrain !== TerrainType.River) {
      drawPixelRect(target, px + 2, py + 9, 4, 2, 0x365a3f, 0.26);
      drawPixelRect(target, px + 9, py + 4, 3, 2, 0x5d8f69, 0.22);
    }
    if (biome === BiomeType.VolcanicHighland || biome === BiomeType.AshWaste) {
      drawPixelRect(target, px + 11, py + 4, 1, 1, 0xff9c56, 0.18);
      drawPixelRect(target, px + 4, py + 11, 1, 1, 0xffc477, 0.14);
    }
    if (elevation > 205 && terrain !== TerrainType.WaterDeep && terrain !== TerrainType.WaterShallow && terrain !== TerrainType.River && terrain !== TerrainType.Lava) {
      drawPixelRect(target, px + 2, py + 2, 12, 1, 0xffffff, 0.1);
    }
    if (biome === BiomeType.SnowyForest || biome === BiomeType.Tundra) {
      drawPixelRect(target, px + 1, py + 1, 4, 2, 0xffffff, 0.12);
    }

    if (terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow || terrain === TerrainType.River) {
      const ripple = Math.sin((px + py) * 0.035 + this.state.tick * 0.16);
      drawPixelRect(target, px + 1, py + 5 + ripple, 13, 1, 0xd6f4ff, 0.12);
      drawPixelRect(target, px + 4, py + 11 - ripple * 0.5, 7, 1, 0xb9e6ff, 0.14);
      drawPixelRect(target, px + 2, py + 2 + ripple * 0.3, 5, 1, 0xf4fbff, 0.08);
    } else if (terrain === TerrainType.Lava) {
      const ripple = Math.sin((px + py) * 0.04 + this.state.tick * 0.18);
      drawPixelRect(target, px + 1, py + 5 + ripple, 13, 1, 0xffbf73, 0.18);
      drawPixelRect(target, px + 4, py + 11 - ripple * 0.5, 7, 1, 0xff9648, 0.2);
      drawPixelRect(target, px + 2, py + 2 + ripple * 0.3, 5, 1, 0xffe0ae, 0.12);
    }

    if (terrain !== TerrainType.WaterDeep && terrain !== TerrainType.WaterShallow && terrain !== TerrainType.River && terrain !== TerrainType.Lava && surfaceWater > 6) {
      const alpha = surfaceWater >= 96 ? 0.48 : surfaceWater >= 48 ? 0.3 : 0.18;
      const fill = surfaceWater >= 96 ? 0x76c2ea : surfaceWater >= 48 ? 0x5ea9d6 : 0x4d93c0;
      drawPixelRect(target, px + 1, py + 1, 14, 14, fill, alpha);
      drawPixelRect(target, px + 3, py + 4, 6, 1, lighten(fill, 22), alpha * 0.75);
      drawPixelRect(target, px + 5, py + 11, 7, 1, 0xe4f8ff, alpha * 0.45);
      if (surfaceWater >= 88) drawPixelRect(target, px + 10, py + 9, 4, 1, lighten(fill, 28), alpha * 0.72);
    }
  }

  private drawUndergroundTile(terrainTarget: PixelTarget, overlayTarget: PixelTarget, px: number, py: number, terrain: UndergroundTerrainType, feature: UndergroundFeatureType, resourceAmount: number, lodStep = 1, detail = true): void {
    const color = UNDERGROUND_TERRAIN_COLORS[terrain] ?? 0xff00ff;
    const size = TILE_SIZE * lodStep;
    drawPixelRect(terrainTarget, px, py, size, size, color, 1);
    if (lodStep > 1 || !detail) {
      if (terrain === UndergroundTerrainType.Tunnel || terrain === UndergroundTerrainType.Cavern || terrain === UndergroundTerrainType.Ruins) {
        drawPixelRect(terrainTarget, px + 1, py + 1, size - 2, 2, lighten(color, 10), 0.25);
      }
      return;
    }

    if (terrain === UndergroundTerrainType.SolidRock) {
      drawPixelRect(terrainTarget, px + 2, py + 4, 3, 2, 0x3d454e, 0.5);
      drawPixelRect(terrainTarget, px + 9, py + 10, 4, 2, 0x20262d, 0.35);
    } else if (terrain === UndergroundTerrainType.Tunnel) {
      drawPixelRect(terrainTarget, px + 2, py + 6, 12, 4, 0x847765, 0.82);
      drawPixelRect(terrainTarget, px + 3, py + 5, 10, 1, 0xa3927b, 0.45);
    } else if (terrain === UndergroundTerrainType.Cavern || terrain === UndergroundTerrainType.Ruins) {
      drawPixelRect(terrainTarget, px + 2, py + 3, 12, 9, darken(color, 8), 0.6);
      drawPixelRect(terrainTarget, px + 4, py + 5, 8, 4, lighten(color, 8), 0.24);
    } else if (terrain === UndergroundTerrainType.UndergroundRiver) {
      const ripple = Math.sin((px + py) * 0.04 + this.state.tick * 0.18);
      drawPixelRect(terrainTarget, px + 1, py + 6, 14, 4, 0x2f91be, 0.86);
      drawPixelRect(terrainTarget, px + 4, py + 7 + ripple * 0.5, 7, 1, 0xc5efff, 0.32);
    } else if (terrain === UndergroundTerrainType.Magma) {
      const pulse = (Math.sin((px - py) * 0.05 + this.state.tick * 0.25) + 1) * 0.5;
      drawPixelRect(terrainTarget, px + 1, py + 5, 14, 5, 0xb24726, 0.92);
      drawPixelRect(terrainTarget, px + 4, py + 6, 8, 2, lighten(0xff8e48, Math.floor(22 * pulse)), 0.28 + pulse * 0.16);
    }

    if (feature === UndergroundFeatureType.OreSeam) {
      drawPixelRect(overlayTarget, px + 4, py + 7, 8, 4, 0xc99453, 0.86);
      drawPixelRect(overlayTarget, px + 6, py + 5, 3, 2, 0xf0cd8e, 0.7);
    } else if (feature === UndergroundFeatureType.CrystalCluster) {
      drawPixelRect(overlayTarget, px + 6, py + 4, 2, 7, 0x9fe9ff, 0.9);
      drawPixelRect(overlayTarget, px + 9, py + 6, 2, 5, 0xc3a5ff, 0.86);
    } else if (feature === UndergroundFeatureType.MushroomGrove) {
      drawPixelRect(overlayTarget, px + 4, py + 8, 3, 4, 0xd2a4e8, 0.82);
      drawPixelRect(overlayTarget, px + 8, py + 7, 4, 5, 0x9fd1a5, 0.78);
    } else if (feature === UndergroundFeatureType.RootTangle) {
      drawPixelRect(overlayTarget, px + 3, py + 7, 10, 3, 0x8d6842, 0.75);
    } else if (feature === UndergroundFeatureType.AncientRemains) {
      drawPixelRect(overlayTarget, px + 5, py + 7, 6, 5, 0x9e9289, 0.88);
      drawPixelRect(overlayTarget, px + 7, py + 4, 2, 3, 0xd8d0c2, 0.5);
    }

    if (resourceAmount > 0 && terrain !== UndergroundTerrainType.SolidRock) {
      drawPixelRect(overlayTarget, px + 2, py + 12, Math.min(12, 2 + Math.floor(resourceAmount / 40)), 1, 0xe8d7a8, 0.18);
    }
  }

  private chunkKey(chunkX: number, chunkY: number, lodStep: number, viewMode: ViewMode): string {
    return `${viewMode}:${lodStep}:${chunkX}:${chunkY}`;
  }

  private chunkPixelSize(lodStep = 1): number {
    return STATIC_CHUNK_TILES * TILE_SIZE * lodStep;
  }

  private staticChunkFor(chunkX: number, chunkY: number, lodStep: number, viewMode: ViewMode): StaticChunkCache {
    const key = this.chunkKey(chunkX, chunkY, lodStep, viewMode);
    const existing = this.staticChunks.get(key);
    if (existing) {
      return existing;
    }
    const canvas = document.createElement("canvas");
    canvas.width = this.chunkPixelSize(lodStep);
    canvas.height = this.chunkPixelSize(lodStep);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create static chunk render context");
    }
    context.imageSmoothingEnabled = false;
    const texture = Texture.from(canvas);
    const sprite = new Sprite(texture);
    sprite.x = chunkX * this.chunkPixelSize(lodStep);
    sprite.y = chunkY * this.chunkPixelSize(lodStep);
    const created: StaticChunkCache = { key, chunkX, chunkY, lodStep, viewMode, canvas, context, texture, sprite, dirty: true };
    this.staticChunks.set(key, created);
    this.staticChunkLayer.addChild(sprite);
    return created;
  }

  private renderVisibleStaticChunks(minTileX: number, minTileY: number, maxTileX: number, maxTileY: number, lodStep: number, tribeById: Map<number, TribeSummary>): void {
    const world = this.state.world;
    if (!world || !this.state.terrain || !this.state.biome || !this.state.elevation || !this.state.feature || !this.state.surfaceWater || !this.state.undergroundTerrain || !this.state.undergroundFeature || !this.state.undergroundResourceAmount || !this.state.owner || !this.state.road) {
      return;
    }

    for (const chunk of this.staticChunks.values()) {
      chunk.sprite.visible = false;
    }

    const chunkTileSpan = STATIC_CHUNK_TILES * lodStep;
    const minChunkX = Math.floor(minTileX / chunkTileSpan);
    const minChunkY = Math.floor(minTileY / chunkTileSpan);
    const maxChunkX = Math.floor(maxTileX / chunkTileSpan);
    const maxChunkY = Math.floor(maxTileY / chunkTileSpan);
    const chunkedBuildings = new Map<string, BuildingSnapshot[]>();

    for (const building of this.state.buildings) {
      if (this.viewMode === "underground" && building.type !== BuildingType.MountainHall && building.type !== BuildingType.TunnelEntrance && building.type !== BuildingType.DeepMine) {
        continue;
      }
      const buildingMinChunkX = Math.floor(building.x / chunkTileSpan);
      const buildingMinChunkY = Math.floor(building.y / chunkTileSpan);
      const buildingMaxChunkX = Math.floor((building.x + building.width - 1) / chunkTileSpan);
      const buildingMaxChunkY = Math.floor((building.y + building.height - 1) / chunkTileSpan);
      for (let chunkY = buildingMinChunkY; chunkY <= buildingMaxChunkY; chunkY += 1) {
        for (let chunkX = buildingMinChunkX; chunkX <= buildingMaxChunkX; chunkX += 1) {
          const key = this.chunkKey(chunkX, chunkY, lodStep, this.viewMode);
          const list = chunkedBuildings.get(key);
          if (list) list.push(building);
          else chunkedBuildings.set(key, [building]);
        }
      }
    }

    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
        const chunk = this.staticChunkFor(chunkX, chunkY, lodStep, this.viewMode);
        chunk.sprite.visible = true;
        if (!chunk.dirty && !this.staticSceneDirty) {
          continue;
        }
        const terrainCtx = chunk.context;
        terrainCtx.clearRect(0, 0, chunk.canvas.width, chunk.canvas.height);

        const startTileX = chunkX * chunkTileSpan;
        const startTileY = chunkY * chunkTileSpan;
        const endTileX = Math.min(world.width - 1, startTileX + chunkTileSpan - 1);
        const endTileY = Math.min(world.height - 1, startTileY + chunkTileSpan - 1);

        for (let y = startTileY; y <= endTileY; y += lodStep) {
          for (let x = startTileX; x <= endTileX; x += lodStep) {
            const index = indexOf(x, y, world.width);
            const localPx = x * TILE_SIZE - chunk.sprite.x;
            const localPy = y * TILE_SIZE - chunk.sprite.y;
            const terrain = this.state.terrain[index] as TerrainType;
            const biome = this.state.biome[index] as BiomeType;
            const elevation = this.state.elevation[index] ?? 128;
            const eastElevation = x < world.width - 1 ? this.state.elevation[index + 1] ?? elevation : elevation;
            const southElevation = y < world.height - 1 ? this.state.elevation[index + world.width] ?? elevation : elevation;
            if (this.viewMode === "surface") {
              const resourceType = this.state.resourceType![index] as ResourceType;
              const resourceAmount = this.state.resourceAmount![index] ?? 0;
              this.drawTerrainTile(terrainCtx, localPx, localPy, terrain, biome, elevation, eastElevation, southElevation, this.state.surfaceWater[index] ?? 0, lodStep, lodStep === 1);
              const owner = this.state.owner[index];
              if (owner >= 0) {
                const tribe = tribeById.get(owner);
                if (tribe) {
                  drawPixelRect(terrainCtx, localPx, localPy, TILE_SIZE * lodStep, TILE_SIZE * lodStep, tribe.color, lodStep > 1 ? 0.06 : 0.08);
                }
              }
              if (this.state.road[index] > 0 && lodStep === 1) {
                this.drawRoadTile(terrainCtx, localPx, localPy, this.state.road[index] ?? 1);
              }
              if (lodStep === 1) {
                this.drawFeature(terrainCtx, this.state.feature[index] as FeatureType, localPx, localPy, terrain);
              }
              if (lodStep === 1) {
                this.drawResourcePile(
                  terrainCtx,
                  localPx,
                  localPy,
                  resourceType,
                  resourceAmount,
                  this.state.feature[index] as FeatureType,
                  terrain,
                );
              }
            } else {
              this.drawUndergroundTile(
                terrainCtx,
                terrainCtx,
                localPx,
                localPy,
                this.state.undergroundTerrain[index] as UndergroundTerrainType,
                this.state.undergroundFeature[index] as UndergroundFeatureType,
                this.state.undergroundResourceAmount[index] ?? 0,
                lodStep,
                lodStep === 1,
              );
            }
          }
        }

        const buildingList = chunkedBuildings.get(chunk.key) ?? [];
        for (const building of buildingList) {
          const tribe = tribeById.get(building.tribeId);
          this.drawBuilding(terrainCtx, building, tribe, lodStep === 1, chunk.sprite.x, chunk.sprite.y);
        }

        chunk.texture.update();
        chunk.dirty = false;
      }
    }
  }

  private drawCloudShadowOverlay(minTileX: number, minTileY: number, maxTileX: number, maxTileY: number): void {
    if (!this.renderFilters.weather) {
      return;
    }
    const world = this.state.world;
    if (!world) {
      return;
    }
    const minPxX = minTileX * TILE_SIZE;
    const minPxY = minTileY * TILE_SIZE;
    const maxPxX = (maxTileX + 1) * TILE_SIZE;
    const maxPxY = (maxTileY + 1) * TILE_SIZE;
    const worldPxWidth = world.width * TILE_SIZE;
    const worldPxHeight = world.height * TILE_SIZE;
    for (let i = 0; i < 6; i += 1) {
      const drift = this.presentationClock * 160 * (0.8 + i * 0.11);
      const bandY = worldPxHeight * (0.12 + (((i * 241) % 1000) / 1000) * 0.74);
      const baseX = (((i * 977) % 4096) / 4096) * (worldPxWidth + 520);
      const cx = (baseX + drift) % (worldPxWidth + 520) - 260;
      const cy = bandY + Math.sin(this.presentationClock * 0.35 + i * 1.43) * 36;
      const rx = 90 + i * 28;
      const ry = 44 + i * 15;
      if (cx + rx < minPxX || cy + ry < minPxY || cx - rx > maxPxX || cy - ry > maxPxY) {
        continue;
      }
      const alpha = 0.02 + i * 0.004;
      this.atmosphereGraphics.beginFill(0x000000, alpha);
      this.atmosphereGraphics.drawEllipse(cx - rx * 0.32, cy + 4, rx * 0.62, ry * 0.7);
      this.atmosphereGraphics.drawEllipse(cx, cy - 4, rx * 0.74, ry * 0.86);
      this.atmosphereGraphics.drawEllipse(cx + rx * 0.34, cy + 3, rx * 0.58, ry * 0.68);
      this.atmosphereGraphics.drawEllipse(cx, cy + ry * 0.18, rx * 0.94, ry * 0.52);
      this.atmosphereGraphics.endFill();
    }
  }

  private drawWeatherOverlay(minTileX: number, minTileY: number, maxTileX: number, maxTileY: number): void {
    if (!this.renderFilters.weather) {
      return;
    }
    for (let weatherIndex = 0; weatherIndex < this.state.weather.length; weatherIndex += 1) {
      const cell = this.state.weather[weatherIndex]!;
      if (cell.x + cell.radius < minTileX || cell.y + cell.radius < minTileY || cell.x - cell.radius > maxTileX || cell.y - cell.radius > maxTileY) {
        continue;
      }
      const px = cell.x * TILE_SIZE;
      const py = cell.y * TILE_SIZE;
      const radius = cell.radius * TILE_SIZE;
      let color = 0xffffff;
      let alpha = 0.04;
      if (cell.kind === WeatherKind.Rain) color = 0x7ebee0;
      if (cell.kind === WeatherKind.Storm) color = 0x4f7393;
      if (cell.kind === WeatherKind.Blizzard) color = 0xe8f6ff;
      if (cell.kind === WeatherKind.Heatwave) color = 0xe4a654;
      if (cell.kind === WeatherKind.AshStorm) color = 0x7a6c66;
      if (cell.kind === WeatherKind.Fog) color = 0xd8e2ea;
      alpha = 0.02 + cell.intensity / 4000;
      this.atmosphereGraphics.beginFill(color, alpha);
      this.atmosphereGraphics.drawCircle(px, py, radius);
      this.atmosphereGraphics.endFill();
      if (cell.kind === WeatherKind.Storm) {
        this.atmosphereGraphics.beginFill(0xeaf5ff, 0.01 + ((Math.sin(this.presentationClock * 3.2 + weatherIndex * 1.7) + 1) * 0.5) * 0.04);
        this.atmosphereGraphics.drawCircle(px + radius * 0.12, py - radius * 0.1, radius * 0.66);
        this.atmosphereGraphics.endFill();
      }

      const particleCount = this.zoom > 1.45 ? 10 : 5;
      for (let i = 0; i < particleCount; i += 1) {
        const angle = (i / particleCount) * Math.PI * 2 + (this.presentationClock * 0.9);
        const radial = ((i * 37 + Math.floor(this.presentationClock * 60)) % 100) / 100;
        const offsetX = Math.cos(angle) * radius * radial * 0.9;
        const offsetY = Math.sin(angle * 1.3) * radius * radial * 0.9;
        const particleX = px + offsetX;
        const particleY = py + offsetY;

        if (cell.kind === WeatherKind.Rain || cell.kind === WeatherKind.Storm) {
          drawPixelRect(this.atmosphereGraphics, particleX, particleY, 1, cell.kind === WeatherKind.Storm ? 6 : 4, lighten(color, 40), 0.42);
        } else if (cell.kind === WeatherKind.Blizzard) {
          drawPixelRect(this.atmosphereGraphics, particleX, particleY, 2, 2, 0xffffff, 0.48);
        } else if (cell.kind === WeatherKind.AshStorm) {
          drawPixelRect(this.atmosphereGraphics, particleX, particleY, 2, 1, 0x5c504a, 0.5);
        } else if (cell.kind === WeatherKind.Fog) {
          drawPixelRect(this.atmosphereGraphics, particleX, particleY, 3, 2, 0xe8edf0, 0.14);
        } else if (cell.kind === WeatherKind.Heatwave) {
          drawPixelRect(this.atmosphereGraphics, particleX, particleY, 2, 1, 0xffc177, 0.22);
        }
      }
    }
  }

  private drawRoadTile(target: PixelTarget, px: number, py: number, level = 1): void {
    if (level >= 2) {
      drawPixelRect(target, px + 1, py + 3, 14, 10, 0x8e959d, 0.95);
      drawPixelRect(target, px + 2, py + 4, 12, 1, 0xcfd4d8, 0.32);
      drawPixelRect(target, px + 2, py + 11, 12, 1, 0x666c73, 0.35);
      drawPixelRect(target, px + 3, py + 6, 10, 1, 0x727980, 0.42);
      drawPixelRect(target, px + 3, py + 9, 10, 1, 0x727980, 0.42);
      return;
    }
    drawPixelRect(target, px + 1, py + 4, 14, 8, 0xb28d59, 0.95);
    drawPixelRect(target, px + 2, py + 5, 12, 1, 0xd0b07b, 0.26);
    drawPixelRect(target, px + 2, py + 10, 12, 1, 0x7d6643, 0.3);
    drawPixelRect(target, px + 4, py + 6, 8, 1, 0x8b7249, 0.34);
    drawPixelRect(target, px + 4, py + 9, 8, 1, 0x8b7249, 0.34);
  }

  private drawFeature(target: PixelTarget, feature: FeatureType, px: number, py: number, terrain: TerrainType): void {
    switch (feature) {
      case FeatureType.Trees:
        drawPixelRect(target, px + 7, py + 9, 2, 4, 0x4c321f);
        drawPixelRect(target, px + 4, py + 6, 8, 4, 0x204e2f);
        drawPixelRect(target, px + 5, py + 3, 6, 4, 0x2f6d3e);
        break;
      case FeatureType.BerryPatch:
        drawPixelRect(target, px + 5, py + 9, 6, 3, 0x49733b);
        drawPixelRect(target, px + 4, py + 8, 2, 2, 0xc63d62);
        drawPixelRect(target, px + 8, py + 7, 2, 2, 0xc63d62);
        drawPixelRect(target, px + 10, py + 9, 2, 2, 0xc63d62);
        break;
      case FeatureType.StoneOutcrop:
        drawPixelRect(target, px + 4, py + 8, 8, 5, 0xabb4bc);
        drawPixelRect(target, px + 6, py + 6, 5, 3, 0xd4dde3);
        break;
      case FeatureType.OreVein:
        drawPixelRect(target, px + 4, py + 8, 8, 5, 0x78695c);
        drawPixelRect(target, px + 5, py + 7, 2, 2, 0xc6914c);
        drawPixelRect(target, px + 9, py + 9, 2, 2, 0xc6914c);
        break;
      case FeatureType.ClayDeposit:
        drawPixelRect(target, px + 4, py + 8, 8, 4, 0x8f694c);
        break;
      case FeatureType.FishShoal:
        if (terrain === TerrainType.River || terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow) {
          drawPixelRect(target, px + 4, py + 8, 3, 2, 0xf0fbff, 0.75);
          drawPixelRect(target, px + 9, py + 6, 3, 2, 0xd8f6ff, 0.72);
        }
        break;
      case FeatureType.Volcano:
        drawPixelRect(target, px + 4, py + 8, 8, 5, 0x39211b);
        drawPixelRect(target, px + 6, py + 4, 4, 4, 0x4f2d1f);
        drawPixelRect(target, px + 7, py + 5, 2, 4, 0xffa247, 0.88);
        break;
      case FeatureType.Reeds:
        drawPixelRect(target, px + 5, py + 5, 1, 7, 0x98b96f);
        drawPixelRect(target, px + 8, py + 4, 1, 8, 0x8fb45b);
        drawPixelRect(target, px + 10, py + 6, 1, 6, 0xa5c472);
        break;
      case FeatureType.Trench:
        drawPixelRect(target, px + 1, py + 7, 14, 3, 0x3d2c1d, 0.8);
        drawPixelRect(target, px + 1, py + 6, 14, 1, 0x6f5a3e, 0.45);
        break;
      case FeatureType.IrrigationCanal:
        drawPixelRect(target, px + 1, py + 7, 14, 3, 0x4691b8, 0.85);
        drawPixelRect(target, px + 2, py + 6, 12, 1, 0x8bd3ee, 0.5);
        break;
      case FeatureType.Palisade:
        drawPixelRect(target, px + 1, py + 4, 14, 2, 0x7b5a35, 0.95);
        for (let spike = 2; spike <= 12; spike += 3) {
          drawPixelRect(target, px + spike, py + 2, 1, 4, 0xa67d48, 0.9);
        }
        break;
      case FeatureType.Gate:
        drawPixelRect(target, px + 1, py + 4, 14, 2, 0x7d6441, 0.95);
        drawPixelRect(target, px + 6, py + 2, 4, 6, 0xb99663, 0.92);
        break;
      case FeatureType.StoneWall:
        drawPixelRect(target, px + 1, py + 4, 14, 3, 0x9ca5ae, 0.95);
        drawPixelRect(target, px + 2, py + 3, 12, 1, 0xd8dde3, 0.55);
        break;
      default:
        break;
    }

  }

  private drawResourcePile(target: PixelTarget, px: number, py: number, resourceType: ResourceType, resourceAmount: number, feature: FeatureType, terrain: TerrainType): void {
    if (resourceType === ResourceType.None || resourceAmount <= 0) {
      return;
    }
    if (feature !== FeatureType.None && feature !== FeatureType.Trench && feature !== FeatureType.IrrigationCanal) {
      return;
    }
    if (terrain === TerrainType.WaterDeep || terrain === TerrainType.WaterShallow || terrain === TerrainType.River || terrain === TerrainType.Lava) {
      return;
    }

    const size = resourceAmount >= 22 ? 3 : 2;
    if (resourceType === ResourceType.Wood) {
      drawPixelRect(target, px + 4, py + 9, 8, 3, 0x6f4525, 0.92);
      drawPixelRect(target, px + 5, py + 7, 6, 2, 0x9a693d, 0.9);
      drawPixelRect(target, px + 6, py + 6, 4, 1, 0xd2a26a, 0.72);
      return;
    }
    if (resourceType === ResourceType.Stone) {
      drawPixelRect(target, px + 4, py + 9, 8, 4, 0x99a3ad, 0.94);
      drawPixelRect(target, px + 5, py + 7, 3, 2, 0xcfd7dd, 0.88);
      drawPixelRect(target, px + 8, py + 8, 3, 2, 0xb5bec7, 0.86);
      return;
    }
    if (resourceType === ResourceType.Clay) {
      drawPixelRect(target, px + 4, py + 9, 8, 3, 0x9b6e50, 0.92);
      drawPixelRect(target, px + 5, py + 7, 6, 2, 0xbc8865, 0.86);
      return;
    }
    if (resourceType === ResourceType.Grain || resourceType === ResourceType.Berries) {
      const main = resourceType === ResourceType.Grain ? 0xd2b25a : 0x8b5a37;
      const accent = resourceType === ResourceType.Grain ? 0xf0d589 : 0xc8466e;
      drawPixelRect(target, px + 4, py + 9, 8, 3, main, 0.94);
      drawPixelRect(target, px + 5, py + 7, 3 + size, 2, accent, 0.85);
      drawPixelRect(target, px + 10, py + 8, 2, 2, 0xf2eadc, 0.65);
    }
  }

  private drawBuilding(target: PixelTarget, building: BuildingSnapshot, tribe?: TribeSummary, detail = true, offsetX = 0, offsetY = 0, showDynamicStock = false): void {
    const px = building.x * TILE_SIZE - offsetX;
    const py = building.y * TILE_SIZE - offsetY;
    const w = building.width * TILE_SIZE;
    const h = building.height * TILE_SIZE;
    const tribeColor = tribe?.color ?? 0xffffff;
    const race = tribe?.race ?? RaceType.Humans;
    const age = tribe?.age ?? AgeType.Primitive;
    const materials = raceMaterial(race, age, tribeColor);
    const wall = building.type === BuildingType.Castle || building.type === BuildingType.Watchtower ? lighten(materials.wall, 10) : materials.wall;
    const trim = materials.trim;
    const roof = building.type === BuildingType.Castle || building.type === BuildingType.Watchtower
      ? lighten(materials.roof, 22)
      : building.type === BuildingType.Dock
        ? 0x6b4f34
        : materials.roof;

    if (!detail) {
      drawPixelRect(target, px + 1, py + 2, w - 2, h - 3, wall, 0.94);
      drawPixelRect(target, px + 2, py + 1, w - 4, Math.max(2, Math.floor(h * 0.22)), roof, 0.96);
      if (building.level > 1) {
        drawPixelRect(target, px + 1, py + h - 3, w - 2, 1, trim, 0.45 + Math.min(0.2, (building.level - 1) * 0.08));
      }
      return;
    }

    if (this.viewMode === "surface" && (building.type === BuildingType.MageTower || building.type === BuildingType.ArcaneSanctum || building.type === BuildingType.Foundry || building.type === BuildingType.Factory || building.type === BuildingType.PowerPlant || building.type === BuildingType.Airfield)) {
      const glowColor =
        building.type === BuildingType.MageTower || building.type === BuildingType.ArcaneSanctum ? 0x8da7ff
        : building.type === BuildingType.PowerPlant ? 0x88d4ef
        : building.type === BuildingType.Airfield ? 0xf2ddb2
        : 0xf0ae62;
      drawPixelRect(target, px, py + h - 2, w, 2, glowColor, 0.08);
      drawPixelRect(target, px + 1, py + h - 4, w - 2, 2, glowColor, 0.05);
    }
    drawPixelRect(target, px + 1, py + 3, w - 2, h - 4, wall, 0.96);
    drawPixelRect(target, px + 2, py + 1, w - 4, Math.max(3, Math.floor(h * 0.28)), roof, 0.98);
    drawPixelRect(target, px + 3, py + h - 6, w - 6, 2, trim, 0.45);
    if (building.level > 1) {
      const upgradeGlow = Math.min(0.32, 0.12 + (building.level - 2) * 0.06);
      drawPixelRect(target, px + 2, py + h - 4, w - 4, 1, lighten(trim, 18), 0.5 + upgradeGlow);
      drawPixelRect(target, px + 2, py + 2, w - 4, 1, lighten(wall, 14), 0.18 + upgradeGlow * 0.4);
      for (let pip = 0; pip < Math.min(3, building.level - 1); pip += 1) {
        drawPixelRect(target, px + 3 + pip * 3, py + 2, 2, 1, materials.banner, 0.78);
      }
    }
    if (race === RaceType.Humans) {
      drawPixelRect(target, px + 1, py + 3, 1, h - 4, 0x6f4f34, 0.5);
      drawPixelRect(target, px + w - 2, py + 3, 1, h - 4, 0x6f4f34, 0.5);
      drawPixelRect(target, px + 3, py + 4, w - 6, 1, 0xfff0cb, 0.3);
      drawPixelRect(target, px + Math.floor(w / 2) - 2, py + h - 7, 4, 4, 0x5a3621, 0.95);
      drawPixelRect(target, px + 3, py + 6, 2, 2, 0xffe8ad, 0.78);
      if (w >= 10) {
        drawPixelRect(target, px + w - 5, py + 6, 2, 2, 0xffe8ad, 0.78);
      }
    }

    if (race === RaceType.Elves) {
      drawPixelRect(target, px + Math.floor(w / 2) - 1, py + 1, 2, Math.max(4, Math.floor(h * 0.22)), trim, 0.6);
      drawPixelRect(target, px + 4, py + 4, w - 8, 1, materials.banner, 0.4);
    } else if (race === RaceType.Dwarves) {
      drawPixelRect(target, px + 1, py + h - 4, w - 2, 2, 0x4a4f58, 0.65);
      drawPixelRect(target, px + 2, py + 2, w - 4, 1, 0xd8dee4, 0.25);
    } else if (race === RaceType.Orcs) {
      for (let spike = 3; spike < w - 2; spike += 4) {
        drawPixelRect(target, px + spike, py + 1, 1, 3, 0xc58c51, 0.9);
      }
    } else if (race === RaceType.Goblins) {
      drawPixelRect(target, px + 2, py + 5, 3, 2, 0x8f9478, 0.7);
      drawPixelRect(target, px + w - 7, py + 3, 4, 1, 0xb8ab76, 0.65);
    } else if (race === RaceType.Halflings) {
      drawPixelRect(target, px + Math.floor(w / 2) - 2, py + h - 7, 4, 4, 0x6c4125);
      drawPixelRect(target, px + 3, py + 7, 2, 2, 0xffe7a9, 0.82);
      drawPixelRect(target, px + w - 5, py + 7, 2, 2, 0xffe7a9, 0.82);
    } else if (race === RaceType.Nomads) {
      drawPixelRect(target, px + 2, py + 2, w - 4, 2, 0xe1c491, 0.42);
      drawPixelRect(target, px + Math.floor(w / 2), py + 3, 1, h - 6, materials.banner, 0.6);
    } else if (race === RaceType.Darkfolk) {
      drawPixelRect(target, px + 3, py + 2, w - 6, 1, 0x9d87d7, 0.65);
      drawPixelRect(target, px + Math.floor(w / 2) - 1, py + 4, 2, h - 8, 0x46385c, 0.55);
    } else {
      drawPixelRect(target, px + Math.floor(w / 2), py + 3, 1, h - 6, materials.banner, 0.55);
    }

    switch (building.type) {
      case BuildingType.House:
        drawPixelRect(target, px + 5, py + h - 7, 4, 5, 0x2b1b14);
        drawPixelRect(target, px + 2, py + 7, 3, 3, 0xffdf97, 0.72);
        break;
      case BuildingType.Farm:
      case BuildingType.Orchard:
        drawPixelRect(target, px + 1, py + 1, w - 2, h - 2, 0x6f8f3a, 0.55);
        drawPixelRect(target, px + 3, py + 5, w - 6, 1, 0x5c4d29, 0.72);
        drawPixelRect(target, px + 3, py + 9, w - 6, 1, 0x5c4d29, 0.72);
        if (building.type === BuildingType.Orchard) {
          drawPixelRect(target, px + 4, py + 4, 3, 3, 0x2b6836);
          drawPixelRect(target, px + w - 7, py + h - 7, 3, 3, 0x2b6836);
        }
        break;
      case BuildingType.LumberCamp:
        drawPixelRect(target, px + 3, py + h - 8, w - 6, 3, 0x855a37);
        break;
      case BuildingType.Quarry:
      case BuildingType.Mine:
        drawPixelRect(target, px + 3, py + h - 7, w - 6, 4, 0x9098a0);
        drawPixelRect(target, px + Math.floor(w / 2) - 2, py + 6, 4, 6, 0x1f2430);
        break;
      case BuildingType.Workshop:
      case BuildingType.School:
      case BuildingType.Smithy:
      case BuildingType.Armory:
        drawPixelRect(target, px + 3, py + 5, 5, 6, 0x3a404c);
        drawPixelRect(target, px + 5, py + 3, 2, 4, age >= AgeType.Iron ? 0xc8d2db : 0xb78c62);
        if (building.type === BuildingType.School) {
          drawPixelRect(target, px + w - 7, py + 4, 3, 4, 0xe6e0c7, 0.85);
        }
        if (building.type === BuildingType.Armory) {
          drawPixelRect(target, px + w - 7, py + 4, 3, 5, 0xb64d46, 0.85);
          drawPixelRect(target, px + w - 6, py + 5, 1, 4, 0xe8e4d6, 0.85);
        }
        if (building.type === BuildingType.Smithy || building.type === BuildingType.Armory) {
          drawPixelRect(target, px + w - 6, py + h - 6, 2, 2, 0xffc57e, 0.5);
        }
        break;
      case BuildingType.Dock:
      case BuildingType.FishingHut:
      case BuildingType.Fishery:
        drawPixelRect(target, px + 2, py + h - 5, w - 4, 3, 0x6b4f34);
        drawPixelRect(target, px + Math.floor(w / 2), py + 2, 1, h - 4, trim);
        if (building.type === BuildingType.Fishery) {
          drawPixelRect(target, px + 3, py + 4, w - 6, 2, 0xa7d7eb, 0.7);
        }
        break;
      case BuildingType.Warehouse:
        drawPixelRect(target, px + 3, py + h - 8, w - 6, 5, 0x936b40);
        drawPixelRect(target, px + 4, py + 5, 4, 3, 0xc9b07a, 0.85);
        drawPixelRect(target, px + w - 8, py + 5, 4, 3, 0xc9b07a, 0.85);
        break;
      case BuildingType.Cistern:
        drawPixelRect(target, px + 3, py + 5, w - 6, h - 7, 0x6f7d88, 0.9);
        drawPixelRect(target, px + 4, py + 6, w - 8, h - 9, 0x4b94b7, 0.85);
        drawPixelRect(target, px + 5, py + 7, w - 10, 1, 0xa7dbef, 0.65);
        break;
      case BuildingType.Stable:
        drawPixelRect(target, px + 3, py + h - 8, w - 6, 5, 0x7e5b36);
        break;
      case BuildingType.Barracks:
        drawPixelRect(target, px + w - 8, py + 4, 2, h - 8, materials.banner);
        drawPixelRect(target, px + w - 6, py + 5, 3, 3, 0xf6efe5, 0.68);
        break;
      case BuildingType.Watchtower:
        drawPixelRect(target, px + 4, py + 4, w - 8, h - 8, 0xd7dee7, 0.75);
        break;
      case BuildingType.MountainHall:
        drawPixelRect(target, px + 1, py + 3, w - 2, h - 3, 0x5d646b, 0.96);
        drawPixelRect(target, px + 3, py + 5, w - 6, h - 7, 0x30353b, 0.9);
        drawPixelRect(target, px + Math.floor(w / 2) - 2, py + h - 6, 4, 4, 0x1a1e23, 0.95);
        drawPixelRect(target, px + Math.floor(w / 2) - 3, py + h - 8, 6, 2, materials.banner, 0.75);
        drawPixelRect(target, px + 2, py + 2, w - 4, 1, 0xcfd6dd, 0.35);
        break;
      case BuildingType.DeepMine:
        drawPixelRect(target, px + 2, py + 4, w - 4, h - 4, 0x545b61, 0.95);
        drawPixelRect(target, px + Math.floor(w / 2) - 2, py + 4, 4, h - 5, 0x1a1f24, 0.95);
        drawPixelRect(target, px + Math.floor(w / 2) - 1, py + 2, 2, 3, 0xc9b07a, 0.85);
        drawPixelRect(target, px + 3, py + h - 4, w - 6, 1, 0x8f98a0, 0.45);
        break;
      case BuildingType.TunnelEntrance:
        drawPixelRect(target, px + 2, py + 5, w - 4, h - 5, 0x5d646b, 0.92);
        drawPixelRect(target, px + 4, py + 7, w - 8, h - 8, 0x171b20, 0.95);
        drawPixelRect(target, px + Math.floor(w / 2) - 3, py + 4, 6, 2, materials.banner, 0.75);
        drawPixelRect(target, px + 3, py + 3, w - 6, 1, 0xcfd6dd, 0.35);
        break;
      case BuildingType.Shrine:
        drawPixelRect(target, px + Math.floor(w / 2) - 2, py + 4, 4, h - 8, 0xe6dfd0, 0.85);
        drawPixelRect(target, px + Math.floor(w / 2), py + 2, 1, h - 4, 0xd3b364, 0.85);
        drawPixelRect(target, px + Math.floor(w / 2) - 3, py + 5, 6, 1, 0xd3b364, 0.85);
        break;
      case BuildingType.Tavern:
        drawPixelRect(target, px + 4, py + 4, w - 8, h - 8, 0x6c4125, 0.8);
        drawPixelRect(target, px + Math.floor(w / 2) - 3, py + 3, 6, 2, 0xb23c30, 0.9);
        drawPixelRect(target, px + Math.floor(w / 2) - 2, py + 4, 4, 1, 0xf5e5c0, 0.7);
        break;
      case BuildingType.Infirmary:
        drawPixelRect(target, px + 4, py + 4, w - 8, h - 8, 0xf0e7dc, 0.8);
        drawPixelRect(target, px + Math.floor(w / 2) - 1, py + 4, 2, h - 8, 0xc84f54, 0.92);
        drawPixelRect(target, px + 4, py + Math.floor(h / 2) - 1, w - 8, 2, 0xc84f54, 0.92);
        break;
      case BuildingType.MageTower:
        drawPixelRect(target, px + Math.floor(w / 2) - 3, py + 3, 6, h - 6, 0x3b3552, 0.92);
        drawPixelRect(target, px + Math.floor(w / 2) - 1, py + 1, 2, 3, 0x9fb7ff, 0.95);
        drawPixelRect(target, px + 3, py + h - 6, w - 6, 2, 0x8b73c8, 0.8);
        break;
      case BuildingType.ArcaneSanctum:
        drawPixelRect(target, px + 3, py + 4, w - 6, h - 6, 0x312b48, 0.95);
        drawPixelRect(target, px + Math.floor(w / 2) - 4, py + 2, 8, 2, 0x8da7ff, 0.92);
        drawPixelRect(target, px + Math.floor(w / 2) - 2, py + 5, 4, h - 10, 0x5c4fa0, 0.92);
        drawPixelRect(target, px + 4, py + h - 6, w - 8, 2, 0xb58cff, 0.75);
        drawPixelRect(target, px + 5, py + 5, 2, 2, 0xe9efff, 0.8);
        drawPixelRect(target, px + w - 7, py + 5, 2, 2, 0xe9efff, 0.8);
        drawPixelRect(target, px + Math.floor(w / 2) - 1, py + 1, 2, h - 2, 0xc9d6ff, 0.12);
        break;
      case BuildingType.Foundry:
        drawPixelRect(target, px + 3, py + 5, w - 6, h - 6, 0x4c4640, 0.95);
        drawPixelRect(target, px + 4, py + 3, 4, 5, 0x8f989f, 0.88);
        drawPixelRect(target, px + w - 7, py + 3, 3, 6, 0x40372e, 0.92);
        drawPixelRect(target, px + w - 7, py + 2, 3, 2, 0xb44e36, 0.9);
        drawPixelRect(target, px + 4, py + h - 5, w - 8, 1, 0xd29a54, 0.65);
        break;
      case BuildingType.Factory:
        drawPixelRect(target, px + 2, py + 5, w - 4, h - 5, 0x55504a, 0.96);
        drawPixelRect(target, px + 4, py + 3, 4, 6, 0x737d86, 0.9);
        drawPixelRect(target, px + w - 8, py + 3, 4, 7, 0x3a332d, 0.92);
        drawPixelRect(target, px + w - 8, py + 2, 4, 2, 0xcf6d43, 0.9);
        drawPixelRect(target, px + 4, py + h - 6, w - 8, 2, 0xd5a45a, 0.75);
        drawPixelRect(target, px + 5, py + 7, 3, 2, 0xcfd8e0, 0.75);
        drawPixelRect(target, px + w - 8, py + 8, 3, 2, 0xcfd8e0, 0.75);
        drawPixelRect(target, px + 3, py + h - 8, w - 6, 1, 0xffd28d, 0.18);
        break;
      case BuildingType.RailDepot:
        drawPixelRect(target, px + 2, py + 6, w - 4, h - 6, 0x6a5641, 0.95);
        drawPixelRect(target, px + 3, py + h - 5, w - 6, 2, 0x45484f, 0.92);
        drawPixelRect(target, px + 4, py + h - 7, w - 8, 1, 0xb8c1ca, 0.75);
        drawPixelRect(target, px + 4, py + 4, 4, 3, tribeColor, 0.78);
        drawPixelRect(target, px + w - 8, py + 4, 4, 3, 0xd9bf84, 0.85);
        break;
      case BuildingType.PowerPlant:
        drawPixelRect(target, px + 2, py + 5, w - 4, h - 5, 0x4d5258, 0.96);
        drawPixelRect(target, px + 4, py + 2, 4, 7, 0x7f8992, 0.92);
        drawPixelRect(target, px + w - 8, py + 1, 4, 8, 0x6e757d, 0.92);
        drawPixelRect(target, px + 5, py + 3, 2, 2, 0xcfd8e0, 0.82);
        drawPixelRect(target, px + w - 7, py + 2, 2, 2, 0xcfd8e0, 0.82);
        drawPixelRect(target, px + 4, py + h - 6, w - 8, 2, 0x89d2f5, 0.72);
        drawPixelRect(target, px + Math.floor(w / 2) - 2, py + h - 9, 4, 2, 0xf1dc89, 0.78);
        drawPixelRect(target, px + 4, py + 1, 4, 2, 0xdce8f0, 0.22);
        drawPixelRect(target, px + w - 8, py, 4, 2, 0xdce8f0, 0.18);
        break;
      case BuildingType.Airfield:
        drawPixelRect(target, px + 2, py + h - 7, w - 4, 4, 0x626d76, 0.94);
        drawPixelRect(target, px + 3, py + h - 6, w - 6, 2, 0x89939b, 0.78);
        drawPixelRect(target, px + Math.floor(w / 2) - 5, py + 4, 10, 4, 0xb7c1ca, 0.9);
        drawPixelRect(target, px + Math.floor(w / 2) - 1, py + 2, 2, 8, tribeColor, 0.8);
        drawPixelRect(target, px + 4, py + 5, 4, 1, 0xe7eef4, 0.88);
        drawPixelRect(target, px + w - 8, py + 5, 4, 1, 0xe7eef4, 0.88);
        drawPixelRect(target, px + Math.floor(w / 2) - 6, py + h - 8, 12, 1, 0xf5ead0, 0.5);
        drawPixelRect(target, px + 3, py + h - 5, 2, 1, 0xf6f0cf, 0.6);
        drawPixelRect(target, px + w - 5, py + h - 5, 2, 1, 0xf6f0cf, 0.6);
        break;
      case BuildingType.Castle:
        drawPixelRect(target, px + 2, py + 2, 5, 5, 0xc7d0d8);
        drawPixelRect(target, px + w - 7, py + 2, 5, 5, 0xc7d0d8);
        drawPixelRect(target, px + 2, py + h - 7, 5, 5, 0xc7d0d8);
        drawPixelRect(target, px + w - 7, py + h - 7, 5, 5, 0xc7d0d8);
        drawPixelRect(target, px + Math.floor(w / 2) - 1, py + 5, 2, h - 10, materials.banner, 0.7);
        break;
      default:
        break;
    }

    if (showDynamicStock && building.stockResource !== ResourceType.None && building.stockAmount > 0) {
      const stockColor = resourceVisualColor(building.stockResource);
      const pileWidth = building.stockAmount >= 20 ? 6 : building.stockAmount >= 10 ? 5 : 4;
      const pileHeight = building.stockAmount >= 20 ? 3 : 2;
      const pileX = px + Math.max(2, w - pileWidth - 3);
      const pileY = py + h - pileHeight - 3;
      drawPixelRect(target, pileX, pileY, pileWidth, pileHeight, stockColor, 0.92);
      drawPixelRect(target, pileX + 1, pileY - 1, Math.max(2, pileWidth - 2), 1, lighten(stockColor, 18), 0.68);
      if (building.stockResource === ResourceType.Wood || building.stockResource === ResourceType.Planks) {
        drawPixelRect(target, pileX, pileY + pileHeight, pileWidth, 1, 0x6f4525, 0.82);
      } else if (building.stockResource === ResourceType.Stone || building.stockResource === ResourceType.Clay || building.stockResource === ResourceType.Ore) {
        drawPixelRect(target, pileX + 1, pileY + pileHeight, Math.max(2, pileWidth - 2), 1, 0xd7dde3, 0.6);
      } else if (building.stockResource === ResourceType.Grain || building.stockResource === ResourceType.Berries || building.stockResource === ResourceType.Fish || building.stockResource === ResourceType.Meat) {
        drawPixelRect(target, pileX + 1, pileY + pileHeight, Math.max(2, pileWidth - 2), 1, 0xf2ddb2, 0.62);
      }
    }
  }

  private drawBuildingDynamicOverlay(target: PixelTarget, building: BuildingSnapshot, tribe?: TribeSummary): void {
    const px = building.x * TILE_SIZE;
    const py = building.y * TILE_SIZE;
    const w = building.width * TILE_SIZE;
    const h = building.height * TILE_SIZE;
    const tribeColor = tribe?.color ?? 0xffffff;
    const race = tribe?.race ?? RaceType.Humans;
    const age = tribe?.age ?? AgeType.Primitive;
    const materials = raceMaterial(race, age, tribeColor);

    if (building.level > 1) {
      const upgradeGlow = Math.min(0.32, 0.12 + (building.level - 2) * 0.06);
      drawPixelRect(target, px + 2, py + h - 4, w - 4, 1, lighten(materials.trim, 18), 0.5 + upgradeGlow);
      for (let pip = 0; pip < Math.min(3, building.level - 1); pip += 1) {
        drawPixelRect(target, px + 3 + pip * 3, py + 2, 2, 1, materials.banner, 0.76);
      }
    }

    if (building.stockResource !== ResourceType.None && building.stockAmount > 0) {
      const stockColor = resourceVisualColor(building.stockResource);
      const pileWidth = building.stockAmount >= 20 ? 6 : building.stockAmount >= 10 ? 5 : 4;
      const pileHeight = building.stockAmount >= 20 ? 3 : 2;
      const pileX = px + Math.max(2, w - pileWidth - 3);
      const pileY = py + h - pileHeight - 3;
      drawPixelRect(target, pileX, pileY, pileWidth, pileHeight, stockColor, 0.92);
      drawPixelRect(target, pileX + 1, pileY - 1, Math.max(2, pileWidth - 2), 1, lighten(stockColor, 18), 0.68);
      if (building.stockResource === ResourceType.Wood || building.stockResource === ResourceType.Planks) {
        drawPixelRect(target, pileX, pileY + pileHeight, pileWidth, 1, 0x6f4525, 0.82);
      } else if (building.stockResource === ResourceType.Stone || building.stockResource === ResourceType.Clay || building.stockResource === ResourceType.Ore) {
        drawPixelRect(target, pileX + 1, pileY + pileHeight, Math.max(2, pileWidth - 2), 1, 0xd7dde3, 0.6);
      } else if (building.stockResource === ResourceType.Grain || building.stockResource === ResourceType.Berries || building.stockResource === ResourceType.Fish || building.stockResource === ResourceType.Meat) {
        drawPixelRect(target, pileX + 1, pileY + pileHeight, Math.max(2, pileWidth - 2), 1, 0xf5e3b8, 0.62);
      }
    }
  }

  private drawAnimal(animal: AnimalSnapshot, tileX: number, tileY: number): void {
    const px = tileX * TILE_SIZE;
    const py = tileY * TILE_SIZE;
    const color = ANIMAL_COLORS[animal.type];
    const bodyY = animal.type === AnimalType.Horse ? 9 : 10;
    drawPixelRect(this.unitGraphics, px + 3, py + 13, 10, 2, 0x000000, 0.16);
    drawPixelRect(this.unitGraphics, px + 4, py + bodyY, 8, 4, color, 0.95);
    drawPixelRect(this.unitGraphics, px + 6, py + 7, 4, 3, lighten(color, 16), 0.92);
    drawPixelRect(this.unitGraphics, px + 4, py + 13, 1, 2, darken(color, 26));
    drawPixelRect(this.unitGraphics, px + 10, py + 13, 1, 2, darken(color, 26));
    if (animal.type === AnimalType.Wolf) {
      drawPixelRect(this.unitGraphics, px + 11, py + 8, 2, 2, 0xe5eef7);
    } else if (animal.type === AnimalType.Goat) {
      drawPixelRect(this.unitGraphics, px + 5, py + 6, 1, 2, 0xc8b694);
      drawPixelRect(this.unitGraphics, px + 10, py + 6, 1, 2, 0xc8b694);
    }
  }

  private drawBoat(boat: BoatSnapshot, tribeColor: number, tileX: number, tileY: number): void {
    const px = tileX * TILE_SIZE;
    const py = tileY * TILE_SIZE;
    drawPixelRect(this.unitGraphics, px + 2, py + 12, 12, 2, 0x000000, 0.14);
    drawPixelRect(this.unitGraphics, px + 3, py + 10, 10, 3, darken(tribeColor, 50), 0.98);
    drawPixelRect(this.unitGraphics, px + 5, py + 8, 6, 2, lighten(tribeColor, 18), 0.88);
    drawPixelRect(this.unitGraphics, px + 7, py + 4, 1, 6, 0xdfe9f0, 0.9);
    drawPixelRect(this.unitGraphics, px + 8, py + 5, 3, 3, tribeColor, 0.84);
    if (boat.cargo > 0) {
      drawPixelRect(this.unitGraphics, px + 5, py + 9, 2, 2, 0xf4d36c, 0.95);
    }
    if (boat.task === BoatTaskType.ReturnToDock) {
      drawPixelRect(this.unitGraphics, px + 11, py + 7, 2, 2, 0xffffff, 0.65);
    }
  }

  private drawCaravan(caravan: CaravanSnapshot, tribeColor: number, tileX: number, tileY: number): void {
    const px = tileX * TILE_SIZE;
    const py = tileY * TILE_SIZE;
    drawPixelRect(this.unitGraphics, px + 2, py + 13, 12, 2, 0x000000, 0.14);
    drawPixelRect(this.unitGraphics, px + 3, py + 10, 10, 3, 0x7a5735, 0.96);
    drawPixelRect(this.unitGraphics, px + 5, py + 7, 6, 3, 0xa78456, 0.92);
    drawPixelRect(this.unitGraphics, px + 6, py + 5, 4, 2, tribeColor, 0.82);
    drawPixelRect(this.unitGraphics, px + 4, py + 13, 2, 2, 0x433425, 0.9);
    drawPixelRect(this.unitGraphics, px + 10, py + 13, 2, 2, 0x433425, 0.9);
    if (caravan.cargoAmount > 0) {
      const cargoColor = caravan.cargoType === ResourceType.Wood ? 0x9b7145
        : caravan.cargoType === ResourceType.Stone ? 0xb8c1c8
        : caravan.cargoType === ResourceType.Ore ? 0xc08a56
        : caravan.cargoType === ResourceType.Fish ? 0x9ddff3
        : 0xf0d780;
      drawPixelRect(this.unitGraphics, px + 6, py + 8, 4, 2, cargoColor, 0.95);
    }
    if (caravan.task === CaravanTaskType.ToPartner) {
      drawPixelRect(this.unitGraphics, px + 12, py + 6, 2, 1, 0xf4f8fb, 0.7);
    }
  }

  private drawWagon(wagon: WagonSnapshot, tribeColor: number, tileX: number, tileY: number): void {
    const px = tileX * TILE_SIZE;
    const py = tileY * TILE_SIZE;
    drawPixelRect(this.unitGraphics, px + 2, py + 13, 12, 2, 0x000000, 0.14);
    drawPixelRect(this.unitGraphics, px + 4, py + 10, 8, 3, 0x7c5b39, 0.96);
    drawPixelRect(this.unitGraphics, px + 5, py + 7, 6, 3, 0xaa8756, 0.92);
    drawPixelRect(this.unitGraphics, px + 6, py + 5, 4, 2, tribeColor, 0.82);
    drawPixelRect(this.unitGraphics, px + 3, py + 13, 2, 2, 0x403224, 0.9);
    drawPixelRect(this.unitGraphics, px + 11, py + 13, 2, 2, 0x403224, 0.9);
    drawPixelRect(this.unitGraphics, px + 2, py + 9, 2, 3, 0xc8b694, 0.85);
    drawPixelRect(this.unitGraphics, px + 12, py + 9, 2, 3, 0xc8b694, 0.85);
    if (wagon.cargoAmount > 0) {
      const cargoColor = wagon.cargoType === ResourceType.Wood ? 0x9b7145
        : wagon.cargoType === ResourceType.Stone ? 0xb8c1c8
        : wagon.cargoType === ResourceType.Ore ? 0xc08a56
        : wagon.cargoType === ResourceType.Planks ? 0xb58a59
        : 0xf0d780;
      drawPixelRect(this.unitGraphics, px + 6, py + 8, 4, 2, cargoColor, 0.95);
    }
    if (wagon.task === WagonTaskType.ToDrop) {
      drawPixelRect(this.unitGraphics, px + 12, py + 6, 2, 1, 0xf4f8fb, 0.7);
    }
  }

  private drawPlannedSite(site: PlannedSiteSnapshot, tribe?: TribeSummary): void {
    const px = site.x * TILE_SIZE;
    const py = site.y * TILE_SIZE;
    const w = site.width * TILE_SIZE;
    const h = site.height * TILE_SIZE;
    const tribeColor = tribe?.color ?? 0xffffff;
    const materials = raceMaterial(tribe?.race ?? RaceType.Humans, tribe?.age ?? AgeType.Primitive, tribeColor);
    const progress = site.supplyNeeded > 0 ? clamp(site.supplied / site.supplyNeeded, 0, 1) : 0;

    drawPixelRect(this.selectionGraphics, px + 1, py + 1, w - 2, h - 2, lighten(materials.wall, 8), 0.12);
    drawPixelRect(this.selectionGraphics, px + 1, py + h - 3, w - 2, 2, 0x4e3a2b, 0.45);
    drawPixelRect(this.selectionGraphics, px + 1, py + 1, w - 2, 1, tribeColor, 0.42);
    drawPixelRect(this.selectionGraphics, px + 1, py + 1, 1, h - 2, tribeColor, 0.3);
    drawPixelRect(this.selectionGraphics, px + w - 2, py + 1, 1, h - 2, tribeColor, 0.3);

    const scaffoldColor = darken(materials.trim, 22);
    drawPixelRect(this.selectionGraphics, px + 2, py + 3, 2, h - 6, scaffoldColor, 0.75);
    drawPixelRect(this.selectionGraphics, px + w - 4, py + 3, 2, h - 6, scaffoldColor, 0.75);
    drawPixelRect(this.selectionGraphics, px + 3, py + h - 6, w - 6, 1, scaffoldColor, 0.75);

    const placedWidth = Math.max(0, Math.floor((w - 6) * progress));
    if (placedWidth > 0) {
      drawPixelRect(this.selectionGraphics, px + 3, py + h - 7, placedWidth, 2, lighten(materials.wall, 14), 0.55);
    }

    const stackCount = Math.max(1, Math.min(4, site.supplyNeeded - site.supplied + 1));
    for (let i = 0; i < stackCount; i += 1) {
      const stackX = px + 3 + i * 4;
      drawPixelRect(this.selectionGraphics, stackX, py + h - 5, 3, 2, 0xb58a59, 0.9);
      drawPixelRect(this.selectionGraphics, stackX + 1, py + h - 7, 2, 2, i % 2 === 0 ? 0xb7c1ca : 0xd8c27a, 0.86);
    }
  }

  private drawSiegeEngine(engine: SiegeEngineSnapshot, tribeColor: number, renderX = engine.x, renderY = engine.y): void {
    const px = renderX * TILE_SIZE;
    const py = renderY * TILE_SIZE;
    drawPixelRect(this.unitGraphics, px + 2, py + 13, 12, 2, 0x000000, 0.16);
    if (engine.type === SiegeEngineType.Trebuchet) {
      drawPixelRect(this.unitGraphics, px + 2, py + 10, 12, 3, 0x6b4d31, 0.95);
      drawPixelRect(this.unitGraphics, px + 6, py + 4, 1, 7, 0xbca07a, 0.9);
      drawPixelRect(this.unitGraphics, px + 6, py + 4, 6, 1, 0xc8b08a, 0.9);
      drawPixelRect(this.unitGraphics, px + 10, py + 2, 2, 2, 0x8b9097, 0.9);
      drawPixelRect(this.unitGraphics, px + 8, py + 6, 3, 3, tribeColor, 0.8);
      if (engine.task === "bombard") {
        drawPixelRect(this.unitGraphics, px + 12, py + 1, 2, 2, 0xf5d9b5, 0.8);
      }
    } else if (engine.type === SiegeEngineType.Ballista) {
      drawPixelRect(this.unitGraphics, px + 2, py + 10, 12, 3, 0x725033, 0.95);
      drawPixelRect(this.unitGraphics, px + 7, py + 5, 1, 6, 0xd0b38b, 0.92);
      drawPixelRect(this.unitGraphics, px + 4, py + 5, 8, 1, 0xd0b38b, 0.92);
      drawPixelRect(this.unitGraphics, px + 12, py + 5, 2, 1, 0xcfd8df, 0.85);
      drawPixelRect(this.unitGraphics, px + 3, py + 7, 3, 2, tribeColor, 0.8);
      if (engine.task === "bombard") {
        drawPixelRect(this.unitGraphics, px + 13, py + 5, 2, 1, 0xf5f1de, 0.88);
      }
    } else if (engine.type === SiegeEngineType.SiegeTower) {
      drawPixelRect(this.unitGraphics, px + 3, py + 4, 10, 9, 0x6a4e34, 0.94);
      drawPixelRect(this.unitGraphics, px + 4, py + 5, 8, 2, tribeColor, 0.75);
      drawPixelRect(this.unitGraphics, px + 4, py + 8, 8, 1, 0xc9aa81, 0.8);
      drawPixelRect(this.unitGraphics, px + 5, py + 13, 2, 2, 0x3f3023, 0.9);
      drawPixelRect(this.unitGraphics, px + 9, py + 13, 2, 2, 0x3f3023, 0.9);
      if (engine.task === "bombard") {
        drawPixelRect(this.unitGraphics, px + 12, py + 6, 2, 4, 0xeedeb4, 0.78);
      }
    } else if (engine.type === SiegeEngineType.Cannon) {
      drawPixelRect(this.unitGraphics, px + 3, py + 10, 10, 3, 0x6a4a31, 0.95);
      drawPixelRect(this.unitGraphics, px + 6, py + 7, 6, 3, 0x767f88, 0.94);
      drawPixelRect(this.unitGraphics, px + 11, py + 8, 3, 2, 0xcfd7de, 0.92);
      drawPixelRect(this.unitGraphics, px + 4, py + 12, 2, 2, 0x3f3023, 0.9);
      drawPixelRect(this.unitGraphics, px + 10, py + 12, 2, 2, 0x3f3023, 0.9);
      drawPixelRect(this.unitGraphics, px + 3, py + 8, 2, 2, tribeColor, 0.8);
      if (engine.task === "bombard") {
        drawPixelRect(this.unitGraphics, px + 13, py + 7, 2, 2, 0xf4d59a, 0.92);
        drawPixelRect(this.unitGraphics, px + 14, py + 6, 1, 4, 0xd7dce1, 0.45);
      }
    } else if (engine.type === SiegeEngineType.Mortar) {
      drawPixelRect(this.unitGraphics, px + 3, py + 10, 10, 3, 0x66503a, 0.95);
      drawPixelRect(this.unitGraphics, px + 7, py + 6, 4, 4, 0x707983, 0.95);
      drawPixelRect(this.unitGraphics, px + 9, py + 4, 2, 3, 0xcfd7de, 0.9);
      drawPixelRect(this.unitGraphics, px + 4, py + 12, 2, 2, 0x3f3023, 0.9);
      drawPixelRect(this.unitGraphics, px + 10, py + 12, 2, 2, 0x3f3023, 0.9);
      drawPixelRect(this.unitGraphics, px + 3, py + 8, 2, 2, tribeColor, 0.8);
      if (engine.task === "bombard") {
        drawPixelRect(this.unitGraphics, px + 10, py + 2, 3, 2, 0xf0d193, 0.94);
        drawPixelRect(this.unitGraphics, px + 11, py + 0, 1, 4, 0xd7dce1, 0.4);
      }
    } else if (engine.type === SiegeEngineType.Tank) {
      drawPixelRect(this.unitGraphics, px + 2, py + 10, 12, 3, 0x46505a, 0.96);
      drawPixelRect(this.unitGraphics, px + 4, py + 7, 8, 4, 0x65707b, 0.96);
      drawPixelRect(this.unitGraphics, px + 8, py + 5, 4, 2, 0x7f8a93, 0.94);
      drawPixelRect(this.unitGraphics, px + 11, py + 6, 4, 1, 0xdce3e8, 0.88);
      drawPixelRect(this.unitGraphics, px + 3, py + 13, 10, 1, 0x2b3035, 0.9);
      drawPixelRect(this.unitGraphics, px + 5, py + 8, 2, 1, tribeColor, 0.8);
      if (engine.task === "bombard") {
        drawPixelRect(this.unitGraphics, px + 14, py + 5, 2, 2, 0xf6d18c, 0.95);
      }
    } else if (engine.type === SiegeEngineType.Zeppelin) {
      drawPixelRect(this.unitGraphics, px + 2, py + 4, 12, 5, 0x98a6b4, 0.92);
      drawPixelRect(this.unitGraphics, px + 4, py + 5, 8, 3, lighten(tribeColor, 16), 0.7);
      drawPixelRect(this.unitGraphics, px + 6, py + 9, 4, 2, 0x5e4d3b, 0.92);
      drawPixelRect(this.unitGraphics, px + 12, py + 5, 2, 2, tribeColor, 0.84);
      drawPixelRect(this.unitGraphics, px + 1, py + 5, 2, 1, 0xd9e2e9, 0.82);
      drawPixelRect(this.unitGraphics, px + 13, py + 5, 2, 1, 0xd9e2e9, 0.82);
      if (engine.task === "bombard") {
        drawPixelRect(this.unitGraphics, px + 7, py + 12, 2, 2, 0xf5d9a0, 0.9);
      }
    } else {
      drawPixelRect(this.unitGraphics, px + 2, py + 9, 12, 4, 0x7b5631, 0.95);
      drawPixelRect(this.unitGraphics, px + 10, py + 5, 4, 4, 0x90877f, 0.9);
      drawPixelRect(this.unitGraphics, px + 2, py + 7, 10, 2, tribeColor, 0.75);
      if (engine.task === "bombard") {
        drawPixelRect(this.unitGraphics, px + 13, py + 8, 2, 1, 0xf0ead7, 0.85);
      }
    }
    if (this.zoom > 0.95) {
      drawPixelRect(this.unitGraphics, px + 3, py + 1, Math.min(10, 10 * (engine.hp / 100)), 1, 0x78d67a, 0.85);
      drawPixelRect(this.unitGraphics, px + 3, py + 2, 10, 1, 0x2d3a2e, 0.45);
    }
  }

  private drawLegendaryCreature(creature: LegendaryCreatureSnapshot): void {
    const px = creature.x * TILE_SIZE;
    const py = creature.y * TILE_SIZE;
    drawPixelRect(this.unitGraphics, px + 1, py + 13, 14, 2, 0x000000, 0.2);
    let body = 0xd05d3a;
    if (creature.type === LegendaryCreatureType.SeaSerpent) body = 0x4bb0cf;
    if (creature.type === LegendaryCreatureType.ForestSpirit) body = 0x67b56c;
    if (creature.type === LegendaryCreatureType.AshTitan) body = 0x6f6363;
    drawPixelRect(this.unitGraphics, px + 2, py + 8, 12, 6, body, 0.95);
    drawPixelRect(this.unitGraphics, px + 5, py + 3, 6, 5, lighten(body, 18), 0.9);
    drawPixelRect(this.unitGraphics, px + 12, py + 4, 2, 2, 0xf7ead7, 0.9);
    if (creature.type === LegendaryCreatureType.Dragon) {
      drawPixelRect(this.unitGraphics, px + 1, py + 6, 3, 2, 0x7a2820, 0.9);
      drawPixelRect(this.unitGraphics, px + 12, py + 11, 3, 2, 0x7a2820, 0.9);
    }
  }

  private drawMinimap(force = true): void {
    const world = this.state.world;
    const terrain = this.viewMode === "surface" ? this.state.terrain : this.state.undergroundTerrain;
    if (!world || !terrain) return;
    const now = performance.now();
    if (!force && !this.minimapDirty) {
      return;
    }
    if (!force && now - this.lastMinimapDrawAt < 120) {
      return;
    }
    const ctx = this.minimap.getContext("2d");
    const backdropCtx = this.minimapBackdrop.getContext("2d");
    if (!ctx) return;
    const scaleX = this.minimap.width / world.width;
    const scaleY = this.minimap.height / world.height;
    ctx.imageSmoothingEnabled = false;
    if (this.minimapTerrainDirty && backdropCtx) {
      backdropCtx.imageSmoothingEnabled = false;
      backdropCtx.clearRect(0, 0, this.minimapBackdrop.width, this.minimapBackdrop.height);
      for (let y = 0; y < this.minimap.height; y += 1) {
        for (let x = 0; x < this.minimap.width; x += 1) {
          const worldX = Math.floor((x / this.minimap.width) * world.width);
          const worldY = Math.floor((y / this.minimap.height) * world.height);
          const tile = terrain[indexOf(worldX, worldY, world.width)]!;
          const color = this.viewMode === "surface"
            ? (TERRAIN_COLORS[tile as TerrainType] ?? 0)
            : (UNDERGROUND_TERRAIN_COLORS[tile as UndergroundTerrainType] ?? 0);
          backdropCtx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
          backdropCtx.fillRect(x, y, 1, 1);
        }
      }
      this.minimapTerrainDirty = false;
    }
    ctx.clearRect(0, 0, this.minimap.width, this.minimap.height);
    if (backdropCtx) {
      ctx.drawImage(this.minimapBackdrop, 0, 0);
    }
    for (const tribe of this.state.tribes) {
      ctx.fillStyle = `#${tribe.color.toString(16).padStart(6, "0")}`;
      ctx.fillRect(tribe.capitalX * scaleX - 2, tribe.capitalY * scaleY - 2, 4, 4);
    }
    const viewportWidth = this.app.renderer.width / this.zoom / TILE_SIZE;
    const viewportHeight = this.app.renderer.height / this.zoom / TILE_SIZE;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(this.cameraX / TILE_SIZE * scaleX, this.cameraY / TILE_SIZE * scaleY, viewportWidth * scaleX, viewportHeight * scaleY);
    this.minimapDirty = false;
    this.lastMinimapDrawAt = now;
    this.lastMinimapCameraX = this.cameraX;
    this.lastMinimapCameraY = this.cameraY;
    this.lastMinimapZoom = this.zoom;
  }

  private drawAgent(agent: AgentSnapshot, tileX: number, tileY: number, tribe?: TribeSummary, detail = true): void {
    const race = tribe?.race ?? RaceType.Humans;
    const tribeColor = tribe?.color ?? 0xffffff;
    const accent = ROLE_ACCENTS[agent.role];
    const gearColors = gearAccent(agent, race);
    const px = tileX * TILE_SIZE;
    const py = tileY * TILE_SIZE;
    const animPhase = this.presentationClock * 7 + agent.id * 0.31;
    const stride = (Math.sin(animPhase) + 1) * 0.5;
    const pulse = Math.sin(animPhase * 0.6);
    const taskBob = (pulse + 1) * 0.8;
    const swing =
      agent.task === "cut_tree" || agent.task === "mine" || agent.task === "quarry" || agent.task === "build" || agent.task === "earthwork" || agent.task === "hunt" || agent.task === "attack" || agent.task === "farm"
        ? Math.round(Math.sin(this.presentationClock * 14 + agent.id) * 2)
        : 0;
    drawPixelRect(this.unitGraphics, px + 4, py + 13, 8, 2, 0x000000, 0.16);

    switch (race) {
      case RaceType.Elves:
        drawPixelRect(this.unitGraphics, px + 6, py + 4, 4, 3, lighten(gearColors.cloth, 8));
        drawPixelRect(this.unitGraphics, px + 4, py + 7, 8, 6, tribeColor);
        drawPixelRect(this.unitGraphics, px + 3, py + 5, 1, 2, accent);
        drawPixelRect(this.unitGraphics, px + 12, py + 5, 1, 2, accent);
        break;
      case RaceType.Dwarves:
        drawPixelRect(this.unitGraphics, px + 5, py + 5, 6, 3, lighten(gearColors.cloth, 8));
        drawPixelRect(this.unitGraphics, px + 3, py + 8, 10, 5, tribeColor);
        drawPixelRect(this.unitGraphics, px + 5, py + 11, 6, 3, 0x70452d);
        break;
      case RaceType.Orcs:
        drawPixelRect(this.unitGraphics, px + 5, py + 4, 6, 3, lighten(gearColors.cloth, 4));
        drawPixelRect(this.unitGraphics, px + 3, py + 7, 10, 7, tribeColor);
        drawPixelRect(this.unitGraphics, px + 4, py + 6, 2, 1, 0xf4eed7);
        drawPixelRect(this.unitGraphics, px + 10, py + 6, 2, 1, 0xf4eed7);
        break;
      case RaceType.Goblins:
        drawPixelRect(this.unitGraphics, px + 5, py + 4, 6, 4, lighten(gearColors.cloth, 6));
        drawPixelRect(this.unitGraphics, px + 4, py + 8, 8, 5, tribeColor);
        drawPixelRect(this.unitGraphics, px + 4, py + 3, 1, 2, accent);
        drawPixelRect(this.unitGraphics, px + 11, py + 3, 1, 2, accent);
        break;
      case RaceType.Halflings:
        drawPixelRect(this.unitGraphics, px + 5, py + 6, 6, 3, lighten(gearColors.cloth, 10));
        drawPixelRect(this.unitGraphics, px + 4, py + 9, 8, 4, tribeColor);
        break;
      case RaceType.Nomads:
        drawPixelRect(this.unitGraphics, px + 5, py + 4, 6, 3, gearColors.cloth);
        drawPixelRect(this.unitGraphics, px + 4, py + 7, 8, 7, tribeColor);
        drawPixelRect(this.unitGraphics, px + 3, py + 6, 10, 1, accent);
        break;
      case RaceType.Darkfolk:
        drawPixelRect(this.unitGraphics, px + 5, py + 4, 6, 3, gearColors.cloth);
        drawPixelRect(this.unitGraphics, px + 4, py + 7, 8, 7, tribeColor);
        drawPixelRect(this.unitGraphics, px + 6, py + 3, 4, 1, accent);
        break;
      case RaceType.Humans:
      default:
        drawPixelRect(this.unitGraphics, px + 5, py + 4, 6, 3, lighten(gearColors.cloth, 10));
        drawPixelRect(this.unitGraphics, px + 4, py + 7, 8, 7, tribeColor);
        break;
    }

    drawPixelRect(this.unitGraphics, px + 4, py + 13, 2, 1 + stride, darken(tribeColor, 26));
    drawPixelRect(this.unitGraphics, px + 10, py + 13, 2, 1 + (1 - stride), darken(tribeColor, 26));
    drawPixelRect(this.unitGraphics, px + 6, py + 8, 4, 2, accent, 0.92);

    if (!detail) {
      drawPixelRect(this.unitGraphics, px + 4, py + 7, 8, 6, tribeColor, 0.92);
      if (agent.gear.armor !== "Cloth") {
        drawPixelRect(this.unitGraphics, px + 4, py + 9, 8, 2, gearColors.armor, 0.68);
      }
      return;
    }

    if (agent.role === AgentRole.Soldier || agent.role === AgentRole.Rider) {
      const ranged = agent.gear.weapon.includes("Bow");
      const axeLike = agent.gear.weapon.includes("Axe") || agent.gear.weapon.includes("Cleaver");
      const weaponColor = agent.gear.weapon.includes("Lance") ? lighten(gearColors.weapon, 18) : agent.gear.weapon.includes("Spear") ? gearColors.weapon : darken(gearColors.weapon, 6);
      if (ranged) {
        drawPixelRect(this.unitGraphics, px + 11 + Math.max(0, swing), py + 6, 2, 6, weaponColor, 0.88);
        drawPixelRect(this.unitGraphics, px + 10 + Math.max(0, swing), py + 7, 1, 4, lighten(weaponColor, 18), 0.65);
      } else if (agent.gear.weapon.includes("Arquebus") || agent.gear.weapon.includes("Rifle") || agent.gear.weapon.includes("Spark") || agent.gear.weapon.includes("Carbine") || agent.gear.weapon.includes("Volley") || agent.gear.weapon.includes("Repeater")) {
        drawPixelRect(this.unitGraphics, px + 10 + Math.max(0, swing), py + 8, 4, 2, 0x6f4f36, 0.92);
        drawPixelRect(this.unitGraphics, px + 13 + Math.max(0, swing), py + 7, 2, 1, 0xbfc9d1, 0.9);
      } else if (axeLike) {
        drawPixelRect(this.unitGraphics, px + 12 + swing, py + 7 - Math.abs(swing), 1, 6, 0x7d5a3f, 0.88);
        drawPixelRect(this.unitGraphics, px + 11 + swing, py + 6 - Math.abs(swing), 3, 2, weaponColor, 0.92);
      } else {
        drawPixelRect(this.unitGraphics, px + 12 + swing, py + 6 - Math.abs(swing), 1, 7, weaponColor, 0.88);
      }
      if (race === RaceType.Humans || race === RaceType.Dwarves) {
        drawPixelRect(this.unitGraphics, px + 2, py + 8, 2, 4, shieldColor(race), 0.8);
      }
      if (race === RaceType.Elves) {
        drawPixelRect(this.unitGraphics, px + 12, py + 7, 2, 4, 0x96d6a9, 0.55);
      }
      if (race === RaceType.Orcs) {
        drawPixelRect(this.unitGraphics, px + 12, py + 5, 2, 7, 0x8a5a36, 0.88);
      }
    }
    if (agent.role === AgentRole.Mage) {
      drawPixelRect(this.unitGraphics, px + 12 + swing, py + 5 - Math.abs(swing), 1, 7, 0xa8c8ff, 0.95);
      drawPixelRect(this.unitGraphics, px + 10, py + 3, 2, 2, 0xcbdcff, 0.9);
      drawPixelRect(this.unitGraphics, px + 3, py + 6, 1, 6, 0x8d72d9, 0.6);
      if (agent.gear.weapon.includes("Sunfire") || agent.gear.weapon.includes("Void")) {
        drawPixelRect(this.unitGraphics, px + 11, py + 2, 3, 2, agent.gear.weapon.includes("Void") ? 0xb18cff : 0xf6d38a, 0.9);
        drawPixelRect(this.unitGraphics, px + 2, py + 5, 1, 7, agent.gear.weapon.includes("Void") ? 0x7155c3 : 0xe3a64e, 0.65);
      }
    }
    if (agent.role === AgentRole.Scholar) {
      drawPixelRect(this.unitGraphics, px + 2, py + 6 + Math.max(0, swing), 2, 5, 0xd5b7ec, 0.85);
      drawPixelRect(this.unitGraphics, px + 1, py + 7 + Math.max(0, swing), 3, 3, 0xf4ead2, 0.85);
    }
    if (agent.role === AgentRole.Woodcutter || agent.role === AgentRole.Builder) {
      drawPixelRect(this.unitGraphics, px + 2 + swing, py + 8 - Math.abs(swing), 2, 5, 0xbdc6ce, 0.85);
    }
    if (agent.role === AgentRole.Builder) {
      drawPixelRect(this.unitGraphics, px + 12 + swing, py + 9 - Math.abs(swing), 2, 2, 0xe4bc73, 0.9);
    }
    if (agent.role === AgentRole.Farmer) {
      drawPixelRect(this.unitGraphics, px + 2 + swing, py + 9 - Math.abs(swing), 1, 4, 0x8f6e46, 0.85);
      drawPixelRect(this.unitGraphics, px + 1 + swing, py + 8 - Math.abs(swing), 3, 1, 0xc7d475, 0.85);
    }
    if (agent.role === AgentRole.Hauler) {
      drawPixelRect(this.unitGraphics, px + 2, py + 9, 3, 3, 0xb59269, 0.88);
      drawPixelRect(this.unitGraphics, px + 1 + Math.max(0, swing), py + 8, 1, 5, 0x8d6f52, 0.86);
    }
    if (agent.role === AgentRole.Crafter) {
      drawPixelRect(this.unitGraphics, px + 2 + swing, py + 8 - Math.abs(swing), 2, 4, 0xc98f58, 0.85);
      drawPixelRect(this.unitGraphics, px + 1 + swing, py + 7 - Math.abs(swing), 3, 2, 0xe1b179, 0.8);
    }
    if (agent.role === AgentRole.Fisher) {
      drawPixelRect(this.unitGraphics, px + 12 + swing, py + 7 - Math.abs(swing), 1, 6, 0x8f7650, 0.85);
      drawPixelRect(this.unitGraphics, px + 11 + swing, py + 12 - Math.abs(swing), 3, 1, 0xddeef5, 0.75);
    }
    if (agent.role === AgentRole.Miner) {
      drawPixelRect(this.unitGraphics, px + 12 + swing, py + 7 - Math.abs(swing), 1, 6, 0x8d6f52, 0.85);
      drawPixelRect(this.unitGraphics, px + 11 + swing, py + 6 - Math.abs(swing), 3, 2, 0xbfc8cf, 0.85);
    }
    if (agent.gear.armor !== "Cloth") {
      drawPixelRect(this.unitGraphics, px + 4, py + 9, 8, 2, gearColors.armor, 0.72);
    }
    if (agent.hero) {
      drawPixelRect(this.unitGraphics, px + 1, py + 5, 2, 6, 0xf3d87b, 0.9);
      drawPixelRect(this.unitGraphics, px + 13, py + 5, 2, 6, 0xf3d87b, 0.9);
    }
    if (agent.blessed) {
      drawPixelRect(this.unitGraphics, px + 4, py + 1, 8, 1, 0xf8f2bc, 0.9);
      drawPixelRect(this.unitGraphics, px + 5, py + 0, 6, 1, 0xfff6d8, 0.75);
    }
    if (agent.wounds > 0) {
      drawPixelRect(this.unitGraphics, px + 2, py + 2, 2, 2, 0xbf4f4f, 0.85);
    }
    if (agent.condition === AgentConditionType.Sick || agent.condition === AgentConditionType.Feverish) {
      drawPixelRect(this.unitGraphics, px + 1, py + 12, 2, 2, 0x91d485, 0.9);
      drawPixelRect(this.unitGraphics, px + 13, py + 12, 2, 2, 0x6ca96d, 0.75);
    }
    if (agent.condition === AgentConditionType.Exhausted || agent.condition === AgentConditionType.Weary) {
      drawPixelRect(this.unitGraphics, px + 4, py + 14, 8, 1, 0x7f90a2, 0.75);
    }
    if (agent.condition === AgentConditionType.Inspired) {
      drawPixelRect(this.unitGraphics, px + 7, py + 0, 2, 2, 0xffef9d, 0.95);
      drawPixelRect(this.unitGraphics, px + 6, py + 1, 4, 1, 0xf7d36f, 0.75);
    }
    if (agent.carrying !== ResourceType.None) {
      const carryColor = resourceVisualColor(agent.carrying);
      const carryOffsetY = this.zoom > 1.05 ? -5 : -2;
      const carryX = px + 8 + Math.max(0, swing);
      const carryY = py + carryOffsetY - Math.max(0, Math.abs(swing) - 1);
      drawPixelRect(this.unitGraphics, carryX - 1, carryY + 3, 8, 1, 0x000000, 0.22);
      drawPixelRect(this.unitGraphics, carryX, carryY, 7, 7, carryColor, 0.97);
      drawPixelRect(this.unitGraphics, carryX + 1, carryY - 1, 5, 1, lighten(carryColor, 18), 0.76);
      drawPixelRect(this.unitGraphics, carryX - 1, carryY + 1, 1, 4, darken(carryColor, 18), 0.84);
      if (agent.carryingAmount > 6) {
        drawPixelRect(this.unitGraphics, carryX + 6, carryY + 1, 2, 4, darken(carryColor, 14), 0.88);
      }
      if (agent.carrying === ResourceType.Wood || agent.carrying === ResourceType.Planks) {
        drawPixelRect(this.unitGraphics, carryX - 1, carryY + 7, 9, 1, 0x6b4a2d, 0.9);
        drawPixelRect(this.unitGraphics, carryX, carryY + 8, 7, 1, 0x8d6238, 0.78);
        drawPixelRect(this.unitGraphics, carryX + 1, carryY + 4, 5, 1, 0xd2a26a, 0.66);
      } else if (agent.carrying === ResourceType.Stone || agent.carrying === ResourceType.Clay || agent.carrying === ResourceType.Ore) {
        drawPixelRect(this.unitGraphics, carryX + 1, carryY + 7, 5, 2, 0xd7dde3, 0.76);
        drawPixelRect(this.unitGraphics, carryX + 2, carryY + 8, 3, 1, darken(carryColor, 22), 0.72);
      } else if (agent.carrying === ResourceType.Berries || agent.carrying === ResourceType.Grain || agent.carrying === ResourceType.Fish || agent.carrying === ResourceType.Meat) {
        drawPixelRect(this.unitGraphics, carryX, carryY + 7, 7, 2, 0xf2ddb2, 0.76);
        drawPixelRect(this.unitGraphics, carryX + 1, carryY + 8, 5, 1, agent.carrying === ResourceType.Fish ? 0x9ddff3 : agent.carrying === ResourceType.Meat ? 0xc65e52 : 0xd2b25a, 0.8);
      } else if (agent.carrying === ResourceType.Rations) {
        drawPixelRect(this.unitGraphics, carryX, carryY + 7, 7, 2, 0xd5ba84, 0.84);
        drawPixelRect(this.unitGraphics, carryX + 1, carryY + 8, 5, 1, 0x8d6238, 0.66);
      } else if (agent.carrying === ResourceType.Horses || agent.carrying === ResourceType.Livestock) {
        drawPixelRect(this.unitGraphics, carryX + 1, carryY + 7, 5, 2, 0xc5b48c, 0.82);
        drawPixelRect(this.unitGraphics, carryX + 2, carryY + 6, 3, 1, 0x6b4a2d, 0.7);
      }
    }
    if (this.zoom > 1.18 || this.selectedUnitId === agent.id || agent.hero) {
      drawPixelRect(this.unitGraphics, px + 3, py + 1, 10 * (agent.health / 100), 1, 0x78d67a, 0.9);
      drawPixelRect(this.unitGraphics, px + 3, py + 2, 10, 1, 0x2d3a2e, 0.45);
    }
    if (agent.hero || agent.role === AgentRole.Mage) {
      drawPixelRect(this.unitGraphics, px + 5, py + 0, 6, 1, agent.role === AgentRole.Mage ? 0x97bcff : 0xf0d57e, 0.9);
    }
    if (this.zoom > 1.16 || this.selectedUnitId === agent.id || agent.hero) {
      this.drawTaskIndicator(agent.task, px, py - 3 - taskBob);
      this.drawActionEffect(agent, px, py);
    }
    if (agent.gear.rarity === "Epic" || agent.gear.rarity === "Legendary") {
      drawPixelRect(this.unitGraphics, px + 1, py + 3, 2, 2, 0xf5d36d, 0.95);
    }
  }

  private drawActionEffect(agent: AgentSnapshot, px: number, py: number): void {
    if (agent.task === "idle") return;
    const pulse = ((this.state.tick + agent.id) % 10) / 10;
    const dx = Math.sign(agent.targetX - agent.x);
    const dy = Math.sign(agent.targetY - agent.y);
    const effectX = px + 8 + dx * 5;
    const effectY = py + 8 + dy * 5;
    const flicker = pulse > 0.5 ? 1 : 0;

    if (agent.task === "hunt" || agent.task === "attack" || agent.task === "patrol") {
      if (agent.gear.weapon.includes("Bow")) {
        const color = agent.gear.weapon.includes("Fire") ? 0xff9a53 : 0xe6edf5;
        drawPixelRect(this.unitGraphics, effectX, effectY, 4, 1, color, 0.9);
        drawPixelRect(this.unitGraphics, effectX + 4, effectY, 1, 1, agent.gear.weapon.includes("Fire") ? 0xffd38a : 0xcfd7df, 0.9);
        drawPixelRect(this.unitGraphics, effectX + 1, effectY - 1, 1, 1, lighten(color, 16), 0.72);
      } else if (agent.gear.weapon.includes("Arquebus") || agent.gear.weapon.includes("Rifle") || agent.gear.weapon.includes("Spark") || agent.gear.weapon.includes("Carbine") || agent.gear.weapon.includes("Volley") || agent.gear.weapon.includes("Repeater")) {
        drawPixelRect(this.unitGraphics, effectX, effectY, 2, 2, 0xf3d48f, 0.95);
        drawPixelRect(this.unitGraphics, effectX + 2, effectY, 2, 2, 0xd7dde4, 0.75);
        drawPixelRect(this.unitGraphics, effectX + 3, effectY - 1, 2, 3, 0xc9cfd6, 0.5);
      } else if (agent.role === AgentRole.Mage) {
        const spellColor = agent.gear.weapon.includes("Void") ? 0xc095ff : agent.gear.weapon.includes("Sunfire") ? 0xffbe73 : 0x9bc7ff;
        drawPixelRect(this.unitGraphics, effectX, effectY, 3, 3, spellColor, 0.8);
        drawPixelRect(this.unitGraphics, effectX + 1, effectY + 1, 1, 1, 0xffffff, 0.9);
        if (agent.gear.weapon.includes("Void") || agent.gear.weapon.includes("Sunfire")) {
          drawPixelRect(this.unitGraphics, effectX - 1, effectY + 1, 5, 1, lighten(spellColor, 18), 0.55);
          drawPixelRect(this.unitGraphics, effectX + 1, effectY - 1, 1, 5, lighten(spellColor, 12), 0.45);
        }
      } else {
        drawPixelRect(this.unitGraphics, effectX, effectY, 3, 1, 0xeed8bc, 0.85);
      }
      if (agent.task === "hunt") {
        drawPixelRect(this.unitGraphics, effectX + 1, effectY + 2, 2, 1, 0xbf6a58, 0.72);
      }
      return;
    }
    if (agent.task === "build" || agent.task === "earthwork") {
      drawPixelRect(this.unitGraphics, px + 12, py + 4, 2, 2, 0xffefb1, 0.85);
      drawPixelRect(this.unitGraphics, px + 13, py + 6, 1, 2, 0xe3b76f, 0.85);
      drawPixelRect(this.unitGraphics, px + 10, py + 5 + flicker, 2, 1, 0xf6d68a, 0.76);
      drawPixelRect(this.unitGraphics, px + 11, py + 7 + flicker, 3, 1, 0x8f6d48, 0.68);
      return;
    }
    if (agent.task === "farm") {
      drawPixelRect(this.unitGraphics, effectX, effectY + 1, 4, 1, 0xe3d27a, 0.9);
      drawPixelRect(this.unitGraphics, effectX + 1, effectY - 1, 1, 4, 0x8d6d40, 0.82);
      drawPixelRect(this.unitGraphics, effectX - 1, effectY + 2, 2, 1, 0x97c85b, 0.72);
      drawPixelRect(this.unitGraphics, effectX + 3, effectY + 2, 2, 1, 0x97c85b, 0.72);
      return;
    }
    if (agent.task === "cut_tree") {
      drawPixelRect(this.unitGraphics, effectX, effectY, 2, 2, 0xe1c7a0, 0.85);
      drawPixelRect(this.unitGraphics, effectX + 2, effectY + 1, 1, 2, 0x7d5c40, 0.9);
      drawPixelRect(this.unitGraphics, effectX - 1, effectY + flicker, 1, 1, 0x79b06d, 0.7);
      drawPixelRect(this.unitGraphics, effectX + 3, effectY - 1 + flicker, 1, 1, 0x8ece75, 0.68);
      drawPixelRect(this.unitGraphics, effectX + 1, effectY + 3, 2, 1, 0xc29466, 0.72);
      return;
    }
    if (agent.task === "mine" || agent.task === "quarry") {
      drawPixelRect(this.unitGraphics, effectX, effectY, 2, 2, 0xd6dde4, 0.85);
      drawPixelRect(this.unitGraphics, effectX + 2, effectY + 1, 2, 1, 0xa8b7c6, 0.85);
      drawPixelRect(this.unitGraphics, effectX - 1, effectY + 2, 1, 1, 0xf3f6fa, 0.75);
      drawPixelRect(this.unitGraphics, effectX + 3, effectY - 1, 1, 1, 0xe1a86d, 0.68);
      drawPixelRect(this.unitGraphics, effectX + 1, effectY + 3, 2, 1, 0x6f7e8d, 0.65);
      return;
    }
    if (agent.task === "fish") {
      drawPixelRect(this.unitGraphics, effectX, effectY, 1, 4, 0xb8e7f2, 0.85);
      drawPixelRect(this.unitGraphics, effectX - 1, effectY + 4, 3, 1, 0xf0fbff, 0.75);
      drawPixelRect(this.unitGraphics, effectX + 1, effectY + 2 + flicker, 2, 1, 0xdffaff, 0.76);
      drawPixelRect(this.unitGraphics, effectX - 2, effectY + 5, 5, 1, 0x8acfe2, 0.5);
      return;
    }
    if (agent.task === "craft") {
      const color = agent.role === AgentRole.Scholar ? 0xd7b5f6 : 0xffc474;
      drawPixelRect(this.unitGraphics, px + 12, py + 4, 2, 2, color, 0.8);
      drawPixelRect(this.unitGraphics, px + 10, py + 5, 1, 1, lighten(color, 20), 0.8);
      return;
    }
    if (agent.task === "delve" || agent.task === "dungeon") {
      const glow = agent.task === "delve" ? 0x8db5ff : 0xc58cf1;
      drawPixelRect(this.unitGraphics, px + 12, py + 4, 2, 2, glow, 0.85);
      drawPixelRect(this.unitGraphics, px + 10, py + 5, 1, 1, lighten(glow, 18), 0.9);
      drawPixelRect(this.unitGraphics, px + 11, py + 7, 3, 1, 0x20293d, 0.8);
      return;
    }
    if (agent.task === "recover") {
      drawPixelRect(this.unitGraphics, px + 11, py + 4, 3, 2, 0xf4f7fa, 0.9);
      drawPixelRect(this.unitGraphics, px + 12, py + 3, 1, 4, 0xc84f54, 0.9);
      drawPixelRect(this.unitGraphics, px + 11, py + 4, 3, 1, 0xc84f54, 0.9);
      return;
    }
    if (agent.task === "replant_tree") {
      drawPixelRect(this.unitGraphics, effectX, effectY, 2, 3, 0x7fd26a, 0.9);
      drawPixelRect(this.unitGraphics, effectX - 1, effectY + 1, 1, 1, 0xb0ec91, 0.7);
      drawPixelRect(this.unitGraphics, effectX + 2, effectY + 1, 1, 1, 0xb0ec91, 0.7);
      return;
    }
    if (agent.task === "haul") {
      drawPixelRect(this.unitGraphics, px + 12, py + 9, 2, 2, 0xcda56d, 0.9);
      return;
    }
  }

  private drawTaskIndicator(task: string, px: number, py: number): void {
    if (task === "idle") return;
    let color = 0xffffff;
    if (task === "build") color = 0xe7be68;
    if (task === "hunt" || task === "attack" || task === "patrol") color = 0xde6c62;
    if (task === "farm") color = 0xb9d760;
    if (task === "fish") color = 0x76cee0;
    if (task === "mine" || task === "quarry") color = 0xb0c7d7;
    if (task === "cut_tree" || task === "replant_tree") color = 0x6ac16c;
    if (task === "haul") color = 0xd4b16e;
    if (task === "earthwork") color = 0x8d6c4c;
    if (task === "craft" || task === "dungeon") color = 0xc58cf1;
    if (task === "delve") color = 0x8db5ff;
    if (task === "recover") color = 0xf3f6fa;
    if (task === "attack") {
      drawPixelRect(this.unitGraphics, px + 5, py - 1, 1, 4, 0xf7ead9, 0.85);
      drawPixelRect(this.unitGraphics, px + 10, py - 1, 1, 4, 0xf7ead9, 0.85);
    }
    if (task === "build") {
      drawPixelRect(this.unitGraphics, px + 7, py - 1, 1, 3, 0xfff2bf, 0.9);
    }
    if (task === "farm") {
      drawPixelRect(this.unitGraphics, px + 5, py - 1, 6, 1, 0xcadd72, 0.95);
    }
    if (task === "haul") {
      drawPixelRect(this.unitGraphics, px + 5, py - 1, 6, 1, 0xf4d36c, 0.9);
    }
    if (task === "recover") {
      drawPixelRect(this.unitGraphics, px + 7, py - 2, 1, 4, 0xc84f54, 0.9);
      drawPixelRect(this.unitGraphics, px + 5, py, 5, 1, 0xc84f54, 0.9);
    }
    drawPixelRect(this.unitGraphics, px + 6, py, 4, 2, color, 0.9);
  }

  private labelStyleForAgent(agent: AgentSnapshot): TextStyleOptions {
    return {
      fontFamily: "\"Trebuchet MS\", \"Segoe UI\", sans-serif",
      fontSize: this.selectedUnitId === agent.id ? 11 : 10,
      fontWeight: this.selectedUnitId === agent.id || agent.hero ? "700" : "600",
      fill: agent.hero ? 0xf2df9c : agent.role === AgentRole.Mage ? 0xc4d5ff : 0xf4f8fb,
      stroke: { color: 0x081018, width: 1 },
    };
  }

  private labelStyleKeyForAgent(agent: AgentSnapshot): string {
    return `${this.selectedUnitId === agent.id ? "selected" : "normal"}:${agent.hero ? "hero" : "unit"}:${agent.role}:${agent.blessed ? 1 : 0}`;
  }

  private cachedLabelStyleForAgent(agent: AgentSnapshot): TextStyle {
    const key = this.labelStyleKeyForAgent(agent);
    let style = this.labelStyleCache.get(key);
    if (!style) {
      style = new TextStyle(this.labelStyleForAgent(agent));
      this.labelStyleCache.set(key, style);
    }
    return style;
  }

  private labelSpriteForAgent(agent: AgentSnapshot): Text {
    let sprite = this.labelSprites.get(agent.id);
    if (!sprite) {
      sprite = new Text({
        text: "",
        style: this.cachedLabelStyleForAgent(agent),
      });
      sprite.resolution = 2;
      sprite.eventMode = "none";
      this.labelSprites.set(agent.id, sprite);
      this.labelLayer.addChild(sprite);
    }
    return sprite;
  }

  private drawAgentLabel(agent: AgentSnapshot, tileX: number, tileY: number): void {
    if (!(this.zoom > 1.95 || this.selectedUnitId === agent.id || agent.hero || agent.blessed || agent.gear.rarity === "Legendary")) {
      return;
    }
    const label = agent.title ? `${agent.name} ${agent.title}` : agent.name;
    const text = this.labelSpriteForAgent(agent);
    if (text.text !== label) {
      text.text = label;
    }
    const styleKey = this.labelStyleKeyForAgent(agent);
    if (this.labelStyleKeyByAgentId.get(agent.id) !== styleKey) {
      text.style = this.cachedLabelStyleForAgent(agent);
      this.labelStyleKeyByAgentId.set(agent.id, styleKey);
    }
    text.x = tileX * TILE_SIZE - 1;
    text.y = tileY * TILE_SIZE - 14;
    text.visible = true;
  }

  private gearRarityClass(rarity: string): string {
    return `gear-slot--${rarity.toLowerCase()}`;
  }

  private gearSlotMarkup(label: string, icon: string, item: string, power: number, rarity: string): string {
    return `
      <div class="gear-slot ${this.gearRarityClass(rarity)}" title="${item} | Power ${power} | ${rarity}">
        <span class="gear-slot__icon">${icon}</span>
        <span class="gear-slot__label">${label}</span>
        <span class="gear-slot__name">${item}</span>
      </div>
    `;
  }

  private selectedUnitGearMarkup(agent: AgentSnapshot): string {
    return `
      <div class="gear-panel">
        ${this.gearSlotMarkup("Weapon", "W", agent.gear.weapon, agent.gear.power, agent.gear.rarity)}
        ${this.gearSlotMarkup("Armor", "A", agent.gear.armor, agent.gear.power, agent.gear.rarity)}
        ${this.gearSlotMarkup("Trinket", "T", agent.gear.trinket, agent.gear.power, agent.gear.rarity)}
      </div>
    `;
  }

  private combatObjectiveLabel(objectiveType: AgentSnapshot["combatObjectiveType"] | SiegeEngineSnapshot["objectiveType"]): string {
    return objectiveType === "siege" ? "Siege"
      : objectiveType === "raid" ? "Raid"
      : objectiveType === "patrol" ? "Patrol"
      : "None";
  }

  private combatLineLabel(line: AgentSnapshot["combatLine"]): string {
    return line === "front" ? "Front"
      : line === "rear" ? "Rear"
      : line === "flank" ? "Flank"
      : "None";
  }

  private updateHud(force = true): void {
    const now = performance.now();
    if (!force && !this.hudDirty) {
      return;
    }
    if (!force && now - this.lastHudRenderAt < 90) {
      this.hudDirty = true;
      return;
    }
    this.hudDirty = false;
    this.lastHudRenderAt = now;
    const totalPopulation = this.state.tribes.reduce((sum, tribe) => sum + tribe.population, 0);
    const totalBoats = this.state.tribes.reduce((sum, tribe) => sum + (tribe.boats ?? 0), 0);
    const totalWagons = this.state.tribes.reduce((sum, tribe) => sum + (tribe.wagons ?? 0), 0);
    const totalCaravans = this.state.caravans.length;
    const totalHorses = this.state.tribes.reduce((sum, tribe) => sum + (tribe.horses ?? 0), 0);
    const totalHeroes = this.state.tribes.reduce((sum, tribe) => sum + (tribe.heroes ?? 0), 0);
    const totalDelves = this.state.tribes.reduce((sum, tribe) => sum + (tribe.delves ?? 0), 0);
    const totalWater = this.state.tribes.reduce((sum, tribe) => sum + (tribe.water ?? 0), 0);
    const totalSick = this.state.tribes.reduce((sum, tribe) => sum + (tribe.sick ?? 0), 0);
    const totalExhausted = this.state.tribes.reduce((sum, tribe) => sum + (tribe.exhausted ?? 0), 0);
    const totalInspired = this.state.tribes.reduce((sum, tribe) => sum + (tribe.inspired ?? 0), 0);
    const totalFlooded = this.state.tribes.reduce((sum, tribe) => sum + (tribe.flooded ?? 0), 0);
    const totalUnderground = this.state.tribes.reduce((sum, tribe) => sum + (tribe.undergroundTiles ?? 0), 0);
    const totalWaterworks = this.state.tribes.reduce((sum, tribe) => sum + (tribe.waterworks ?? 0), 0);
    const totalPowerPlants = this.state.tribes.reduce((sum, tribe) => sum + (tribe.powerPlants ?? 0), 0);
    const totalAirfields = this.state.tribes.reduce((sum, tribe) => sum + (tribe.airfields ?? 0), 0);
    const totalBranches = this.state.tribes.reduce((sum, tribe) => sum + (tribe.branches ?? 0), 0);
    const totalBranchImports = this.state.tribes.reduce((sum, tribe) => sum + (tribe.branchImports ?? 0), 0);
    const totalStrainedBranches = this.state.tribes.reduce((sum, tribe) => sum + (tribe.strainedBranches ?? 0), 0);
    const totalTradePacts = this.state.tribes.reduce((sum, tribe) => sum + (tribe.tradePartners ?? 0), 0) / 2;
    const activeWars = this.state.tribes.flatMap((tribe) => tribe.diplomacy).filter((entry) => entry >= 4).length;
    const tribeById = new Map(this.state.tribes.map((tribe) => [tribe.id, tribe]));
    const selectedTribe = (this.selectedTribeId !== null ? tribeById.get(this.selectedTribeId) : undefined) ?? this.state.tribes[0];
    const selectedUnit = this.state.agents.find((agent) => agent.id === this.selectedUnitId)
      ?? (this.selection ? this.state.agents.find((agent) => Math.round(agent.x) === this.selection!.x && Math.round(agent.y) === this.selection!.y) : undefined);
    const tributeOverlord = selectedTribe?.tributeTo !== null && selectedTribe?.tributeTo !== undefined
      ? tribeById.get(selectedTribe.tributeTo)
      : null;
    const alliedNames = selectedTribe
      ? this.state.tribes
          .filter((tribe) => tribe.id !== selectedTribe.id && selectedTribe.diplomacy[tribe.id] === 0)
          .map((tribe) => tribe.name)
      : [];
    const tradeNames = selectedTribe
      ? this.state.tribes
          .filter((tribe) => tribe.id !== selectedTribe.id)
          .filter((tribe) =>
            this.state.caravans.some((caravan) =>
              (caravan.tribeId === selectedTribe.id && caravan.partnerTribeId === tribe.id) ||
              (caravan.partnerTribeId === selectedTribe.id && caravan.tribeId === tribe.id),
            ),
          )
          .map((tribe) => tribe.name)
      : [];
    const selectedUnitTargetTribe = selectedUnit?.combatTargetTribeId !== null && selectedUnit?.combatTargetTribeId !== undefined
      ? tribeById.get(selectedUnit.combatTargetTribeId)
      : null;
    const selectedBranches = selectedTribe ? this.state.branches.filter((branch) => branch.tribeId === selectedTribe.id) : [];
    const topStrainedBranches = [...this.state.branches]
      .filter((branch) => branch.strained)
      .sort((a, b) => (b.importLoad + b.productiveSites * 2) - (a.importLoad + a.productiveSites * 2))
      .slice(0, 4);

    const statsMarkup = [
      this.statMarkup("Year", `${this.state.year}`),
      this.statMarkup("Season", SEASON_NAMES[this.state.season] ?? "Unknown"),
      this.statMarkup("View", this.viewMode === "surface" ? "Surface" : "Underground"),
      this.statMarkup("Tribes", `${this.state.tribes.length}`),
      this.statMarkup("Population", `${totalPopulation}`),
      this.statMarkup("Boats", `${totalBoats}`),
      this.statMarkup("Wagons", `${totalWagons}`),
      this.statMarkup("Caravans", `${totalCaravans}`),
      this.statMarkup("Horses", `${totalHorses}`),
      this.statMarkup("Heroes", `${totalHeroes}`),
      this.statMarkup("Delves", `${totalDelves}`),
      this.statMarkup("Tunnels", `${totalUnderground}`),
      this.statMarkup("Waterworks", `${totalWaterworks}`),
      this.statMarkup("Power", `${totalPowerPlants}`),
      this.statMarkup("Airfields", `${totalAirfields}`),
      this.statMarkup("Branches", `${totalBranches}`),
      this.statMarkup("Branch Imports", `${totalBranchImports}`),
      this.statMarkup("Trade Pacts", `${Math.floor(totalTradePacts)}`),
      this.statMarkup("Water", `${totalWater}`),
      this.statMarkup("Flooded", `${totalFlooded}`),
      this.statMarkup("Sick", `${totalSick}`),
      this.statMarkup("Inspired", `${totalInspired}`),
      this.statMarkup("Animals", `${this.state.animals.length}`),
      this.statMarkup("Wars/Hostility", `${activeWars}`),
      this.statMarkup("Speed", this.paused ? "Paused" : `${this.simSpeed}x`),
      this.statMarkup("Tick", `${this.state.tick}`),
    ].join("");
    const topbarMarkup = `
      <div class="topbar__controls">
        <button class="topbar__toggle ${this.viewMode === "surface" ? "is-active" : ""}" data-view-mode="surface">Surface</button>
        <button class="topbar__toggle ${this.viewMode === "underground" ? "is-active" : ""}" data-view-mode="underground">Underground</button>
        <button class="topbar__toggle ${this.paused ? "is-active" : ""}" data-toggle-pause="1">${this.paused ? "Resume" : "Pause"}</button>
        <button class="topbar__toggle ${this.simSpeed === 1 ? "is-active" : ""}" data-speed="1">1x</button>
        <button class="topbar__toggle ${this.simSpeed === 2 ? "is-active" : ""}" data-speed="2">2x</button>
        <button class="topbar__toggle ${this.simSpeed === 4 ? "is-active" : ""}" data-speed="4">4x</button>
        <button class="topbar__toggle ${this.simSpeed === 8 ? "is-active" : ""}" data-speed="8">8x</button>
        <button class="topbar__toggle" data-jump-event="1">Latest Event</button>
        <button class="topbar__toggle ${this.renderFilters.armies ? "is-active" : ""}" data-filter-key="armies">Armies</button>
        <button class="topbar__toggle ${this.renderFilters.trade ? "is-active" : ""}" data-filter-key="trade">Trade</button>
        <button class="topbar__toggle ${this.renderFilters.weather ? "is-active" : ""}" data-filter-key="weather">Weather</button>
        <button class="topbar__toggle ${this.renderFilters.underground ? "is-active" : ""}" data-filter-key="underground">Underground</button>
        <button class="topbar__toggle ${this.renderFilters.creatures ? "is-active" : ""}" data-filter-key="creatures">Creatures</button>
      </div>
      <div class="topbar__stats">${statsMarkup}</div>
    `;
    if (topbarMarkup !== this.lastTopbarMarkup) {
      this.topbar.innerHTML = topbarMarkup;
      this.lastTopbarMarkup = topbarMarkup;
    }

    const selectedTileHtml = this.selection && this.state.world && this.state.terrain && this.state.elevation && this.state.biome && this.state.feature && this.state.surfaceWater && this.state.undergroundTerrain && this.state.undergroundFeature && this.state.undergroundResourceType && this.state.undergroundResourceAmount && this.state.owner && this.state.resourceAmount
      ? this.selectedTileMarkup()
      : "<p>No tile selected.</p>";

    const sortedTribes = this.state.tribes.slice().sort((a, b) => b.population - a.population);
    const compareTribe = this.compareTribeId !== null ? tribeById.get(this.compareTribeId) : null;
    const tribesHtml = sortedTribes
      .map(
        (tribe) => `
          <li>
            <div class="tribe-row-wrap">
              <button class="tribe-row ${this.selectedTribeId === tribe.id ? "is-active" : ""}" data-tribe-id="${tribe.id}">
                <span class="tribe-dot" style="background:#${tribe.color.toString(16).padStart(6, "0")}"></span>
                <span>${RACE_NAMES[tribe.race]} ${tribe.name.split(" ").slice(-1)[0]} | ${tribe.doctrine} | ${AGE_NAMES[tribe.age as AgeType]} | Pop ${tribe.population} | Food ${tribe.food} | ${tribe.shortage}</span>
              </button>
              <button class="tribe-compare ${this.compareTribeId === tribe.id ? "is-active" : ""}" data-compare-tribe-id="${tribe.id}">Compare</button>
            </div>
          </li>`,
      )
      .join("");

    const dominant = sortedTribes[0];
    const filteredEvents = this.state.events.filter((event) => this.eventKindFilter === "all" || event.kind === this.eventKindFilter);
    const eventsHtml = filteredEvents.slice(0, 20).map((event) => `
      <li>
        <button class="event-row" data-event-index="${this.state.events.indexOf(event)}">
          <span class="event-title">${event.title}</span>
          <span class="event-desc">${event.description}</span>
        </button>
      </li>
    `).join("");
    const worldPanel = `
      <section class="panel">
        <h2>World</h2>
        <div class="kv">
          <strong>Season</strong><span>${SEASON_NAMES[this.state.season]}</span>
          <strong>Population</strong><span>${totalPopulation}</span>
          <strong>Boats</strong><span>${totalBoats}</span>
          <strong>Wagons</strong><span>${totalWagons}</span>
          <strong>Caravans</strong><span>${totalCaravans}</span>
          <strong>Horses</strong><span>${totalHorses}</span>
          <strong>Stored Water</strong><span>${totalWater}</span>
          <strong>Waterworks</strong><span>${totalWaterworks}</span>
          <strong>Power Plants</strong><span>${totalPowerPlants}</span>
          <strong>Airfields</strong><span>${totalAirfields}</span>
          <strong>Branches</strong><span>${totalBranches}</span>
          <strong>Branch Imports</strong><span>${totalBranchImports}</span>
          <strong>Strained Branches</strong><span>${totalStrainedBranches}</span>
          <strong>Trade Pacts</strong><span>${Math.floor(totalTradePacts)}</span>
          <strong>Flooded</strong><span>${totalFlooded}</span>
          <strong>Tunnels</strong><span>${totalUnderground}</span>
          <strong>Sick</strong><span>${totalSick}</span>
          <strong>Exhausted</strong><span>${totalExhausted}</span>
          <strong>Inspired</strong><span>${totalInspired}</span>
          <strong>Heroes</strong><span>${totalHeroes}</span>
          <strong>Legendary Creatures</strong><span>${this.state.creatures.length}</span>
          <strong>Weather Fronts</strong><span>${this.state.weather.length}</span>
          <strong>Map View</strong><span>${this.viewMode === "surface" ? "Surface" : "Underground"}</span>
          <strong>Wars/Hostility</strong><span>${activeWars}</span>
        </div>
      </section>`;
    const inspectPanel = `
      <section class="panel">
        <h2>Selected Tile</h2>
        ${selectedTileHtml}
      </section>
      ${selectedUnit ? `<section class="panel">
        <h2>Selected Unit</h2>
          ${this.selectedUnitGearMarkup(selectedUnit)}
          <div class="kv">
            <strong>Name</strong><span>${selectedUnit.name}</span>
            <strong>Title</strong><span>${selectedUnit.title || "None"}</span>
            <strong>Blessed</strong><span>${selectedUnit.blessed ? "Yes" : "No"}</span>
            <strong>Age</strong><span>${selectedUnit.ageYears}</span>
            <strong>Role</strong><span>${AgentRole[selectedUnit.role]}</span>
            <strong>Condition</strong><span>${CONDITION_NAMES[selectedUnit.condition]}</span>
            <strong>Task</strong><span>${selectedUnit.task}</span>
            <strong>Status</strong><span>${selectedUnit.status}</span>
            <strong>Follow</strong><span>${this.followSelectedUnit ? "On" : "Off"}</span>
            <strong>Health</strong><span>${selectedUnit.health}</span>
            <strong>Fatigue</strong><span>${selectedUnit.fatigue}</span>
            <strong>Sickness</strong><span>${selectedUnit.sickness}</span>
            <strong>Spirit</strong><span>${selectedUnit.inspiration}</span>
            <strong>Level</strong><span>${selectedUnit.level}</span>
            <strong>Kills</strong><span>${selectedUnit.kills}</span>
            <strong>Wounds</strong><span>${selectedUnit.wounds}</span>
            <strong>Layer</strong><span>${selectedUnit.underground ? "Underground" : "Surface"}</span>
            <strong>House</strong><span>House ${selectedUnit.houseId}</span>
            <strong>Carrying</strong><span>${selectedUnit.carrying === ResourceType.None ? "Nothing" : `${ResourceType[selectedUnit.carrying]} x${selectedUnit.carryingAmount}`}</span>
            <strong>Power</strong><span>${selectedUnit.gear.power}</span>
            <strong>Rarity</strong><span>${selectedUnit.gear.rarity}</span>
            ${selectedUnit.combatLine ? `<strong>Combat Line</strong><span>${this.combatLineLabel(selectedUnit.combatLine)}</span>` : ""}
            ${(selectedUnit.combatObjectiveType ?? null) ? `<strong>Objective</strong><span>${this.combatObjectiveLabel(selectedUnit.combatObjectiveType)}</span>` : ""}
            ${selectedUnitTargetTribe ? `<strong>Enemy Tribe</strong><span>${selectedUnitTargetTribe.name}</span>` : ""}
            ${selectedUnit.preferredRange !== undefined ? `<strong>Preferred Range</strong><span>${selectedUnit.preferredRange}</span>` : ""}
            ${selectedUnit.fallbackX !== undefined && selectedUnit.fallbackY !== undefined ? `<strong>Fallback Rally</strong><span>${selectedUnit.fallbackX}, ${selectedUnit.fallbackY}</span>` : ""}
            ${selectedUnit.routed ? `<strong>Routing</strong><span>Yes</span>` : ""}
          </div>
      </section>` : ""}`;
    const tribesPanel = `
      <section class="panel">
        <h2>Selected Tribe</h2>
        ${selectedTribe ? `<div class="kv">
          <strong>Name</strong><span>${selectedTribe.name}</span>
          <strong>Race</strong><span>${RACE_NAMES[selectedTribe.race]}</span>
          <strong>Ruler</strong><span>${selectedTribe.rulerName}</span>
          <strong>Crown</strong><span>${selectedTribe.rulerTitle}</span>
          <strong>Successions</strong><span>${selectedTribe.successionCount}</span>
          <strong>Tech Age</strong><span>${AGE_NAMES[selectedTribe.age]}</span>
          <strong>Doctrine</strong><span>${selectedTribe.doctrine}</span>
          <strong>Legitimacy</strong><span>${selectedTribe.legitimacy}</span>
          <strong>Claimant</strong><span>${selectedTribe.claimant}</span>
          <strong>Sect</strong><span>${selectedTribe.sect}</span>
          <strong>Sect Tension</strong><span>${selectedTribe.sectTension}</span>
          <strong>Separatism</strong><span>${selectedTribe.separatism}</span>
          <strong>Weather</strong><span>${WEATHER_NAMES[selectedTribe.weather]}</span>
          <strong>Activity</strong><span>${selectedTribe.activity}</span>
          <strong>Shortage</strong><span>${selectedTribe.shortage}</span>
          <strong>Export Focus</strong><span>${selectedTribe.exportFocus}</span>
          <strong>Food</strong><span>${selectedTribe.food}</span>
          <strong>Wood</strong><span>${selectedTribe.wood}</span>
          <strong>Stone</strong><span>${selectedTribe.stone}</span>
          <strong>Ore</strong><span>${selectedTribe.ore}</span>
          <strong>Faith</strong><span>${selectedTribe.faith}</span>
          <strong>Water</strong><span>${selectedTribe.water}</span>
          <strong>Flooded</strong><span>${selectedTribe.flooded}</span>
          <strong>Power Plants</strong><span>${selectedTribe.powerPlants}</span>
          <strong>Airfields</strong><span>${selectedTribe.airfields}</span>
          <strong>Haul Jobs</strong><span>${selectedTribe.haulJobs}</span>
          <strong>Wagons</strong><span>${selectedTribe.wagons}</span>
          <strong>Branches</strong><span>${selectedTribe.branches}</span>
          <strong>Strained Branches</strong><span>${selectedTribe.strainedBranches}</span>
          <strong>Branch Imports</strong><span>${selectedTribe.branchImports}</span>
          <strong>Branch Exports</strong><span>${selectedTribe.branchExports}</span>
          <strong>Defiant Branches</strong><span>${selectedTribe.defiantBranches}</span>
          <strong>Attacking</strong><span>${selectedTribe.attacking}</span>
          <strong>Patrolling</strong><span>${selectedTribe.patrolling}</span>
          <strong>Retreating</strong><span>${selectedTribe.retreating}</span>
          <strong>Siege Marching</strong><span>${selectedTribe.siegeMarching}</span>
          <strong>Siege Bombarding</strong><span>${selectedTribe.siegeBombarding}</span>
          <strong>Livestock</strong><span>${selectedTribe.livestock}</span>
          <strong>Waterworks</strong><span>${selectedTribe.waterworks}</span>
          <strong>Contacts</strong><span>${selectedTribe.contacts}</span>
          <strong>Allies</strong><span>${selectedTribe.allies}</span>
          <strong>Trade Pacts</strong><span>${selectedTribe.tradePartners}</span>
          <strong>Tributaries</strong><span>${selectedTribe.tributaries}</span>
          <strong>Tribute To</strong><span>${tributeOverlord?.name ?? "None"}</span>
          <strong>Delves</strong><span>${selectedTribe.delves}</span>
          <strong>Tunnels</strong><span>${selectedTribe.undergroundTiles}</span>
          <strong>Siege</strong><span>${selectedTribe.siege}</span>
          <strong>Magic</strong><span>${selectedTribe.magic}</span>
          <strong>Army Power</strong><span>${selectedTribe.armyPower}</span>
          <strong>Morale</strong><span>${selectedTribe.morale}</span>
          <strong>Research</strong><span>${selectedTribe.research}</span>
          <strong>Sick</strong><span>${selectedTribe.sick}</span>
          <strong>Exhausted</strong><span>${selectedTribe.exhausted}</span>
          <strong>Inspired</strong><span>${selectedTribe.inspired}</span>
          <strong>Soldiers</strong><span>${selectedTribe.soldiers}</span>
          <strong>Heroes</strong><span>${selectedTribe.heroes}</span>
          <strong>Wounded</strong><span>${selectedTribe.wounded}</span>
          <strong>Builders</strong><span>${selectedTribe.builders}</span>
          <strong>Farmers</strong><span>${selectedTribe.farmers}</span>
          <strong>Fishers</strong><span>${selectedTribe.fishers}</span>
          <strong>Miners</strong><span>${selectedTribe.miners}</span>
          <strong>Crafters</strong><span>${selectedTribe.crafters}</span>
          <strong>Scholars</strong><span>${selectedTribe.scholars}</span>
          <strong>Enemies</strong><span>${selectedTribe.enemyCount}</span>
        </div>
        <h3>Relations</h3>
        <div class="chip-list">${alliedNames.slice(0, 6).map((name) => `<span class="chip">${name}</span>`).join("") || "<span class='chip'>No formal allies</span>"}${tradeNames.slice(0, 6).map((name) => `<span class="chip chip--trade">${name}</span>`).join("")}</div>
        <h3>Branches</h3>
        <ul class="tribe-list">${selectedBranches.length > 0 ? selectedBranches.map((branch) => `
          <li>
            <button class="tribe-row ${branch.strained || branch.defiant ? "is-active" : ""}" data-branch-hall-id="${branch.hallId}">
              <span>${branch.name} | M${branch.maturity} | ${branch.shortage}</span>
              <span>Food ${branch.food} | Wood ${branch.wood} | Stone ${branch.stone} | In ${branch.importLoad} | Out ${branch.exportLoad} | Sep ${branch.separatism}${branch.defiant ? " | Defiant" : ""}</span>
            </button>
          </li>
        `).join("") : "<li><span class='event-title'>No branch halls yet.</span></li>"}</ul>
        <h3>Unlocked Tech</h3>
        <div class="chip-list">${selectedTribe.techs.map((tech) => `<span class="chip">${tech}</span>`).join("")}</div>` : "<p>No tribe selected.</p>"}
      </section>
      <section class="panel">
        <h2>Tribes</h2>
        ${selectedTribe && compareTribe && selectedTribe.id !== compareTribe.id ? `<div class="compare-grid">
          <div class="compare-card">
            <h3>${selectedTribe.name}</h3>
            <div class="kv">
              <strong>Pop</strong><span>${selectedTribe.population}</span>
              <strong>Food</strong><span>${selectedTribe.food}</span>
              <strong>Water</strong><span>${selectedTribe.water}</span>
              <strong>Army</strong><span>${selectedTribe.armyPower}</span>
              <strong>Research</strong><span>${selectedTribe.research}</span>
              <strong>Morale</strong><span>${selectedTribe.morale}</span>
            </div>
          </div>
          <div class="compare-card">
            <h3>${compareTribe.name}</h3>
            <div class="kv">
              <strong>Pop</strong><span>${compareTribe.population}</span>
              <strong>Food</strong><span>${compareTribe.food}</span>
              <strong>Water</strong><span>${compareTribe.water}</span>
              <strong>Army</strong><span>${compareTribe.armyPower}</span>
              <strong>Research</strong><span>${compareTribe.research}</span>
              <strong>Morale</strong><span>${compareTribe.morale}</span>
            </div>
          </div>
        </div>` : ""}
        <ul class="tribe-list">${tribesHtml}</ul>
      </section>`;
    const eventsPanel = `
      <section class="panel">
        <h2>Recent Events</h2>
        <div class="chip-list">
          ${["all", "construction", "battle", "weather", "tribute", "creature", "delve"].map((kind) => `<button class="chip ${this.eventKindFilter === kind ? "chip--active" : ""}" data-event-filter="${kind}">${kind}</button>`).join("")}
        </div>
        <ul class="event-list">${eventsHtml || "<li><span class='event-title'>No major events yet.</span></li>"}</ul>
      </section>
      <section class="panel">
        <h2>Dungeons</h2>
        <div class="kv">
          <strong>Known Sites</strong><span>${this.state.dungeons.length}</span>
          <strong>Explored</strong><span>${this.state.dungeons.filter((site) => site.exploredBy !== null).length}</span>
        </div>
      </section>
      <section class="panel">
        <h2>Current Lead</h2>
        ${dominant ? `<div class="kv">
          <strong>Name</strong><span>${dominant.name}</span>
          <strong>Ruler</strong><span>${dominant.rulerName}</span>
          <strong>Crown</strong><span>${dominant.rulerTitle}</span>
          <strong>Tech</strong><span>${AGE_NAMES[dominant.age]}</span>
          <strong>Population</strong><span>${dominant.population}</span>
          <strong>Food</strong><span>${dominant.food}</span>
          <strong>Water</strong><span>${dominant.water}</span>
          <strong>Waterworks</strong><span>${dominant.waterworks}</span>
          <strong>Power Plants</strong><span>${dominant.powerPlants}</span>
          <strong>Airfields</strong><span>${dominant.airfields}</span>
          <strong>Branches</strong><span>${dominant.branches}</span>
          <strong>Strained Branches</strong><span>${dominant.strainedBranches}</span>
          <strong>Branch Imports</strong><span>${dominant.branchImports}</span>
          <strong>Trade Pacts</strong><span>${dominant.tradePartners}</span>
          <strong>Shortage</strong><span>${dominant.shortage}</span>
          <strong>Export Focus</strong><span>${dominant.exportFocus}</span>
          <strong>Flooded</strong><span>${dominant.flooded}</span>
          <strong>Tunnels</strong><span>${dominant.undergroundTiles}</span>
          <strong>Sick</strong><span>${dominant.sick}</span>
          <strong>Inspired</strong><span>${dominant.inspired}</span>
          <strong>Morale</strong><span>${dominant.morale}</span>
          <strong>Boats</strong><span>${dominant.boats}</span>
          <strong>Wagons</strong><span>${dominant.wagons}</span>
          <strong>Haul Jobs</strong><span>${dominant.haulJobs}</span>
          <strong>Horses</strong><span>${dominant.horses}</span>
        </div>
        <h3>Strained Branches</h3>
        <ul class="event-list">${topStrainedBranches.length > 0 ? topStrainedBranches.map((branch) => `
          <li>
            <button class="event-row" data-branch-hall-id="${branch.hallId}">
              <span class="event-title">${branch.name}</span>
              <span class="event-desc">${branch.shortage} | Food ${branch.food} | Wood ${branch.wood} | Stone ${branch.stone} | In ${branch.importLoad} | Out ${branch.exportLoad}</span>
            </button>
          </li>
        `).join("") : "<li><span class='event-title'>No strained branches right now.</span></li>"}</ul>` : "<p>Waiting for sim data.</p>"}
      </section>`;
    const legendsPanel = `
      <section class="panel">
        <h2>Chronicle</h2>
        <div class="kv">
          <strong>Total Events</strong><span>${this.state.events.length}</span>
          <strong>Latest Lead</strong><span>${dominant?.name ?? "None"}</span>
          <strong>Known Dungeons</strong><span>${this.state.dungeons.length}</span>
          <strong>Creatures</strong><span>${this.state.creatures.length}</span>
        </div>
        <ul class="event-list">${this.state.events.slice(0, 40).map((event) => `
          <li>
            <button class="event-row" data-event-index="${this.state.events.indexOf(event)}">
              <span class="event-title">Y${Math.floor(event.tick / 32)} ${event.title}</span>
              <span class="event-desc">${event.description}</span>
            </button>
          </li>`).join("") || "<li><span class='event-title'>History will accumulate here.</span></li>"}</ul>
      </section>`;
    const bodyMarkup = this.sidebarTab === "inspect"
      ? `${inspectPanel}${worldPanel}`
      : this.sidebarTab === "tribes"
        ? tribesPanel
        : this.sidebarTab === "events"
          ? `${eventsPanel}${worldPanel}`
          : this.sidebarTab === "legends"
            ? `${legendsPanel}${worldPanel}`
          : `${worldPanel}${tribesPanel}`;
    this.sidebarScrollTopByTab[this.renderedSidebarTab] = this.sidebarBody.scrollTop;
    const sidebarTabsMarkup = `
      <button class="sidebar__tab ${this.sidebarTab === "inspect" ? "is-active" : ""}" data-tab="inspect">Inspect</button>
      <button class="sidebar__tab ${this.sidebarTab === "tribes" ? "is-active" : ""}" data-tab="tribes">Tribes</button>
      <button class="sidebar__tab ${this.sidebarTab === "events" ? "is-active" : ""}" data-tab="events">Events</button>
      <button class="sidebar__tab ${this.sidebarTab === "legends" ? "is-active" : ""}" data-tab="legends">Legends</button>
      <button class="sidebar__tab ${this.sidebarTab === "world" ? "is-active" : ""}" data-tab="world">World</button>
    `;
    if (sidebarTabsMarkup !== this.lastSidebarTabsMarkup) {
      this.sidebarTabs.innerHTML = sidebarTabsMarkup;
      this.lastSidebarTabsMarkup = sidebarTabsMarkup;
    }
    if (bodyMarkup !== this.lastSidebarBodyMarkup) {
      const preservedScroll = this.sidebarTab === this.renderedSidebarTab
        ? this.sidebarBody.scrollTop
        : (this.sidebarScrollTopByTab[this.sidebarTab] ?? 0);
      this.sidebarBody.innerHTML = bodyMarkup;
      this.lastSidebarBodyMarkup = bodyMarkup;
      this.renderedSidebarTab = this.sidebarTab;
      requestAnimationFrame(() => {
        this.sidebarBody.scrollTop = preservedScroll;
      });
    }
  }

  private statMarkup(label: string, value: string): string {
    return `
      <div class="topbar__stat">
        <span class="topbar__label">${label}</span>
        <span class="topbar__value">${value}</span>
      </div>`;
  }

  private selectedTileMarkup(): string {
    const world = this.state.world!;
    const terrain = this.state.terrain!;
    const elevation = this.state.elevation!;
    const biome = this.state.biome!;
    const feature = this.state.feature!;
    const surfaceWater = this.state.surfaceWater!;
    const undergroundTerrain = this.state.undergroundTerrain!;
    const undergroundFeature = this.state.undergroundFeature!;
    const undergroundResourceType = this.state.undergroundResourceType!;
    const undergroundResourceAmount = this.state.undergroundResourceAmount!;
    const owner = this.state.owner!;
    const resourceAmount = this.state.resourceAmount!;
    const resourceType = this.state.resourceType!;
    const selection = this.selection!;
    const index = indexOf(selection.x, selection.y, world.width);
    const tribe = this.state.tribes.find((entry) => entry.id === owner[index]);
    const building = this.state.buildings.find((entry) => selection.x >= entry.x && selection.x < entry.x + entry.width && selection.y >= entry.y && selection.y < entry.y + entry.height);
    const boat = this.state.boats.find((entry) => Math.floor(entry.x) === selection.x && Math.floor(entry.y) === selection.y);
    const creature = this.state.creatures.find((entry) => entry.x === selection.x && entry.y === selection.y);
    const weather = this.state.weather.find((entry) => Math.hypot(entry.x - selection.x, entry.y - selection.y) <= entry.radius);
    const dungeon = this.state.dungeons.find((entry) => entry.x === selection.x && entry.y === selection.y);
    return `
      <p>X ${selection.x}, Y ${selection.y}</p>
      <p>Terrain: ${TERRAIN_NAMES[terrain[index] as TerrainType]}</p>
      <p>Elevation: ${elevation[index]}</p>
      <p>Biome: ${BIOME_NAMES[biome[index] as BiomeType]}</p>
      <p>Feature: ${FEATURE_NAMES[feature[index] as FeatureType]}</p>
      <p>Surface Water: ${surfaceWater[index]}</p>
      <p>Fertility: ${this.state.fertility?.[index] ?? 0}</p>
      <p>Moisture: ${this.state.moisture?.[index] ?? 0}</p>
      <p>Temperature: ${this.state.temperature?.[index] ?? 0}</p>
      <p>Subsurface: ${UNDERGROUND_TERRAIN_NAMES[undergroundTerrain[index] as UndergroundTerrainType]}</p>
      <p>Under Feature: ${UNDERGROUND_FEATURE_NAMES[undergroundFeature[index] as UndergroundFeatureType]}</p>
      <p>Under Resource: ${undergroundResourceType[index] === 0 ? "None" : `${ResourceType[undergroundResourceType[index] as ResourceType]} (${undergroundResourceAmount[index]})`}</p>
      <p>Owner: ${tribe ? `${RACE_NAMES[tribe.race as RaceType]} ${tribe.name}` : "Wilderness"}</p>
      <p>Weather: ${weather ? WEATHER_NAMES[weather.kind] : "Clear"}</p>
      <p>Resource: ${resourceType[index] === 0 ? "None" : `${ResourceType[resourceType[index] as ResourceType]} (${resourceAmount[index]})`}</p>
      <p>Building: ${building ? BUILDING_NAMES[building.type as BuildingType] : "None"}</p>
      <p>Boat: ${boat ? `Tribe ${boat.tribeId} ${BoatTaskType[boat.task]}` : "None"}</p>
      <p>Legend: ${creature ? `${creature.name} (${LegendaryCreatureType[creature.type]})` : "None"}</p>
      <p>Dungeon: ${dungeon ? `${dungeon.name} (${DUNGEON_NAMES[dungeon.type]})` : "None"}</p>
    `;
  }
}
