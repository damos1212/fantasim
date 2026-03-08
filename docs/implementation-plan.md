# Tribe Sim Implementation Plan

## Goal

Build a browser-playable, observer-driven, tile-based world simulation with:

- large procedurally generated world
- multiple races and tribes
- deterministic simulation ticks
- autonomous expansion and survival behaviors
- clear readable rendering
- acceptable performance in a normal desktop browser

This plan describes what will actually be implemented in this project, how the systems fit together, and how the work will be verified.

## Scope Boundary

The target is a full playable prototype with meaningful world simulation, not an infinite-content finished commercial game.

The implementation target for this pass is:

- tile-based, grid-aligned world and movement
- procedurally generated world with distinct regions
- 8 races with bias/personality profiles
- multiple tribes on one map
- autonomous economy, expansion, combat, diplomacy, and technology through a first modern tier
- observer-only interface
- pixel/vector hybrid readable art generated in code

The implementation will not attempt a full stone-to-sci-fi span in this pass. The current project now carries the sim through gunpowder, industrial, and a first modern slice, while leaving room for later ages beyond that.

## Technical Direction

### Rendering

- PixiJS on WebGL
- chunk-based tile rendering
- overlay layers for roads, buildings, resources, units, and debug information
- camera supports drag pan and mousewheel zoom

### Simulation

- deterministic fixed-tick simulation in a Web Worker
- chunk-aware world storage with typed arrays
- manager/job/agent model rather than per-agent global planning
- discrete grid movement between tile centers

### Project Structure

```text
docs/
  tribe-sim-spec.md
  implementation-plan.md
src/
  main.ts
  styles.css
  app/
  defs/
  render/
  sim/
  shared/
tests/
```

## System Breakdown

## 1. Shared Definitions

Purpose:
Keep core enums, config, and type contracts synchronized between the worker and the renderer.

Planned contents:

- world constants
- terrain and biome enums
- race and tribe personality definitions
- building types
- resource/item types
- tech ages and unlocks
- message formats between main thread and worker

## 2. World Generation

Purpose:
Generate a large, varied map that already tells a readable story before simulation starts.

Planned world layers:

- elevation
- temperature
- moisture
- volcanic activity
- river/lake mask
- biome
- terrain passability
- resource distribution

Target biomes/regions:

- temperate grassland
- dense forest
- snowy forest
- mountain
- snowy mountain
- desert
- marsh
- coastline
- deep ocean
- volcanic waste
- dark ashland
- archipelago islands

Planned landmark features:

- mountain chains
- lakes
- rivers
- volcano clusters
- fertile valleys
- coastlines and island groups

Implementation method:

- seeded deterministic noise
- ridge noise for mountains
- explicit elevation / moisture / temperature layering before biome assignment
- coastal humidity and mountain rain-shadow climate pass
- erosion-lite river tracing
- moisture spread from water
- hand-tuned biome thresholds

## 3. Tribe Placement

Purpose:
Seed the world with tribes that fit the environment and immediately diverge.

Implementation:

- pick candidate start zones by biome suitability and spacing
- place tribal capitals with initial buildings and stockpiles
- assign tribe identity, race, color, personality, and starting tech bias

Initial races:

- humans
- elves
- dwarves
- orcs
- goblins
- halflings
- nomads
- darkfolk

Race/environment bias examples:

- elves: forest preference, lower aggression, higher replanting tendency
- dwarves: mountain/snow preference, strong building/mining bias
- orcs: ashland/volcanic preference, high aggression, strong military growth
- humans: balanced, trade/diplomacy-friendly
- halflings: fertile plains, farming focus
- goblins: opportunistic scavenging, fast expansion, low stability
- nomads: dry plains/desert edges, mobility bias
- darkfolk: charcoal waste/harsh terrain, isolationist and militarized

## 4. Tile and Chunk Model

Purpose:
Represent large worlds efficiently.

Data layout:

- world stored as width/height sized typed arrays
- tile data split by concern instead of object-per-tile
- render and sim read from snapshots, not shared mutable objects

Per-tile fields:

- elevation
- biome
- terrain
- fertility
- moisture
- temperature
- feature
- resource amount
- owner tribe id
- road level
- building id

Chunking:

- chunk size 32x32
- visible-chunk rendering only
- dirty chunk tracking for snapshot updates

## 5. Resource and Economy Model

Raw resources:

- berries
- grain
- fish
- wood
- stone
- ore
- clay
- livestock

Processed goods:

- rations
- planks
- tools
- weapons
- armor
- charcoal
- bricks

Economy model:

