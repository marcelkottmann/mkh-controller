import noble from "@abandonware/noble";
import { start } from "./test-mould-king";
import { createController } from "./controller";

const MOULD_KING_HUB_SCAN_SERVICE_UUID = "af30";
const MOULD_KING_HUB_SERVICE_UUID = "ae3a";
const MOULD_KING_HUB_WRITE_NO_RESPONSE_UUID = "ae3b";
const MOULD_KING_HUB_NOTIFY_UUID = "ae3c";

export interface ConnectState {
  connected: boolean;
}

export type DataListener = (data: Buffer, isNotification: boolean) => void;

function startScanning() {
  console.log(`start scanning ...`);
  noble.startScanning([MOULD_KING_HUB_SCAN_SERVICE_UUID], false);
}

noble.on("stateChange", (state) => {
  if (state === "poweredOn") {
    startScanning();
  }
});

noble.on("discover", async (peripheral) => {
  await noble.stopScanningAsync();

  const connectState: ConnectState = {
    connected: true,
  };

  peripheral.on("disconnect", () => {
    connectState.connected = false;
    console.log("disconnected");
    startScanning();
  });

  console.log(`connect ${peripheral.address} ...`);
  await peripheral.connectAsync();

  console.log(`discover characteristic ...`);
  const characteristics =
    await peripheral.discoverSomeServicesAndCharacteristicsAsync(
      [MOULD_KING_HUB_SERVICE_UUID],
      [MOULD_KING_HUB_WRITE_NO_RESPONSE_UUID, MOULD_KING_HUB_NOTIFY_UUID]
    );

  console.log(characteristics.characteristics.map((c) => c.uuid));

  const writeTarget = characteristics.characteristics.find(
    (c) => c.uuid === MOULD_KING_HUB_WRITE_NO_RESPONSE_UUID
  );

  const notifyTarget = characteristics.characteristics.find(
    (c) => c.uuid === MOULD_KING_HUB_NOTIFY_UUID
  );

  if (writeTarget && notifyTarget) {
    await notifyTarget.subscribeAsync();
    const register = (dl: DataListener) => {
      notifyTarget.on("data", dl);
    };
    const controller = await createController(
      writeTarget,
      connectState,
      register
    );
    await start(controller);
  } else {
    console.error(`characteristic not found: ${writeTarget}, ${notifyTarget}`);
  }
});
