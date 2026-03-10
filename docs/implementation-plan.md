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
- first-contact/discovery gating so kingdoms explore outward and only broaden diplomacy, trade, and war after establishing contact
- stronger logistics-district growth so expanding resource clusters seed nearby stockpiles and later warehouses instead of hauling everything through the capital forever
- earlier Stone-age proto-industry so stable tribes can open workshops and surface mines before Bronze while water pressure and storage growth stay better balanced
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

## Current Execution Plan

The active plan from the current prototype state is:

1. Performance and smoothness baseline
   - keep reducing live render cost at observer zoom
   - keep smoothing unit/cloud/entity interpolation
   - preserve UI state under live updates
   - keep the default world/test setup fast enough to tune the sim
2. Physical logistics and construction realism
   - remove fake zero-stock haul pickups
   - make build/craft jobs wait on real delivered materials
   - push more source-to-storage-to-production movement through actual buildings
   - keep visible local stock and carried-resource feedback readable
3. Early-game activity and expansion
   - make tribes reliably secure food, water, wood, stone, and housing first
   - force towns to spread by roads, territory, branch halls, and satellite districts
   - keep tribes active after bootstrap instead of flattening into idle equilibrium
4. Midgame specialization
   - stronger warehouse hubs
   - stronger extractor-to-district growth
   - clearer proto-industry, refined goods, and trade pressure
   - race-shaped caravan cargo sourced from visible stocked hubs
   - productive remote hubs able to mature into branch-hall districts
   - district identity by hub type:
     - agriculture hubs pull houses, storage, preserved food, and tavern growth
     - mining hubs pull warehouses, workshops, smithies, and tool pressure
     - harbor hubs pull storage, fisheries, houses, and ration flow
     - industry hubs pull workshops, charcoal, bricks, and later metal production
5. Readability and observer depth
   - better event/history tooling
   - stronger battle readability
   - stronger selected-unit and settlement feedback

Definition of done for the current execution plan:

- tribes visibly gather, haul, build, upgrade, and expand for long runs
- towns spread into connected districts and branch halls instead of only one clump
- construction and crafting depend on visible delivered materials
- caravans move goods that match exporter surplus, hub specialization, and importer need
- performance is stable enough that the simulation remains readable while the world grows

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

## Multi-Hour Execution Sprint

This is the current hands-on execution plan for the next several hours of work. It is ordered by dependency and tuned to the present prototype state, where the biggest problems are still realism, pacing, sustained activity, and readability rather than missing top-level systems.

### Sprint Goals

- reduce "godmode" starts and force tribes to earn stability
- make branch halls behave like real settlement nodes instead of cosmetic extra capitals
- keep towns expanding and redistributing goods after bootstrap instead of idling in place
- make scarcity, depletion, and long-haul logistics visible in-world
- tighten the long-run loop before adding another major era/system layer

### Workstream 1. Scarcity and Bootstrap Balance

Tasks:

- reduce tribe starting inventories to a tighter primitive baseline
- reduce embark stockyard quantities and starter building stock
- reduce bootstrap feature/deposit amounts near starts so extension matters earlier
- reduce passive food, herd, fishing, and breeding inflation so tribes cannot coast for free
- verify that the opener still remains survivable with the smaller stock base

Verification:

- starting-state tests reflect a restrained but viable opener
- construction still has real starter materials to source
- tribes still reach farm + lumber + cistern + stockpile reliably

### Workstream 2. Branch Hall Logistics and Internal Trade

Tasks:

- add hall-local storage accounting around each capital hall
- give each hall local reserve targets for food, wood, stone, ore, and refined goods
- create branch-to-branch haul jobs when one hall runs a deficit and another has surplus
- prefer warehouse/stockpile/capital-hall sources with real visible stock
- keep branch halls fed enough to become self-sufficient instead of collapsing into isolated outposts

Verification:

- branch halls can request and receive goods from other halls in the same tribe
- the new jobs use real stocked buildings, not synthetic sources
- deterministic planner tests cover branch exchange behavior

### Workstream 3. Sustained Activity and Outward Growth

Tasks:

