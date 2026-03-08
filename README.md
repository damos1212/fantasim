# Fantasim

Fantasim is a large-scale, observer-only 2D top-down fantasy world simulation built for the browser.

It generates a huge tile-based world with oceans, rivers, lakes, deserts, marshes, forests, mountains, volcanic regions, underground caverns, and multiple autonomous races competing to survive and expand. You do not directly command units. You watch tribes build towns, roads, farms, walls, workshops, docks, mines, waterworks, armies, trade networks, and underground delves while weather, logistics, diplomacy, monsters, and technology push the world forward.

## What It Does

- Massive procedurally generated tile world with seeded generation
- Multiple races and tribes with different biome preferences, doctrines, personalities, and tech tendencies
- Autonomous economy with gathering, hauling, storage, construction, crafting, farming, fishing, mining, delving, and trade
- Coherent settlement growth with roads, districts, warehouses, fisheries, industry, fortifications, and mountain settlements
- Dynamic weather, runoff, flooding, canals, cisterns, and managed waterworks
- Surface and underground map layers
- Legendary creatures, dungeons, relic finds, and delve hazards
- Diplomacy with alliances, trade pacts, tribute, aid, hostility, and war
- Progression from primitive through stone, bronze, iron, medieval, gunpowder, industrial, and a first modern slice
- Distinct visible units, buildings, gear, siege engines, late-industry infrastructure, and atmospheric rendering

## Current Highlights

- 8 races: humans, elves, dwarves, orcs, goblins, halflings, nomads, and darkfolk
- Huge world scale with macro oceans, islands, rivers, lakes, marsh belts, desert bands, mountains, and ashlands
- Towns build housing, stockpiles, warehouses, cisterns, farms, orchards, lumber camps, quarries, mines, workshops, schools, smithies, armories, taverns, shrines, infirmaries, barracks, stables, mage towers, sanctums, foundries, factories, rail depots, power plants, airfields, castles, mountain halls, deep mines, and tunnel entrances
- Armies field melee, ranged, riders, mages, siege engines, cannon, mortars, tanks, and zeppelins depending on age and race
- UI includes minimap, surface/underground view toggle, tribe list, event history, tile inspection, unit follow mode, and live kingdom stats

## Tech Stack

- TypeScript
- Bun
- Vite
- PixiJS / WebGL
- Vitest

## Running Locally

### Requirements

- Bun

### Install

```bash
bun install
```

### Development

```bash
bun run dev
```

Open the local Vite URL in your browser.

### Production Build

```bash
bun run build
```

### Tests

```bash
bun run test
```

## Controls

- Mouse wheel: zoom
- Drag: pan camera
- Click tile: inspect tile
- Click unit: inspect and follow unit
- Click empty ground: clear unit follow
- Click tribe row: focus that tribe
- `1` / `2` / `3` / `4`: switch sidebar tabs
- `F`: focus selected tribe
- `G`: toggle surface / underground view
- `Esc`: clear selected unit / stop follow

## Project Scripts

- `bun run dev`
- `bun run build`
- `bun run test`
- `bun run preview`

## Status

This is already a large playable prototype with deep simulation systems, but it is still an expanding project rather than a final commercial-content-complete game. The current frontier is pushing later-era content, deeper creature/hero/world-event systems, and more long-session polish.
