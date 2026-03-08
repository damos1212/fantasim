export function createRuntimeSeed(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `fantasim-${globalThis.crypto.randomUUID()}`;
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.floor(Math.random() * 0xffffffff).toString(36);
  return `fantasim-${timestamp}-${randomPart}`;
}
