/// <reference lib="webworker" />

import { DEFAULT_WORLD_SEED, SIM_TICKS_PER_SECOND } from "../shared/config";
import { WorkerInboundMessage, WorldMessage } from "../shared/gameTypes";
import { createSimulation } from "./simulation";

declare const self: DedicatedWorkerGlobalScope;

let timer: number | null = null;
let paused = false;
let speed: 1 | 2 | 4 | 8 = 1;
let simulation: ReturnType<typeof createSimulation> | null = null;

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
  timer = self.setTimeout(runLoop, 1000 / SIM_TICKS_PER_SECOND);
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
  self.postMessage(simulation.getInitialMessage() satisfies WorldMessage);
  self.postMessage({ type: "snapshot", snapshot: simulation.snapshotNow() } satisfies WorldMessage);
  scheduleLoop();
};
