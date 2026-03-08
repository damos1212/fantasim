import { DEFAULT_WORLD_SEED } from "../shared/config";
import { InitMessage, WorldMessage } from "../shared/gameTypes";
import { createRuntimeSeed } from "../shared/seed";
import { GameRenderer } from "../render/gameRenderer";

export async function boot(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }

  const renderer = new GameRenderer(root);
  await renderer.init();
  renderer.setLoadingStatus("Starting world generator...");

  const worker = new Worker(new URL("../sim/worker.ts", import.meta.url), { type: "module" });
  renderer.bindWorker(worker);
  worker.onmessage = (event: MessageEvent<WorldMessage>) => {
    if (event.data.type === "world-init") {
      renderer.setLoadingStatus("World built. Streaming terrain and tribes...");
      renderer.setWorld(event.data.world, event.data.tribes);
      return;
    }

    if (event.data.type === "snapshot") {
      renderer.applySnapshot(event.data.snapshot);
      renderer.hideLoading();
    }
  };

  const initMessage: InitMessage = {
    type: "init",
    seed: createRuntimeSeed() || DEFAULT_WORLD_SEED,
  };
  worker.postMessage(initMessage);
}
