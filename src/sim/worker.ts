/// <reference lib="webworker" />

import { DEFAULT_WORLD_SEED, SIM_TICKS_PER_SECOND } from "../shared/config";
import { WorkerInboundMessage, WorldMessage } from "../shared/gameTypes";
import { createSimulation } from "./simulation";

declare const self: DedicatedWorkerGlobalScope;

let timer: number | null = null;
let paused = false;
let speed: 1 | 2 | 4 | 8 = 1;
let simulation: ReturnType<typeof createSimulation> | null = null;
let nextRunAt = 0;

function clearLoop(): void {
  if (timer !== null) {
    self.clearTimeout(timer);
    timer = null;
  }
}

function scheduleLoop(): void {
  clearLoop();
  if (!simulation || paused) {
    return;
  }
  const tickMs = 1000 / SIM_TICKS_PER_SECOND;
  const now = performance.now();
  if (nextRunAt <= now) {
    nextRunAt = now + tickMs;
  }
  timer = self.setTimeout(runLoop, Math.max(0, nextRunAt - now));
}

function runLoop(): void {
  if (!simulation || paused) {
    return;
  }

  let latestSnapshot = null;
  for (let i = 0; i < speed; i += 1) {
    const snapshot = simulation.tick();
    if (snapshot) {
      latestSnapshot = snapshot;
    }
  }
  if (latestSnapshot) {
    self.postMessage({ type: "snapshot", snapshot: latestSnapshot } satisfies WorldMessage);
  }
  nextRunAt += 1000 / SIM_TICKS_PER_SECOND;
  scheduleLoop();
}

self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  if (event.data.type === "control") {
    if (typeof event.data.paused === "boolean") {
      paused = event.data.paused;
    }
    if (event.data.speed) {
      speed = event.data.speed;
    }
    nextRunAt = performance.now() + 1000 / SIM_TICKS_PER_SECOND;
    scheduleLoop();
    return;
  }

  if (event.data.type !== "init") {
    return;
  }

  clearLoop();
  paused = false;
  speed = 1;
  simulation = createSimulation(event.data.seed || DEFAULT_WORLD_SEED);
  nextRunAt = performance.now() + 1000 / SIM_TICKS_PER_SECOND;
  self.postMessage(simulation.getInitialMessage() satisfies WorldMessage);
  self.postMessage({ type: "snapshot", snapshot: simulation.snapshotNow() } satisfies WorldMessage);
  scheduleLoop();
};
