# Tribe Sim Web Game Spec

## 1. Product Goal

Build a performant browser game: a 2D top-down, tile-based tribe simulation with visible agents, sprites, tilesets, multiple biomes, zoomable camera, large maps, autonomous settlement growth, resource chains, warfare, and diplomacy between multiple tribes.

The long-term target is a "living world" where several tribes expand, specialize, discover technology, build infrastructure, and interact through trade, conflict, and alliances.

This should be treated as a staged simulation project, not a single-pass implementation. The full vision is large enough to require progressive milestones.

## 2. Core Design Principle

Separate the game into two layers:

1. Simulation layer
   Runs deterministic world logic, agent AI, economy, pathfinding jobs, combat, diplomacy, and progression systems.

2. Rendering/input layer
   Draws tiles, props, roads, buildings, units, UI overlays, and camera motion at interactive framerates.

This separation is required for performance and maintainability.

## 3. Recommended Tech Stack

### Frontend

- TypeScript
- Vite
- PixiJS 8 for rendering
- WebGL2 backend through PixiJS
- Zustand for lightweight game/UI state
- HTML/CSS overlay UI for panels, HUD, and debug tools

### Simulation

- Main simulation in TypeScript
- Web Worker for simulation loop
- Optional secondary worker later for heavy pathfinding or map generation

### Asset Pipeline

- Texture atlas / tilesets packed offline
- Spritesheets for units, buildings, terrain transitions, and props
- JSON-based biome, building, item, and tech definitions

### Why this stack

- PixiJS gives practical 2D GPU rendering without building a renderer from scratch.
- WebGL via PixiJS is enough for this style of game.
- WebGPU is not necessary for the first several milestones.
- A worker-based simulation avoids UI/render stalls.

## 4. Scope Reality

Your requested feature set is closer to a colony sim / grand strategy / emergent life sim hybrid.

A true "full detailed simulation" with:

- 1000x1000 map
- 4 autonomous tribes
- economy
- logistics
- tools from stone age to sci-fi
- land and naval pathfinding
- diplomacy
- reproduction
- farming
- mining
- warfare
- castles, kings, roads, boats, horses

is too broad for a first implementation pass.

The correct approach is:

- define the final architecture now
- implement a convincing vertical slice first
- expand system depth in controlled phases

## 5. Product Pillars

The game should feel strong in these areas:

1. World scale
   Large map, biomes, terrain variation, visible infrastructure growth.

2. Autonomous life
   Units make believable decisions with clear jobs and priorities.

3. Economic chain
   Raw resources become tools, buildings, food, transport, military gear, and tech progress.

4. Territorial competition
   Tribes expand, border, trade, threaten, and fight.

5. Readability
   Even with many agents, the player can understand what is happening.

## 6. MVP vs Full Vision

## MVP (first playable milestone)

The first real target should be:

- Procedural 1000x1000 tile world
- 4 biomes minimum: grassland, forest, desert, ocean
- Camera pan + mousewheel zoom
- Left click to select tribe/unit/building
- Right click or left-click command mode for movement and building placement
- 1 to 4 tribes placed on map
- Agent simulation with 3 core jobs:
  - gather food
  - chop wood
  - haul resources
- Core buildings:
  - town center
  - house
  - stockpile
  - lumber camp
  - farm field
- Basic road construction
- Reproduction / population growth through housing + food surplus
- Simple tech ages:
  - primitive
  - stone
  - bronze/iron equivalent
- Simple combat between tribes
- Basic diplomacy state:
  - neutral
  - hostile
  - allied
- Performance target:
  - smooth camera/input
  - simulation stable with hundreds of agents

This is already substantial.

## Full Vision

Later phases can add:

- deeper biome set with rivers, marshes, tundra, mountains
- mining, quarrying, digging, tunnels
- workshops and item crafting chains
- horses, mounts, carts
- boats, fishing fleets, naval transport
- structured military units and equipment tiers
- king/castle/governance layer
- advanced diplomacy, treaties, tribute, trade routes
- reforestation and ecological feedback
- age progression from primitive to sci-fi
- faction personality and long-term strategic planning

## 7. World Model

## Map