- buildings create work opportunities
- job manager queues tasks
- agents claim tasks based on role and distance
- tribes track aggregate stockpiles
- shortages shift strategic priorities automatically

## 6. Buildings

Initial building set:

- capital hall
- house
- stockpile
- road
- farm
- lumber camp
- quarry
- mine
- workshop
- smithy
- dock
- fishing hut
- stable
- barracks
- watchtower
- castle

Rules:

- every building occupies one or more grid tiles
- footprint is always aligned to the tile grid
- construction consumes resources and time
- buildings create jobs, storage, or strategic effects

## 7. Agents and Animals

### Agents

Core stats:

- tribe
- race
- age stage
- health
- hunger
- warmth
- morale
- combat skill
- labor skill
- farming skill
- crafting skill
- inventory summary
- home id
- current task

Core roles:

- worker
- farmer
- woodcutter
- miner
- builder
- hauler
- fisher
- crafter
- soldier
- rider
- mage

### Animals

Initial animal groups:

- deer
- boar
- wolves
- horses
- sheep

Simulation use:

- wild movement by biome
- hunting pressure
- domestication/capture for horses and livestock
- horse capture unlocks rider/stable use

## 8. AI Model

### Strategic layer

Runs per tribe at a slower interval:

- evaluates food, housing, defense, expansion, and military pressure
- emits desired actions and job priorities
- adjusts diplomacy stances

### Operational layer

Creates job queues:

- gather
- haul
- build
- plant
- harvest
- mine
- craft
- patrol
- attack
- fish
- tame horse

### Agent layer

- claim nearest reasonable task
- path tile-to-tile
- perform work at discrete rates
- rest/eat/return home when necessary

## 9. Pathfinding

Rules:

- all movement is grid-aligned
- agents move one tile step at a time
- movement cost depends on terrain, biome, roads, and water access

Implementation:

- A* for local pathing
- bounded search for ordinary jobs
- fallback wandering/retargeting when unreachable
- road preference via lower movement cost
- boats are modeled as a technology-gated movement mode on water-adjacent routes

Performance controls:

- per-tick pathfinding budget
- path reuse for repeated destinations
- stale path invalidation only on meaningful tile changes

## 10. Technology Progression

Ages for this pass:

- primitive
- stone
- bronze
- iron
- medieval

Unlock examples:

- stone: improved tools, roads, better housing
- bronze: mines, smithy, basic arms
- iron: stronger tools and armor, better military
- medieval: castle, advanced farming, stables, stronger diplomacy and logistics

Research model:

- tribes accumulate research from population, buildings, and stability
- race/personality biases steer tech preferences

## 11. Diplomacy and War

Diplomacy state per tribe pair:

- allied
- neutral
- suspicious
- hostile
- at war

Drivers:

- border proximity
- race compatibility
- trade success
- raids
- resource scarcity
- power gap

War model:

- soldiers assemble from population and gear availability
- tribes raid exposed resource sites and border structures
- stronger tribes push territorial influence

## 12. Reproduction and Population

Population growth is systemic:

- requires housing capacity
- requires food surplus
- reduced by warfare, hunger, cold, and instability

This avoids excessive family-tree complexity while still producing believable demographic pressure.

## 13. Observer UI

Main UI elements:

- world viewport
- top information bar
- selected tribe panel
- selected tile panel
- simulation stats panel
- legend/minimap-lite panel

Readability features:

- tribe colors
- unit role tinting
- tile hover info
- building labels at closer zoom
- optional debug overlays

## 14. Milestones

### Milestone A: Foundation

- Vite + TS + PixiJS setup
- worker messaging
- tile world data structure
- camera pan/zoom
- chunk renderer

Verification:

- app boots
- large map renders
- zoom and pan behave correctly

### Milestone B: World Generation

- biome and terrain generation
- river/lake/volcano placement
- readable terrain palette
- resource placement

Verification:

- deterministic seeded world
- biome variety on generated map
- no impossible water/mountain corruption spikes

### Milestone C: Tribe Simulation

- tribe placement
- initial population and buildings
- jobs, movement, hunger, stockpiles
- roads and house construction

Verification:

- tribes survive for multiple simulated years
- agents stay grid-aligned
- buildings consume resources and appear on map

### Milestone D: Economy and Technology

- farming, woodcutting, mining, crafting, fishing
- workshops, smithies, docks, stables
- research through medieval age

Verification:

- tribes unlock ages over time
- outputs depend on required inputs
- shortages alter strategic decisions

### Milestone E: Diplomacy and Conflict

- multiple tribes
- diplomacy drift
- raids and war
- territory pressure