- keep productive remote districts pulling storage, housing, workshops, and roads
- keep idle labor feeding active hubs instead of settling into quiet equilibrium
- bias second-wave growth toward remote productive nodes, not always the core capital
- ensure resource exhaustion pushes tribes outward into new extractor districts
- keep branch halls spawning real support infrastructure after founding

Verification:

- long-run district tests still pass
- at least some tribes expand beyond one compact capital cluster
- resource flow visibly continues after bootstrap rather than freezing into stock equilibrium

### Workstream 4. Observer Readability for Logistics

Tasks:

- keep carried-resource cues strong enough to show what is moving
- keep construction-stage delivery visible on sites
- preserve building-local stock visibility
- surface the consequences of scarcity through tribe activity strings and local stock changes
- avoid adding new observer complexity until the core logistics loop is easier to read

Verification:

- close-zoom observation makes it obvious what a unit is carrying and where it is taking it
- stocked source sites drain and destination sites fill during active hauling

### Workstream 5. Midgame Economic Pressure

Tasks:

- continue strengthening district specialization once scarcity is under control
- make branches and remote hubs pull more race-shaped follow-up buildings
- deepen internal hauling between extractors, warehouses, workshops, smithies, and branch halls
- make trade with external tribes follow local surplus and local shortage more strictly

Verification:

- mature tribes show more than one meaningful district type
- caravans and wagons carry goods that match the producing district and receiving need

### Workstream 6. After This Sprint

Only after the above is stable:

- combat readability improvements
- social simulation depth
- stronger legends/history tooling
- later modern and sci-fi progression

## Multi-Hour Todo List

The concrete todo list for this sprint is:

1. Finish the current scarcity patch in simulation startup and passive economy.
2. Add hall-local branch exchange hauling and test it directly.
3. Re-run startup, branch-support, redistribution, and long-run district tests.
4. Commit the scarcity/branch-logistics slice.
5. Push resource depletion pressure slightly harder if long-run tests still show stock ballooning.
6. Re-run long-run activity/expansion tests and inspect for flattening.
7. Tighten remote-district support triggers if branches still stall after founding.
8. Commit the sustained-activity / outward-growth slice.
9. Update docs again with what landed, what changed in the balance model, and what the next sprint should target.

### Immediate Follow-Up After Scarcity

Once the scarcity and branch-exchange slice is in:

1. expose branch logistics in tribe/world inspection
2. expose shortage/export focus clearly in the tribe list and selected-tribe panel
3. verify that branch-transfer counts and shortage summaries stay in the snapshot contract
4. then continue into stronger long-haul wagon routing and remote district demand

### Subagent Split

Where parallel work is useful:

- subagent A audits observer/UI/tooling gaps so mainline work does not guess at UX needs
- subagent B audits remaining economy/combat/social gaps so the roadmap stays grounded in code reality
- main agent executes scarcity/logistics/growth changes and owns integration/testing

### Definition of Success for This Sprint

This sprint is successful if:

- tribes start weaker but still survive
- resources deplete sooner and force real extension
- branch halls exchange goods with each other instead of acting like isolated silos
- towns keep adding connected satellite districts after the opener
- the sim remains readable and testable after the balance shift

## Current Multi-Hour Execution Plan

The next sustained implementation block should not be treated as "add random features". It should be treated as a staged simulation-solidification pass that makes the existing game loop credible for long observation sessions before larger content expansion resumes.

### Workstream 1. Scarcity, Bootstrap Balance, and Physical Flow

Goal:
Make the first in-world years feel constrained, readable, and believable instead of over-stocked and consequence-free.

Problems to solve:

- tribes start too rich and can coast without doing enough real work
- passive food and breeding are too generous
- remote branches can stockpile in isolation instead of sharing shortages
- resource depletion is real on tiles, but the bootstrap economy can still feel infinite because the starting buffers are too large

Deliverables:

- lower starter tribe/global stock
- lower visible embark pile stock
- lower starter building stock
- lower bootstrap feature deposit sizes near starts
- lower passive food, livestock, and horse growth
- hall-to-hall internal logistics so branch halls can request scarce goods from other halls
- regression tests that prove branch exchange happens and starter stock is restrained

Definition of done:

- tribes must visibly gather, haul, and process within the first year
- at least some starts feel pressure to extend toward new trees, stone, clay, ore, fish, or farmland
- multi-hall tribes no longer behave like isolated economies

