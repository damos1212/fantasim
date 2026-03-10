# Full System Specification

## 1. Product Summary

Create a browser-based, observer-only, top-down 2D tile simulation where multiple races and tribes inhabit a large procedural world and autonomously survive, expand, build, research, fight, trade, and reshape their environment.

The game is fully grid-aligned:

- world geometry
- movement
- roads
- buildings
- resource placement
- territorial logic

The player does not directly command units. The player observes a living simulation.

## 2. High-Level Feature Set

The full implementation target for this project pass includes:

- procedural large-scale world generation
- grid/tile-based rendering and movement
- multiple biomes and landmark features
- multiple races and tribes with distinct biases
- autonomous settlement building and expansion
- food, wood, stone, ore, clay, fish, livestock, and crafted goods
- roads and logistics
- farming and replanting
- fishing and water use through dock/boat systems
- animal spawning, domestication, and horse capture
- tool, weapon, and armor production
- research progression from primitive through a first modern slice
- diplomacy, hostility, alliances, raids, and war
- visible infrastructure growth
- worker-based simulation for performance
- automated tests and production build verification

## 3. World Model

### 3.1 Map Size

Default target:

- 4608 x 4096 tiles

Reasoning:

- large enough to support wide oceans, island chains, inland lakes, long rivers, and multiple distant tribal regions
- still realistic for browser memory and browser-side generation on a modern desktop
- architecture remains compatible with larger maps later if chunking/culling is pushed further

### 3.2 Tile Grid

Every tile stores:

- terrain
- biome
- elevation
- moisture
- temperature
- fertility
- volcanic influence
- feature
- resource type
- resource amount
- owner tribe id
- road level
- building id
- occupancy flags

### 3.3 Chunking

- chunk size: 32 x 32 tiles
- chunk registry for render and sim dirty tracking
- only changed chunks are re-snapshotted aggressively

### 3.4 Terrain Types

- water_shallow
- water_deep
- beach
- grass
- forest_floor
- marsh
- desert
- rocky
- mountain
- snow
- ashland
- lava
- river
- farmland
- road

### 3.5 Biomes

- temperate_plains
- deep_forest
- alpine
- snowy_forest
- tundra
- desert
- scrubland
- marshland
- coastline
- archipelago
- volcanic_highland
- ash_waste

### 3.6 Natural Features

- tree cluster
- berry patch
- stone outcrop
- ore vein
- clay deposit
- fish shoal
- volcano
- lake
- river
- mountain ridge

## 4. World Generation Rules

### 4.1 Inputs

- global seed
- world width/height
- climate tuning constants
- tribe count

### 4.2 Generation Stages

1. elevation noise
2. mountain ridge pass
3. temperature field
4. moisture field
5. coastline and water fill
6. coastal-humidity and rain-shadow climate redistribution
7. river tracing
8. lake basin fill
9. volcanic hotspot placement
10. biome assignment
11. feature/resource placement
12. tribe start scoring

### 4.3 World Quality Requirements

- map must contain multiple major landmasses or regions
- map must contain meaningful water systems
- map must contain harsh and fertile zones
- each race should have at least one favorable expansion region

## 5. Races and Tribal Identity

### 5.1 Races

- humans
- elves
- dwarves
- orcs
- goblins
- halflings
- nomads
- darkfolk

### 5.2 Race Profiles

#### Humans

- balanced economy
- moderate diplomacy
- moderate military
- adaptable biome preference

#### Elves

- forest affinity
- lower aggression
- better farming/forestry
- strong replanting tendency

#### Dwarves

- mountain and snow affinity
- strong mining and construction
- slower population growth
- high infrastructure bias

#### Orcs

- volcanic/ash affinity
- strong military emphasis
- high aggression
- weaker diplomacy

#### Goblins

- opportunistic scavenging
- fast growth
- weaker stability
- strong raiding tendency

#### Halflings

- strong agriculture
- peaceful bias
- good food efficiency
- weaker warfare

#### Nomads

- dry plain/desert edge affinity
- mobility bias
- weaker permanent infrastructure early
- fast exploration

#### Darkfolk

- harsh biome survival bias
- isolationist
- strong defense and militarization
- lower diplomacy baseline

### 5.3 Tribes