Verification:

- relations change over time
- hostile tribes fight
- peaceful tribes can coexist longer

### Milestone F: Polish and Tests

- balance pass
- performance pass
- automated tests
- build verification

Verification:

- test suite passes
- production build succeeds
- simulation remains stable under long-run execution

## 15. Verification Plan

Automated tests:

- world generation determinism
- biome classification sanity
- pathfinding on representative maps
- strategic manager priorities
- building/resource production rules
- diplomacy transitions

Integration checks:

- worker snapshot updates render without crashes
- long simulation run does not produce NaN or invalid ids
- tribes remain within map bounds

Manual checks:

- pan/zoom
- map readability
- tribe distinctness
- visible infrastructure growth
- war and diplomacy observation

## 16. Acceptance Criteria For This Pass

This pass is considered successful if:

- the browser app launches locally
- the world is clearly tile-based and visually varied
- multiple races/tribes exist and behave differently
- agents move and build on the grid
- tribes gather, farm, fish, mine, craft, fight, and expand
- roads, buildings, and settlements visibly emerge over time
- technology advances through medieval
- the game remains responsive while observing the simulation

## 17. Execution Order

1. Scaffold project and dependencies.
2. Implement shared definitions and deterministic utilities.
3. Implement world generation and tile storage.
4. Implement tribe placement, buildings, and economy state.
5. Implement jobs, agents, and pathfinding.
6. Implement diplomacy, combat, and tech progression.
7. Implement worker loop and snapshot protocol.
8. Implement renderer, camera, and overlays.
9. Add tests and run build/test verification.

## 18. Expansion Findings

Additional systems should be prioritized based on the strongest design patterns from Dwarf Fortress and WorldBox:

- regional weather fronts and disasters
- inspectable event history / legends-lite feed
- named legendary creatures and lairs
- clearer tribe inspection and activity summaries
- aggressive zoomed-out level-of-detail rendering

These systems improve depth and readability at the same time, which is the correct direction for this project.

## 19. Next Execution Order

1. Add weather cells/fronts and weather-driven events.
2. Add world event log and tribe activity summaries.
3. Add legendary creatures, lairs, and raids.
4. Add richer observer UI for tribe inspection and event feed.
5. Add zoomed-out render LOD and performance safeguards.
6. Expand tests to cover the new systems and rerun verification.

## 20. Further Expansion Order

1. Add broader tech catalog with race-specific unlocks and visible effects.
2. Add unit naming, aging, old-age death, and richer gear presentation.
3. Add world sites such as dungeons/ruins and expedition/loot loops.
4. Add deeper farming and animal systems.
5. Add siege progression and late-medieval warfare assets.
6. Add minimap, shortcuts, and clearer unit overlays.
7. Add hero/champion identity, wounds, and visible battlefield magic.

## 21. Remaining Major Backlog

The following major systems are still not fully implemented and should remain visible in the plan:

- subsurface / cave / deep-delve layer with separate simulation rules
- deeper trenching and fluid storage/flow systems beyond the current canal/earthwork layer
- stronger late-game magic progression beyond the current sanctum / archmagic / cataclysm step
- post-medieval expansion beyond the current first gunpowder step, including fuller firearms spread and industrial shifts
- distinct race-specific building silhouettes and settlement architecture sets
- more advanced animal handling and herding loops
- ruler / dynasty / succession identity with stronger long-term stories
- broader production chains and rarer materials
- full siege camp / assault / engineering behavior beyond the current ram, trebuchet, ballista, and siege-tower layer
- deeper multi-stage health/injury/condition simulation beyond the current recovery / infirmary layer
- more advanced fortification sets beyond current palisades, gates, stone walls, and trenches

## 22. Ongoing Polish Priorities

