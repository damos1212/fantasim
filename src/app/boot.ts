import { DEFAULT_WORLD_SEED } from "../shared/config";
import { InitMessage, WorldMessage } from "../shared/gameTypes";
import { GameRenderer } from "../render/gameRenderer";

export async function boot(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root");
  }

  const renderer = new GameRenderer(root);
  await renderer.init();

  const worker = new Worker(new URL("../sim/worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<WorldMessage>) => {
    if (event.data.type === "world-init") {
      renderer.setWorld(event.data.world, event.data.tribes);
      return;
    }

    if (event.data.type === "snapshot") {
      renderer.applySnapshot(event.data.snapshot);
    }
  };

  const initMessage: InitMessage = {
    type: "init",
    seed: DEFAULT_WORLD_SEED,
  };
  worker.postMessage(initMessage);
}