Each tribe has:

- id
- race
- name
- color
- personality traits
- starting technology bias
- diplomacy table
- capital building
- aggregate stockpile
- population and housing stats
- territory influence
- research score
- military readiness

### 5.4 Personality Axes

- aggression
- expansionism
- industriousness
- diplomacy
- ecology
- militarism
- trade affinity
- risk tolerance

## 6. Population Model

### 6.1 Agent Categories

- child
- adult worker
- specialist
- soldier
- elder

### 6.2 Agent Stats

- tribeId
- race
- role
- x
- y
- hp
- hunger
- warmth
- morale
- labor
- farming
- mining
- combat
- crafting
- movement mode
- carried resource
- home building
- assigned task

### 6.3 Growth

Population growth depends on:

- housing surplus
- food surplus
- settlement stability
- current season pressure
- warfare losses

### 6.4 Mortality Pressures

- starvation
- exposure
- combat
- collapse from persistent instability

## 7. Animals

### 7.1 Wild Animals

- deer
- boar
- wolf
- horse
- sheep
- fish school

### 7.2 Uses

- hunting for food
- domestication for livestock
- horse capture for mounted roles
- fish as renewable coastal/ocean food source

### 7.3 Spawn Rules

- biome-linked spawn tables
- herd grouping for land animals
- periodic replenishment within limits

## 8. Resources and Goods

### 8.1 Raw Resources

- berries
- grain
- wood
- stone
- ore
- clay
- fish
- meat
- hides
- horse
- livestock

### 8.2 Processed Goods

- ration
- plank
- brick
- charcoal
- tool_stone
- tool_bronze
- tool_iron
- weapon_basic
- weapon_metal
- armor_basic
- armor_metal

### 8.3 Storage

- tribe-level aggregate stockpile
- building-linked storage capacity modifiers
- resource pressure affects strategy

## 9. Buildings

### 9.1 Core Buildings

- capital_hall
- house
- stockpile
- road
- farm
- orchard
- lumber_camp
- quarry
- mine
- workshop
- smithy
- dock
- fishing_hut
- stable
- barracks
- watchtower
- castle

### 9.2 Building Rules

- every building is tile-aligned
- footprint is fixed by type
- requires passable legal placement
- consumes a recipe
- creates jobs or modifiers

### 9.3 Building Effects

- housing capacity
- food production
- raw material extraction
- production unlock
- military training
- territorial projection
- logistics efficiency
- research contribution

## 10. Technology System

### 10.1 Ages

- primitive
- stone
- bronze
- iron
- medieval

### 10.2 Research Sources

- population size
- stability
- workshops/smithies/castles
- race bias
- personality focus

### 10.3 Example Unlocks

#### Primitive

- house
- berry gathering
- hunting
- camp survival

#### Stone

- roads
- lumber camp
- farm
- quarry
- stone tools

#### Bronze

- mine
- workshop
- bronze tools
- basic weapons
- barracks

#### Iron

- smithy
- iron tools
- armor
- watchtower
- stronger roads

#### Medieval

- stable
- dock
- fishing hut
- castle
- cavalry
- stronger diplomacy/military thresholds

## 11. Economy and Production

### 11.1 Core Loops

- gather food -> feed population -> grow tribe
- cut wood/stone -> build structures -> expand capacity
- mine ore/clay -> craft tools and infrastructure
- craft weapons/armor -> improve military
- build roads -> lower travel cost -> improve economy

### 11.2 Production Dependencies

- farm requires fertile land
- mine requires ore-bearing/rocky terrain
- dock/fishing requires adjacent water
- stable requires captured horses
- castle requires late-age tech and large stockpile

### 11.3 Replanting and Ecology

- forestry-focused tribes replant in forest regions
- excessive cutting reduces nearby wood supply
- this influences expansion and logistics pressure

## 12. Job System

### 12.1 Job Types

- gather
- harvest
- hunt
- fish
- cut_tree
- replant_tree
- haul
- build
- repair
- farm_sow
- farm_harvest
- mine
- quarry
- craft
- patrol
- attack
- tame_horse

### 12.2 Job Generation

Generated by:

- tribal strategic controller
- building needs
- map resources
- war state
- season/resource pressure