- clearer action feedback for building, hunting, hauling, fishing, crafting, and combat
- improved map readability at all zoom levels
- stronger LOD/culling behavior so zoomed-out observation stays smooth
- denser but cleaner observer UI
- better tribe/world/event navigation for long viewing sessions
- stronger hero/unit readability with titles, status, wounds, and gear cues
- cleaner military/economy summaries so tribe state is understandable at a glance
- visible regional weather, clearer rivers/lakes, and stronger elevation readability
- stronger race/doctrine-driven visual identity for buildings, units, and gear
- more coherent district-style town planning and visible construction hauling
- stronger per-role action readability and selected-unit follow/inspection
- clearer support-depth readability for recovery, magical infrastructure, and siege assets
- stronger civic layering through warehouses, schools, shrines, taverns, armories, and fisheries
- visible faith/blessing state so religious progression affects named units and tribe identity
- less abstract logistics so gatherers return to storage hubs and crafters wait on hauled inputs at production buildings
- first-step harsh-terrain settlement support through mountain halls for mountain-oriented tribes
- first-step fluid/subsurface infrastructure through cisterns and deep mines
- first-step cave-oriented infrastructure through tunnel entrances and visible delve counts in tribe inspection
- active underground expeditions from tunnel entrances and deep mines, with cave-ins, hostile encounters, relic finds, and better underground event coverage
- dynamic tribal water reserves fed by cisterns, canals, nearby water, and weather, with drought/thirst pressure surfaced in tribe state and events
- larger default world footprint plus stronger macro geography through ocean basins, island chains, wetter marsh belts, drier desert bands, and bigger inland lakes
- first post-medieval progression step through a gunpowder age, foundries, charcoal/brick production, firearm-era gear, and cannon artillery
- stronger late-game magic through arcane sanctums, higher-tier mage gear, and larger sanctum-backed battlefield spells
- first-step ruler/succession identity in tribe summaries so coronations, ruler deaths, and leadership turnover are visible in observer UI
- first-step condition simulation for fatigue, sickness, and inspiration, with recovery pressure, morale impact, and observer-visible tribe/unit state
- first-step wagon logistics so horse-backed carts visibly work haul jobs between storage, craft sites, and construction sites instead of all land hauling reading as foot traffic
- second post-medieval progression step through an industrial age, with factories, rail depots, stronger firearm gear, and mortar artillery for industrialized factions
- first modern-era progression step through power plants, airfields, armored columns, zeppelins, stronger modern firearms, and observer-visible aerial/industrial doctrine shifts
- real modern-era support behavior where power plants boost industry/water capacity, airfields strengthen aid and trade reach, and tribe inspection exposes modern infrastructure counts
- dynamic surface-water simulation layered over terrain, with rainfall runoff, canals/trenches filling, flood pressure on farms and buildings, and observer-visible wet/flooded tiles
- managed waterworks simulation so cisterns absorb and redistribute water, canal/trench networks stay fed when connected, and overflow/drought pressures create visible spillway and irrigation behavior
- true inspectable underground layer with generated caverns, ruins, magma seams, underground rivers, excavated tunnel networks, and tribe-visible tunnel depth stats
- more explicit diplomacy through formal trade pacts, tribute pressure, and clearer kingdom-level relationship state in the observer UI
- diplomacy effects that materially change survival pressure through alliance aid convoys, tribute strain, and tributary morale/rebellion pressure
- stronger render polish through underground/surface view toggles, animated water and lava shimmer, drifting cloud shadows, and subtler building shadowing

## Expansion Roadmap

The following backlog is intentionally kept explicit so the next major system pushes stay visible:

- deeper late-era progression: more real modern content, then true sci-fi instead of only enum/path placeholders
- better military simulation: formations, ranged spacing, clearer battlefronts, retreat/rout logic, and siege target selection that feels intentional
- deeper economy chains: more distinct manufactured goods, bottlenecks, specialization, and trade-value differences between cultures
- better social simulation: families, dynasties, succession politics, rival heroes, religion splits, rebellions, and longer-form historical memory
- stronger world danger: more dungeon/event variety, more creature behaviors, lair ecosystems, and expedition outcomes that reshape kingdoms
- better pathing/logistics at scale: hierarchical pathfinding, route caching, and stronger district/warehouse/port/rail planning
- more authored visual identity: true sprite sheets, race-specific architecture sets, richer unit animation states, and stronger large-scale LOD rendering
- better observer tooling: charts/history views, kingdom comparison, legends browser, filters, time controls, and event jump/focus tools
- save/load and replayable seeds with exportable world state
- more balancing and long-run tuning so growth, collapse, diplomacy, war, and recovery stay interesting for hours rather than flattening

## Detailed Next-Phase Plan

The next major work should happen in this order so the sim becomes easier to watch, easier to tune, and deeper without collapsing under unreadable complexity.

### Phase A. Observer Tooling and Presentation

Goal:
Make the simulation enjoyable to watch and easy to inspect before adding more complexity.

Deliverables:

- pause plus `1x / 2x / 4x / 8x` simulation speed controls
- event jump/focus from UI
- event filters by type
- tribe comparison panel
- larger history / legends browser
- smoother interpolation for agents, animals, carts, boats, caravans, and clouds
- better animation readability for build, haul, gather, craft, and battle states
- clearer building/settlement readability at normal observer zoom
- cleaner selected-unit follow behavior

Definition of done:

