import noble from "@stoprocent/noble";
import { lock } from "./lock";

export async function sendMessage(
  characteristic: noble.Characteristic,
  message: string | number[],
  options: { log: boolean } = { log: true }
) {
  await lock.acquire("sendMessage", async () => {
    let arr: number[] = [];

    if (Array.isArray(message)) {
      arr = message;
    } else {
      for (let i = 0; i < message.length; i++) {
        arr.push(message.charCodeAt(i));
      }
    }

    while (arr.length > 0) {
      const data = Buffer.from(new Uint8Array(arr.splice(0, 20)));
      if (options.log) {
        console.log(data.toString("ascii"));
      }
      await characteristic.writeAsync(data, true);
    }
  });
}