### 12.3 Job Assignment

Agents pick jobs by:

- role compatibility
- distance
- urgency
- current need weighting

## 13. Strategic Tribal AI

### 13.1 Strategic Needs

- food
- housing
- materials
- tools
- military
- expansion
- research
- diplomacy

### 13.2 Example Behavior

- if food low -> prioritize farming/fishing/hunting
- if housing low -> build houses
- if wood low -> build lumber camp and assign cutters
- if ore discovered and age supports it -> establish mine
- if hostile border pressure high -> train soldiers/build watchtower
- if wealthy and advanced -> build castle/stable/dock depending on geography

## 14. Diplomacy

### 14.1 State Values

- alliance
- friendly
- neutral
- suspicious
- hostile
- war

### 14.2 Relation Inputs

- race affinity
- previous raids
- border proximity
- trade opportunity
- military comparison
- scarcity pressure

### 14.3 Diplomacy Outcomes

- reduced hostility
- increased hostility
- alliance formation
- war escalation
- trade-like resource friendliness via lower raid tendency

## 15. Combat

### 15.1 Combatants

- militia
- soldiers
- riders

### 15.2 Combat Factors

- headcount
- gear quality
- road access
- morale
- terrain
- tower/castle support

### 15.3 Combat Behavior

- raid peripheral assets first
- defend capital and core structures
- pull from labor pool during sustained conflict

## 16. Pathfinding and Movement

### 16.1 Movement

- strict tile center to tile center movement
- no free analog movement
- step-based interpolation for rendering

### 16.2 Pathfinding

- A* with movement cost grid
- road preference
- different passability for land and water
- budgeted requests per tick

### 16.3 Boats

Modeled simply in this pass:

- docks unlock fishing and limited coastal traversal jobs
- coastal/water access acts as a technology-gated extension of reachable food and trade zones

## 17. Seasons and Environmental Pressure

This pass includes light seasonality:

- warm
- cold

Effects:

- reduced farm output in cold periods
- higher warmth pressure in snow/tundra
- food reserves become more important

## 18. Rendering Specification

### 18.1 Visual Direction

- readable stylized pixel/vector hybrid
- high-contrast terrain palette
- clear race/tribe color identity
- minimal ambiguity between roads, buildings, forests, water, and mountains

### 18.2 Layers

- terrain layer
- feature/resource layer
- road layer
- building layer
- unit layer
- overlay/UI layer

### 18.3 Camera

- drag pan
- mousewheel zoom
- zoom centered on cursor
- clamped zoom range

## 19. Observer UI

### 19.1 Panels

- world summary
- selected tile info
- selected tribe info
- simulation metrics

### 19.2 Metrics

- current year/season
- total population
- tribe populations
- age/tech per tribe
- food/material reserves
- diplomacy overview

## 20. Persistence

Not required for first implementation pass.

Architecture should keep serialization approachable, but save/load is not mandatory to declare the prototype complete.

## 21. Performance Targets

- browser remains responsive during pan/zoom
- simulation operates in worker
- visible chunks only rendered
- map generation and startup stay within a practical local-dev wait time
- long simulation run remains stable without invalid state explosions

## 22. Test Requirements

### 22.1 Unit Tests

- seeded world generation determinism
- biome classification sanity
- pathfinding correctness on representative grids
- tribe strategy priority outputs
- building legality
- tech progression rules
- diplomacy drift rules

### 22.2 Integration Tests

- worker snapshot shape validity
- long sim stability for bounded test duration
- tribe placement spacing

### 22.3 Build Verification

- production build succeeds
- no TypeScript errors

## 23. Definition of Done For This Pass

This pass is done when:

- app boots locally
- world is large, varied, and tile-based
- multiple races and tribes behave differently
- tribes autonomously gather, build, grow, research, and fight
- roads and settlements appear over time
- tech reaches medieval systems
- observer can inspect the state
- automated tests and production build pass

## 24. Next Depth Pass

The next expansion pass should deepen the simulation in these concrete ways:

