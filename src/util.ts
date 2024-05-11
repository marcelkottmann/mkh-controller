import { Motor } from "./controller";

export function createIsResolved(p: Promise<any>): () => boolean {
  let completed = false;

  (async () => {
    await p;
    completed = true;
  })();

  return () => completed;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hex(num: number, padding: number) {
  if (num < 0) {
    throw Error(`Cannot convert negative number to hex: ${num}`);
  }
  if (Number.isNaN(num)) {
    throw Error(`Cannot convert NAN to hex: ${num}`);
  }
  if (!Number.isFinite(num)) {
    throw Error(`Cannot convert infinite to hex: ${num}`);
  }

  return num.toString(16).toUpperCase().padStart(padding, "0");
}

export function bitmask(motors: Motor[], padding: number) {
  let mask = 0;
  for (const motor of motors) {
    mask |= 1 << (motor - 1);
  }
  return mask.toString(16).padStart(padding, "0");
}