### Workstream 2. Long-Haul Logistics and District Demand

Goal:
Keep towns active after the bootstrap phase instead of flattening into "enough stock, stop moving".

Problems to solve:

- mature settlements still go visually quiet too often
- raw sites can still overfill relative to downstream pull
- branch halls need stronger reasons to become self-sustaining districts

Deliverables:

- stronger hall-local demand targets for food, wood, stone, ore, planks, bricks
- stronger wagon preference for branch/core rebalancing
- more storage pull into branch halls and productive remote districts
- stronger demand propagation from workshops, smithies, foundries, factories, taverns, shrines, and barracks
- more visible site-to-site redistribution jobs over time

Definition of done:

- mature tribes keep moving goods across multiple districts
- branch halls do not remain cosmetic
- outposts regularly grow storage, housing, and support follow-ups

### Workstream 3. Expansion Shape and Settlement Readability

Goal:
Make settlements spread into coherent linked districts instead of only thickening the capital blob.

Problems to solve:

- some tribes still cluster too tightly around the initial hall
- roads and branch halls need to read as settlement skeletons
- branch towns need stronger identity once founded

Deliverables:

- stronger road-linked site scoring around branch halls and active hubs
- branch-hall follow-up packages by specialization and race
- better second-wave support around remote extractors
- more town-center and branch-center housing/storage/civic layering
- clearer tests for outward growth and branch support

Definition of done:

- long runs produce at least some tribes with multiple clearly readable settlement centers
- roads visually connect core and branch districts
- specialized branches look different from one another

### Workstream 4. Observer Readability and Feedback

Goal:
Make all of the above easy to see while the sim runs.

Problems to solve:

- some logistics and shortages are still only implicit
- branch-to-branch exchange and local scarcity need clearer observer feedback
- long runs still need more reliable "what is happening and why" readability

Deliverables:

- better branch/local stock feedback in tribe and building inspection
- clearer carrying/building/delivery signals
- cleaner event history for shortages, expansion, and branch founding
- better world-side representation of stocked hubs and active transfers
- smoother unit motion where possible without regressing perf

Definition of done:

- a viewer can tell which districts are exporting, which are starving, and which are growing
- unit movement and hauling remain readable during dense activity

### Workstream 5. Next Major Depth Phase After Stabilization

Once the four workstreams above are stable, the next deeper content pass should resume in this order:

1. richer production chains and warehousing
2. combat readability and battlefield behavior
3. social simulation and dynasty pressure
4. stronger world-danger and adventure loops
5. deeper late-modern and sci-fi progression

## Current Execution Matrix

The next several hours of implementation should be treated as one connected program of work, not a grab bag of feature additions.

### Stream A. Immediate Stability and Scarcity

Owner:
- main thread

Tasks:
- finish the reduced-start-resource pass
- finish branch-to-branch internal haul generation
- validate that starts remain viable
- validate that mature tribes extend instead of sitting on huge buffers

Verification:
- startup tests
- branch exchange tests
- redistribution tests

### Stream A1. Observer Logistics Readability

Owner:
- main thread

Tasks:
- expose branch hall count in tribe summaries
- expose active branch-transfer count in tribe summaries
- expose current shortage state in tribe summaries
- expose current export focus in tribe summaries
- surface those values in tribe/world panels so logistics state is readable without guessing from raw stock numbers

Verification:
- snapshot tests cover branch logistics summary fields
- selected tribe UI exposes shortage / export focus / branch metrics
- world panel exposes aggregate branch and branch-haul counts

### Stream B. Observer and Tooling Audit

Owner:
- subagent / parallel audit

Tasks:
- identify the highest-value missing observer controls
- identify the highest-value missing legends/history affordances
- identify save/load and seed visibility gaps

Verification:
- roadmap updated with concrete UI/tooling deltas
- follow-up implementation list ordered by user value

### Stream C. Midgame Activity and District Specialization

Owner:
- main thread after Stream A is green

Tasks:
- keep branch halls and productive outposts demanding goods
- keep warehouses acting as real attractors
- increase race-shaped branch specialization
- keep settlements adding support buildings after founding

Verification:
- long-run district growth tests
- branch hall support tests
- visual probe of branch settlement growth

### Stream D. Combat and Social Pre-Design