- a user can pause, speed up, slow down, and jump around the world without losing context
- recent and historical world events are easy to browse and focus
- motion looks smooth enough that world activity is readable at a glance

### Phase B. Economy Depth

Goal:
Make tribes feel like they run real production chains instead of shallow stock counters.

Deliverables:

- explicit material chains:
  - wood -> planks
  - clay -> bricks
  - ore + charcoal -> refined metal
  - grain / livestock / fish -> preserved food
  - fiber / hides / metal -> distinct gear classes
- clearer bottlenecks:
  - fuel shortages
  - clay shortages
  - missing transport capacity
  - missing storage capacity
- district specialization:
  - farming belts
  - industrial quarters
  - dock districts
  - mountain extraction districts
  - warehouse hubs
- better routing logic:
  - warehouses as actual hubs
  - docks as trade/export nodes
  - rail depots as long-haul logistics nodes
  - stronger haul prioritization between critical and luxury goods
- race-specific trade profiles:
  - dwarves export ore, tools, engineering goods
  - elves export food, timber, magical goods
  - humans export balanced finished goods
  - orcs rely more on raiding and coarse production

Definition of done:

- tribes can visibly stall or thrive due to production bottlenecks
- settlement layout reflects what the tribe is good at producing
- trade relationships materially change what kingdoms can afford to build and field

### Phase C. Combat Readability and Warfare

Goal:
Make wars legible and intentional instead of looking like loose unit noise.

Deliverables:

- battlefield roles:
  - line infantry
  - ranged support
  - cavalry flankers
  - mage backline
  - siege support
- formations and spacing behavior
- retreat, rout, rally, and morale-break states
- better siege target selection:
  - gates
  - wall breaches
  - barracks
  - capitals
  - waterworks
- clearer battlefront behavior:
  - staging near roads
  - garrisons in towns
  - patrol rings
  - raiding parties vs. full invasions
- visible battle aftermath:
  - wounded recovery load
  - ruins / breaches
  - loot and captured supplies

Definition of done:

- the player can tell where a battle line is, who is winning, and why
- armies stop behaving like a flat pile of combat stats
- fortifications and terrain visibly change combat outcomes

### Phase D. Social Simulation

Goal:
Make tribes feel like societies with memory, not only production machines.

Deliverables:

- family links for units
- rulers with lineage and heirs
- succession crises and rival claimants
- dynastic reputation and long-form house history
- rival heroes and notable champions
- religion branches / sect differences
- rebellions and separatist breakaways
- better chronicled life events:
  - births
  - deaths
  - marriages / bonds
  - coronations
  - betrayals
  - exiles

Definition of done:

- tribe history generates recognizable storylines over long runs
- leadership and internal instability matter, not only external war/economy

### Phase E. World Danger and Adventure

Goal:
Make the world itself push back harder and create more emergent stories.

Deliverables:

- more dungeon types and outcomes
- expedition parties with survival/failure logic
- lair ecosystems around legendary creatures
- creature migration / raiding patterns
- relic chains and named artifacts
- region-wide disasters tied to lairs, volcanoes, weather, and deep delves

Definition of done:

- exploration and danger reshape kingdom histories
- the world creates memorable crises even without tribe-vs-tribe war

### Phase F. Late-Era Expansion

Goal:
Push the tech arc beyond the current first modern slice without skipping readability.

Deliverables:

- deeper modern:
  - stronger factories and power grids
  - modern infantry distinctions
  - artillery doctrine
  - proper vehicles and aircraft identity
- sci-fi foundation:
  - energy infrastructure
  - advanced materials
  - higher-tier automation
  - race-specific late-age divergence instead of generic future tech

Definition of done:

- later eras feel like real shifts in logistics, warfare, and visuals
- race identity still matters in modern and post-modern phases

## Polish and Tuning Checklist

The following should be revisited continuously as each phase lands:

- startup tribe viability and opener pacing
- readable building silhouettes at all zoom levels
- visible carry/haul/build feedback
- pathing cost and route sanity
- combat casualty rates versus recovery rates
- diplomacy stability versus constant-chaos tuning
- trade usefulness versus self-sufficiency
- long-run population growth and collapse curves
- map readability at far zoom
- render cost under heavy population and large wars

## Recommended Immediate Execution Order

1. Finish observer tooling polish and time-control usability.
2. Land the first deeper economy slice around production bottlenecks and district specialization.
3. Land combat readability improvements before expanding unit counts further.
4. Add the first social-simulation slice only after economy/combat become easier to read.
5. Rebalance long-run pacing before pushing harder into late modern and sci-fi.
