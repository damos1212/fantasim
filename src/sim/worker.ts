/// <reference lib="webworker" />

import { DEFAULT_WORLD_SEED, SIM_TICKS_PER_SECOND } from "../shared/config";
import { InitMessage, WorldMessage } from "../shared/gameTypes";
import { createSimulation } from "./simulation";

declare const self: DedicatedWorkerGlobalScope;

let timer: number | null = null;

self.onmessage = (event: MessageEvent<InitMessage>) => {
  if (event.data.type !== "init") {
    return;
  }

  if (timer !== null) {
    self.clearInterval(timer);
  }

  const simulation = createSimulation(event.data.seed || DEFAULT_WORLD_SEED);
  self.postMessage(simulation.getInitialMessage() satisfies WorldMessage);
  self.postMessage({ type: "snapshot", snapshot: simulation.snapshotNow() } satisfies WorldMessage);

  timer = self.setInterval(() => {
    const snapshot = simulation.tick();
    if (snapshot) {
      self.postMessage({ type: "snapshot", snapshot } satisfies WorldMessage);
    }
  }, 1000 / SIM_TICKS_PER_SECOND);
};