Owner:
- subagent / parallel audit first, implementation later

Tasks:
- define the concrete first slice for:
  - formations
  - retreat/rout
  - campaign readability
  - families/dynasties
  - succession conflict
  - religion splits

Verification:
- next-phase implementation tasks are concrete and code-grounded, not aspirational

## Active Multi-Hour Todo Queue

1. Finish scarcity tuning already in progress in the simulation.
2. Finish branch-hall internal exchange hauling and keep it covered by tests.
3. Re-run startup, branch, redistribution, and long-run district/activity tests.
4. Commit the scarcity/logistics checkpoint.
5. Update the roadmap/spec with the next observer/economy/combat/social slices.
6. Execute the next strongest midgame district-specialization improvements.
7. Verify again with focused long-run tests and a build.
8. Commit and push the resulting checkpoint.

## Multi-Hour Todo List

This is the concrete execution queue for the next several hours. Items should be worked in order unless a regression blocks progress.

### Block A. Finish Scarcity and Branch Logistics

1. Reduce bootstrap stock and passive growth across tribes, embark piles, building stocks, and nearby seeded deposits.
2. Add branch-hall internal exchange hauls for food, building materials, and industrial inputs.
3. Add/update tests for restrained starts and branch exchange.
4. Verify with targeted startup, branch, and redistribution tests plus build.

### Block B. Strengthen Midgame Demand

1. Push stronger downstream demand from branch halls, warehouses, workshops, smithies, and food hubs.
2. Tighten extractor-site target stock so remote sites feed the network earlier.
3. Strengthen wagon preference for long-haul branch/core balancing.
4. Verify with long-run logistics, district, and branch growth tests.

### Block C. Improve Expansion Shape

1. Increase road-linked site scoring around branch halls and productive remote hubs.
2. Add stronger follow-up building packages for branch specializations.
3. Tighten support spawning for second-wave houses, stockpiles, warehouses, cisterns, and workshops.
4. Verify with outward-growth and branch-support tests plus live sim probe.

### Block D. Improve Observer Feedback

1. Expose branch-hall exchange and district scarcity more clearly in snapshots/UI.
2. Improve world-side representation of carried goods, deliveries, and stocked hubs where needed.
3. Add clearer shortage/expansion events.
4. Verify with build plus manual observer probe.

### Block E. Commit/Push Checkpoint

1. Run final targeted tests for the touched systems.
2. Run production build.
3. Commit with a conventional message.
4. Push to `main`.

## Next Multi-Hour Execution Block

Now that scarcity and branch logistics are in place, the next block should focus on making those systems easier to read and then deepening the midgame instead of immediately adding another age.

### Priority Order

1. observer/logistics readability
2. stronger midgame demand and long-haul balancing
3. expansion-shape polish for branch towns
4. combat readability first slice
5. social-simulation first slice

### Workstream 1. Observer and Logistics Readability

Goal:
Expose the current economy and branch-network state clearly enough that long runs are easy to follow.

Tasks:

- surface branch count, branch strain, import/export pressure, and active haul load in tribe summaries
- show branch logistics state in tribe/world panels
- improve shortage/export-focus visibility so users can see why a tribe is moving goods
- keep the added visibility lightweight enough not to hurt render performance

Verification:

- tribe summaries expose branch metrics in tests
- build passes
- selected tribe panel and world lead panel show branch logistics state

Open gaps still remaining after this slice:

- branch halls are still not directly identifiable on the map at a glance
- shortage/export state is still tribe-level, not hall-level or district-level
- hauling intent is still mostly implicit instead of showing source/destination flow clearly
- history/events still do not group or summarize branch growth, shortage, and redistribution well
- storage sites only expose top-stock state, not richer fullness/inbound/outbound role

### Workstream 2. Midgame Demand and Long-Haul Balancing

Goal:
Keep mature kingdoms moving goods between districts instead of stalling once reserves are comfortable.

Tasks:

- strengthen hall-aware redistribution so needy branches pull more aggressively
- improve wagon preference for meaningful long-haul balancing
- add more pull from workshops, smithies, warehouses, and civic hubs
- keep source sites from over-exporting when their own local hall is strained

Verification:

- redistribution and branch tests stay green
- long-run district tests continue to show active storage hubs and branch growth