- much broader technology tree with race-specific unlocks and specializations
- stronger individual unit identity with names, aging, old-age death, gear, wounds, levels, and hero promotion
- more agricultural loops: orchards, pasture-like animal handling, food trees, hunting pressure
- more equipment depth: visible weapon/armor tiers, loot upgrades, and champion-grade gear
- dungeon / ruin / delve sites that can produce gear and world events
- magical warfare for races that support it, including mages and stronger battlefield spellcasting
- siege progression with medieval war assets like trebuchets, battering rams, ballistae, and siege towers
- recovery infrastructure such as infirmaries plus stronger magical infrastructure such as mage towers
- broader civic support buildings such as warehouses, schools, taverns, shrines, armories, and fisheries
- faith generation and blessing loops so standout units can become visibly anointed heroes
- stronger logistics so harvesting returns to storage hubs and crafting waits on hauled inputs at workshops and armories
- first-step mountain settlement support so dwarven and harsh-terrain tribes can carve out visible mountain halls
- first-step water/subsurface infrastructure through cisterns for stored irrigation and deep mines for harsher extraction economies
- first-step cave-oriented infrastructure through tunnel entrances and visible delve state in tribe summaries
- active underground expeditions with cave-ins, underbeast encounters, relic finds, and visible underground event output
- dynamic water-reserve simulation for tribes so cisterns, canals, weather, and nearby rivers/coasts affect farming pressure, morale, growth, and thirst events
- first post-medieval step through a gunpowder age, foundries, charcoal/brick processing, firearm-era gear, and cannon artillery
- stronger late-game magic through arcane sanctums, advanced mage gear, and larger sanctum-backed battlefield spells
- first-step ruler/succession identity so tribe summaries expose current rulers, crowns, and leadership turnover instead of leaving political continuity invisible
- first-step condition simulation so units and tribes expose fatigue, sickness, and inspiration instead of treating all health pressure as hidden hitpoint loss
- first-step wagon logistics so horse-backed internal transport is visible in the world and tied to real haul jobs
- second post-medieval age through an industrial step, adding factories, rail depots, stronger repeat-fire gear, and mortar siege escalation for relevant races
- first modern-age step through power plants, airfields, armored/tank warfare, zeppelins, stronger rifle-era gear, and clearer modern doctrine identity for industrialized factions
- modern support behavior where electrified industry improves throughput, power infrastructure helps water resilience, airfields enable stronger aid reach, and the UI exposes which kingdoms have entered that phase
- dynamic surface-water simulation over the land grid so storms, runoff, canals, and trenches create visible wet/flooded zones with food and morale consequences
- managed waterworks behavior so cisterns collect and release water, canals and trenches operate as connected irrigation/overflow infrastructure, and spillways/drought response are visible in tribe behavior
- a true underground map layer with generated caverns, ruins, underground rivers, magma seams, and excavated tunnel growth tied to delve infrastructure
- more explicit diplomacy with formal trade pacts, tribute relationships, and clearer allied/trading/tributary visibility in kingdom inspection
- diplomacy that has material consequences through alliance aid, tribute extraction, and added morale pressure on subjugated kingdoms
- first-contact/discovery gating so tribes scout outward, accumulate contacts, and only unlock diplomacy/trade/war after meeting neighbors
- stronger settlement expansion logic so remote farms, lumber camps, mines, and docks can grow their own logistics districts with supporting stockpiles and warehouses
- earlier Stone-age proto-industry through primitive workshops, surface mines, smoother water resilience, and stricter anti-spam caps on storage growth
- minimap and stronger observer UI for long sessions
- cleaner RTS/sim-style interface with tabs, shortcuts, inspection panels, and a surface/underground view toggle
- stronger visual polish through animated water/lava highlights, drifting cloud-shadow overlays, and restrained shadowing on structures and relief

The goal is not only more systems, but more visible systems:

- if a tribe learns a tech, the observer should see it
- if a unit has better gear, wounds, or heroic status, the observer should see it
- if a region is dangerous or special, the observer should know why

## 20. Expansion Backlog

The main future expansion track from the current prototype state is:

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

## 21. Current Execution Priorities

The active implementation priorities are now:

- performance and smoothness:
  - lower live render cost
  - smoother interpolation
  - less UI churn during live updates
- physical logistics:
  - construction and crafting fed by real hauled materials
  - less fake resource teleportation
  - stronger visible local storage and redistribution
