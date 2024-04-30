import noble from "@abandonware/noble";
import AsyncLock from "async-lock";

const lock = new AsyncLock();

export async function sendMessage(
  characteristic: noble.Characteristic,
  message: string
) {
  await lock.acquire("sendMessage", async () => {
    const arr = [];
    for (let i = 0; i < message.length; i++) {
      arr.push(message.charCodeAt(i));
    }

    while (arr.length > 0) {
      const data = Buffer.from(new Uint8Array(arr.splice(0, 20)));
      console.log(data.toString("ascii"));
      await characteristic.writeAsync(data, true);
    }
  });
}