Key implementation findings:

- wagons still need to prioritize branch deficits and network role more strongly than raw haul size
- hall-aware redistribution still needs deeper strategic reserve behavior beyond simple local pressure
- remote districts still risk flattening once they are merely "good enough"

### Workstream 3. Expansion Shape Polish

Goal:
Make branch towns and productive outposts read like distinct secondary settlements.

Tasks:

- increase branch-town self-supply follow-ups when local stocks are low
- keep roads, houses, stockpiles, and workshops clustering around real branch halls
- continue biasing remote productive sites toward support infrastructure instead of dead-end extractors

Verification:

- branch-support planner tests stay green
- long-run expansion tests still show outward growth and branch founding

Open sim-side gaps:

- branch settlements still do not act like fully self-governing secondary towns
- remote districts need stronger recurring demand for roads, warehousing, industry, and defense
- branch-specialized districts still need stronger visual and structural differentiation over time

### Workstream 4. Combat Readability First Slice

Goal:
Make the next warfare work visible and legible before adding more unit complexity.

Tasks:

- define clearer staging/garrison/frontline states
- expose battlefront pressure and campaign intent in summaries/events
- keep this slice smaller than a full combat refactor

Current reason this comes after logistics:

- the next real combat gain is formations / rout / battlefront cohesion, not just more unit types
- that work is better done after wagon/branch/midgame activity are stable enough to observe clearly

### Workstream 5. Social Simulation First Slice

Goal:
Start turning tribe history into social history once economy and combat readability are in better shape.

Tasks:

- first family/dynasty links
- succession pressure beyond a flat counter
- first internal instability / rivalry visibility

Current reason this comes after combat readability:

- social simulation already has succession/unrest hooks, but it lacks family/dynasty structure, rival claimants, and religious branching
- these systems will be easier to judge once kingdoms and wars are easier to read

## Updated Multi-Hour Todo List

1. Expose branch logistics metrics in summaries and UI.
2. Verify those metrics with focused simulation tests and build.
3. Tighten hall-aware redistribution and long-haul balancing.
4. Re-run branch/district long-run checks.
5. Strengthen branch self-supply and secondary-center growth.
6. Update the plan again with what landed and what still remains before combat/social.

## Subagent Findings Folded Into The Plan

Observer/logistics audit:

- add direct on-map branch-hall identity later
- add hall-level or district-level shortage/import/export visibility later
- add better active haul intent / route readability later
- add richer history grouping for shortages, branch founding, and redistribution later
- add better storage fullness and inbound/outbound role visibility later

Simulation-depth audit:

- strengthen wagon routing by branch deficit and network role before adding bigger economy layers
- deepen hall-aware redistribution once current balancing is stable
- keep remote districts demanding support after first stabilization
- move branch settlements toward stronger secondary-town behavior
- only then start the first combat/social slice

Latest completed execution slices:

- hall-aware redistribution now protects branch reserves instead of freely draining weak branches
- branch sustainment hauls can feed strained halls from richer halls even without raw-site overflow
- hall-local demand now scales more with nearby plans, productive sites, roads, and branch maturity
- branch staffing reacts more strongly to mature and strained branches instead of only tribe-wide totals
- branch support planning now holds luxury follow-ups behind maturity while strained halls stay focused on self-supply
- build supply sourcing now ignores empty source buildings instead of selecting fake local sources
- branch halls now serialize as per-branch snapshot state and are visible in the UI as focusable branch centers
- branch halls now render on-map branch markers and expose per-branch shortage/import/export state in inspection
- planned branch halls now seed nearby stockpile/house/cistern support and get stronger build/haul urgency
- branch planning, growth, shortage, and recovery now emit explicit history events instead of only hiding in summary counters
- branch-founded, branch-rescue, and branch-lost events now land as dedicated feed entries instead of only generic construction/loss noise
- branch-hall build supply hauls now inherit elevated urgency so second centers complete more reliably once planned
- military objectives now bias more toward meaningful frontier infrastructure instead of defaulting back to capitals
- attack and patrol jobs now carry formation/rally metadata so melee, ranged, and flanking roles can claim more appropriate military work
- wounded or routed attackers now fall back into retreat tasks before recovery instead of snapping straight out of combat
- siege engines now target the dedicated siege objective chooser instead of only capital-centered goals
- agents now carry lightweight lineage tags through births and spawning instead of remaining socially blank
- tribes now track legitimacy, rival claimants, sect tension, and branch separatism as first-class social pressure
- succession can now surface explicit claimant pressure, and branch unrest can now surface as its own event pressure before full breakaways
- tribe, branch, and selected-unit UI now expose the first social-state slice instead of hiding it behind raw sim fields
- high-separatism branches can now riot locally, damaging stocks and legitimacy instead of only showing warning-state numbers
- very high-separatism branches can now turn defiant, stop behaving like obedient exporters, and surface that state in summaries
- combat resolution now lets rear-line and mage units contribute from stand-off range instead of requiring every attacker to stack on the same tile radius