- early-game flow:
  - tribes secure survival infrastructure first
  - tribes expand outward by roads and territory instead of only idling at the capital
- settlement growth:
  - branch halls and satellite districts
  - warehouse-driven hubs
  - stronger road-linked specialization
  - branch halls can now emerge from productive remote hubs rather than only capital-centered growth
- trade shaping:
  - caravans prefer goods that fit race identity, active district specialization, visible stocked hubs, and partner shortages
- long-run readability:
  - clearer world feedback for hauling, stock, work, and expansion

These execution priorities sit in front of the deeper backlog because they make the existing systems behave like a more credible simulation instead of only adding more content layers.

## 22. Next Execution Focus

The next implementation block is deliberately ordered:

1. stabilize bootstrap scarcity and branch-to-branch internal logistics
2. improve observer tooling and history usability
3. deepen economy pull and district specialization
4. improve combat readability before raising unit/war complexity further
5. only then deepen social simulation and later-era expansion

The immediate success criteria for the first block are:

- starts feel constrained but survivable
- branch halls can import what they lack from other halls in the same tribe
- resource depletion forces outward extension
- long-run settlements stay active instead of flattening into idle stock equilibrium

## 22. Current Multi-Hour Execution Window

The current active execution window is focused on making the simulation feel materially more physical and less over-provisioned before deeper content expansion continues.

### 22.1 Scarcity and Bootstrap Balance

- reduce starter global stock, embark piles, and starter building stock
- reduce seeded bootstrap deposit sizes near starts
- reduce passive food, livestock, and horse growth so early tribes must work to sustain themselves
- keep starts viable, but no longer godmode-safe

### 22.2 Branch-Hall Internal Logistics

- branch halls should exchange scarce goods with each other through real haul jobs
- branch halls should no longer behave like isolated mini-economies once multiple halls exist
- branch-local storage targets should cover food, building materials, and industrial inputs

### 22.3 Midgame District Demand

- productive raw sites should feed downstream hubs sooner
- branch halls should pull storage, housing, workshops, and support buildings more aggressively
- wagons should prefer longer balancing routes that keep multiple districts supplied

### 22.4 Expansion Shape

- roads and halls should define settlement corridors
- branch towns should become visible secondary centers, not only extra capital markers
- race and district specialization should be visible in branch follow-up buildings

### 22.5 Observer Readability

- local stock, shortage, and exchange behavior should be easier to inspect
- carried materials and deliveries should stay visible
- shortages, branch founding, and redistribution should emit clearer world feedback
- tribe summaries and kingdom panels should expose branch count, active branch transfers, current shortage, and current export focus

The implementation order for this execution window is:

1. scarcity and bootstrap balance
2. branch-hall internal logistics
3. stronger midgame demand and redistribution
4. stronger branch settlement growth/readability
5. observer/readability polish for the above systems

Concrete todo list for this execution window:

- finish the current scarcity patch in startup and passive economy
- add direct tests for branch-hall internal exchange
- re-verify startup, branch-support, redistribution, and long-run district behavior
- commit the scarcity/branch-logistics slice
- tighten remote-district support if branches still stall after founding
- re-run long-run activity/expansion checks after each balancing pass

## 23. Next Multi-Hour Execution Block

With scarcity and branch exchange established, the next implementation block should focus on visibility and midgame pull:

1. expose branch logistics and shortage/export state clearly in summaries and UI
2. strengthen hall-aware redistribution and long-haul balancing
3. keep branch towns self-supplying and visibly growing
4. only after that, begin the first combat-readability slice
5. then begin the first social-simulation slice

Immediate success criteria:

- users can tell which tribes have multiple branches, which branches are strained, and whether goods are flowing inward or outward
- mature tribes keep moving goods between districts instead of flattening into quiet stock equilibrium
- branch towns continue pulling support buildings instead of remaining thin outposts

Current concrete gaps after the latest execution slices:

- wagons still need stronger preference for branch-deficit balancing over generic big hauls
- redistribution still needs deeper strategic reserve behavior beyond local hall pressure
- branch halls are visible in summary state, but not yet clearly marked as map-level branch centers
- shortage/import/export state is still mostly tribe-level rather than per-branch/per-district
- combat and social depth should remain behind these logistics fixes until the world is easier to read