- Fixed-size grid: 1000x1000 = 1,000,000 tiles
- Chunked storage, e.g. 32x32 or 64x64 tiles per chunk
- Each tile stores compact data:
  - terrain type
  - biome
  - elevation band
  - fertility
  - moisture
  - passability
  - resource node id or none
  - road flag/level
  - building id or none
  - owner tribe id or none

Do not create 1,000,000 rich JavaScript objects. Use typed arrays and chunk registries.

## Biomes

Suggested initial biome rules:

- Grassland: balanced farming and travel
- Forest: wood-rich, moderate food
- Desert: poor farming, sparse resources
- Ocean: impassable without boat tech, supports fishing

Later:

- Hills/mountains for mining
- Swamp for slow movement
- Tundra for survival pressure

## Resources

Initial raw resources:

- berries/fish/grain
- wood
- stone
- ore

Initial refined goods:

- food ration
- plank
- simple tool
- weapon

## 8. Simulation Model

## Time

Use fixed simulation ticks in worker:

- Example: 5 to 10 ticks/sec simulation
- Render independently at display framerate

This is better than simulating every tiny action per rendered frame.

## Agents

Each unit has:

- tribe
- age/stage
- health
- hunger
- energy
- position
- target
- job
- inventory
- equipment
- skill values
- social/home assignment

Initial agent roles:

- laborer
- builder
- hauler
- farmer
- woodcutter
- soldier

Later:

- miner
- blacksmith
- fisher
- sailor
- rider
- noble/king

## AI

Do not start with fully individual "smart" AI for everything.

Use a layered approach:

1. Settlement manager decides tribe priorities
   Examples: need food, need housing, need wood, train militia.

2. Job system generates work orders
   Examples: harvest tree, haul logs, build house, sow field.

3. Agents claim jobs based on role, distance, and urgency.

4. Low-level movement/pathfinding executes tasks.

This is far more scalable than having every agent think globally every tick.

## Tribes

Each tribe tracks:

- population
- territory
- food reserves
- stockpiled materials
- technology level
- military strength
- diplomatic stance toward other tribes
- ruler entity or government status

## Reproduction

For playability, population growth should be systemic, not biology-heavy.

Use a settlement growth model based on:

- housing capacity
- food surplus
- safety/stability
- health/sanitation modifiers later

This gives emergent growth without simulating family trees immediately.

## Diplomacy

Start with rule-driven diplomacy:

- neutral by default
- relations change through proximity, raids, resource pressure, and power imbalance
- tribes can become allied or hostile

Later expand to:

- trade pacts
- tributes
- shared wars
- negotiations

## Technology

Do not attempt direct stone-age-to-sci-fi freeform progression in v1.

Use a staged tech tree:

- Primitive
  - berry gathering
  - huts
  - basic campfire food

- Stone
  - stone tools
  - tree cutting efficiency
  - roads
  - better housing

- Metal
  - mining
  - workshops
  - armor/weapons

- Medieval
  - castle
  - cavalry
  - improved farming

- Industrial
  - mechanized production
  - advanced logistics

- Modern / Sci-fi
  - only after the core sim is proven

Each age should unlock systems, not just stat upgrades.

## 9. Pathfinding and Movement

This is one of the main technical risks.

Recommendations:

- Chunk the navigation grid
- Use A* for local paths
- Cache common routes
- Recalculate only when terrain/buildings change materially
- Use hierarchical pathfinding for long-distance travel
- Roads modify movement cost
- Water navigation uses separate passability rules

For large populations, avoid running expensive full-map A* for every unit.

## 10. Rendering Plan

## Camera

- drag pan
- mousewheel zoom centered on cursor
- zoom clamping
- optional smooth interpolation

## Tile Rendering

- Render by visible chunks only
- Use chunk tilemaps / batched sprites
- Terrain and biome are separate visual layers if needed
- Add props for trees, stones, crops, roads

## Entity Rendering

- Units as animated sprites
- Buildings as footprint + sprite stack
- Team color accents per tribe
- Selection rings, health bars, job icons optional

## UI

Minimal but readable:

- top bar with speed/pause/date/population/resources
- tribe summary panel
- selected entity/building panel
- debug overlay for pathing, chunk bounds, performance

## 11. Performance Strategy