Current concrete follow-up gaps:

- productive remote hubs still need a stronger and faster path from planned branch halls into completed second settlement centers in long runs
- branch identity is better on the map now, but branch-specialized districts still need stronger visual differentiation over time
- per-branch observer state is present, but district-level shortage and recovery feedback is still shallow
- branch history exists in the event feed now, but rescue/founding/recovery events still need better grouping and longer-term legends treatment
- combat jobs still need clearer battlefront spacing and more observer-visible campaign/frontline state
- social state now exists, but it still needs full house/dynasty continuity, sect splits, and real breakaway-branch consequences

## 24. Active Multi-Hour Work Program

This is the next concrete work block. The priority is to make branch towns, remote districts, and redistribution behave like real secondary settlement systems before widening the feature set again.

### 24.1 Workstream A: Branch Self-Supply and Maturity

Goal:
- make branch halls become self-sustaining towns instead of passive branch markers

Implementation tasks:
- branch halls should inspect their own nearby food, wood, stone, and ore access
- branch halls should plan missing local extractors and support buildings earlier when reserves are low
- mature branch halls should pull more storage, workshops, and race-shaped support around productive sites
- strained branch halls should bias toward survival and supply before luxury or civic follow-ups

Definition of done:
- a founded branch hall can grow toward houses, storage, local production, and survival support without waiting indefinitely on the core

### 24.2 Workstream B: Recurring Remote District Demand

Goal:
- stop productive remote sites from plateauing once they have one or two nearby buildings

Implementation tasks:
- productive sites should keep pulling storage and support while local stock and remoteness stay high
- remote districts should promote second-wave houses, storage, and workshops more reliably
- remote districts should keep feeding later branch-hall growth instead of flattening into lone extractors

Definition of done:
- long-run settlements continue spreading into visible outpost districts instead of collapsing into one saturated town center

### 24.3 Workstream C: Hall-Aware Redistribution and Wagons

Goal:
- make long-haul movement reflect real shortage and network role

Implementation tasks:
- prefer strained branch resupply over weak short local hauls
- favor redistribution destinations that are locally needy and productive
- keep extractor overflow flowing into useful hubs instead of bloating raw sites
- continue strengthening wagon preference for balancing the settlement network

Definition of done:
- branch-to-branch flows stay active in mature tribes and visibly support weaker halls

### 24.4 Workstream D: Observer Readability for the Above

Goal:
- make the branch/logistics state readable enough to tune by observation

Implementation tasks:
- expose any new shortage and maturity signals in tribe/branch summaries
- improve event grouping around branch growth, shortage, rescue, and recovery
- keep carried goods, local stocks, and branch identities obvious in the world view

Definition of done:
- the observer can tell which branch is strained, which branch is recovering, and why goods are moving

### 24.5 Follow-On Work After This Block

Only after the previous workstreams are stable:
- return to combat readability and clearer battlefront/campaign state
- deepen dynasty, sect, and breakaway-branch social consequences
- continue later economy-chain and observer-history expansion

### 24.6 Ordered Multi-Hour Todo List

1. update branch planners so halls react to local depletion and missing extractors
2. tighten remote district support growth around productive sites
3. strengthen hall-aware redistribution destination scoring
4. expose any new branch shortage or maturity state needed by the observer
5. run bootstrap, frontier, branch-support, branch-exchange, and long-run expansion tests
6. commit and push that slice
7. repeat on the next branch/logistics gap before moving to combat/social follow-up
