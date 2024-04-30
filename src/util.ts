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
  return num.toString(16).toUpperCase().padStart(padding, "0");
}

export function bitmask(motor: number, padding: number) {
  return `${1 << (motor - 1)}`.padStart(padding, "0");
}