This project will fail in-browser if performance is not designed up front.

Non-negotiable choices:

- typed-array or chunk-oriented world data
- simulation in worker
- visible-chunk rendering only
- batched sprites / tilemaps
- event-driven updates where possible
- capped AI decision frequency
- job-based AI, not full-agent global planning every tick
- pooling for transient objects

Target budgets for early milestones:

- map generation: a few seconds max
- initial load memory: controlled and measurable
- render: stable during pan/zoom
- simulation: hundreds of agents before optimization crisis

## 12. Suggested Code Architecture

```text
src/
  app/
    bootstrap.ts
    game.ts
  render/
    renderer.ts
    camera.ts
    chunkView.ts
    sprites/
  sim/
    worker.ts
    world/
      map.ts
      chunks.ts
      generation.ts
      tiles.ts
    ecs-or-entities/
    tribes/
    economy/
    jobs/
    path/
    tech/
    combat/
  defs/
    biomes.ts
    buildings.ts
    items.ts
    units.ts
    tech.ts
  ui/
    hud/
    panels/
    debug/
  assets/
    tilesets/
    sprites/
```

Recommendation: do not start with a full ECS unless there is a clear reason. A compact entity store + systems model is enough initially and easier to reason about.

## 13. Development Phases

## Phase 0: Foundations

- Vite + TypeScript project setup
- PixiJS render bootstrap
- Worker messaging pipeline
- deterministic tick loop
- chunked map data model
- camera controls

Deliverable:
Open browser, render a huge scrollable/zoomable map.

## Phase 1: World and Visibility

- procedural biome generation
- chunk streaming/rendering
- resource props
- basic selection
- debug overlays

Deliverable:
Large world that is visually readable and performs well.

## Phase 2: Agents and Core Economy

- spawn tribes
- units wander and do jobs
- gather food/wood/stone
- stockpile resources
- build houses/lumber camp/farms
- simple road placement logic

Deliverable:
A tribe can survive and expand on its own.

## Phase 3: Multi-Tribe Simulation

- 4 tribes
- territory claiming
- simple diplomacy
- raids/combat
- balancing for growth pressure and conflict

Deliverable:
Tribes compete and interact.

## Phase 4: Production Chains

- mining
- workshops
- tools/weapons/armor
- better building tiers
- logistics strain

Deliverable:
Settlement specialization matters.

## Phase 5: Transport and Advanced Systems

- horses
- riding/carts
- boats/fishing/naval travel
- deeper agriculture
- reforestation
- castle/ruler layer

Deliverable:
A believable mid-game economy and territorial network.

## Phase 6: Deep Progression

- richer diplomacy
- advanced warfare
- late-age tech
- industrial/modern/sci-fi experiments

Deliverable:
Long-run civilization progression.

## 14. Recommended First Implementation Scope

If we start implementation after discussion, I recommend building only this first:

- Vite + TS + PixiJS
- 1000x1000 generated map
- chunked terrain renderer
- mouse pan + mousewheel zoom
- one tribe with 20 to 50 agents
- food/wood gathering
- houses + roads
- population growth

This is the right slice because it proves:

- browser rendering performance
- large map handling
- simulation architecture
- job/agent loop
- visual style and feel

If this slice feels good, the rest can scale on top of it.

## 15. Open Design Decisions

These need your input before implementation:

1. Visual style
   Pixel-art tiles/sprites, painterly 2D, or clean low-detail sim visuals?

2. Control model
   Mostly god-game observer, or direct RTS-like issuing of orders?

3. Simulation depth preference
   More "fun readable colony sim" or more "hardcore detailed simulation"?

4. Age progression
   Stop around medieval/industrial for a polished game, or truly push toward sci-fi later?

5. Win/failure structure
   Pure sandbox, or optional victory states?

6. Initial target
   Single-tribe sandbox first, or immediate 4-tribe map?

## 16. Recommendation

Best practical direction:

- Browser game in TypeScript
- PixiJS/WebGL rendering
- simulation in a Web Worker
- chunked 1000x1000 world
- vertical slice first
- build toward multi-tribe emergent sim in phases

This gives the best chance of shipping something that already feels alive instead of collapsing under over-scope.
